import type { Firestore } from 'firebase-admin/firestore';
import type { AiDataDomain } from './constants';
import { buildCustomerIndex, sanitizeBusinessData } from './aiDataSanitizer';

interface CompanyContext {
  name: string;
  currency: string;
  country: string;
  timezone?: string;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(String(value));
}

function isDateInRange(date: Date | undefined, from?: Date, to?: Date): boolean {
  if (!date) return false;
  const ms = date.getTime();
  if (from && ms < from.getTime()) return false;
  if (to && ms > to.getTime()) return false;
  return true;
}

function getLast30DaysRange(): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 29);
  return { from, to };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type CollectionCache = Map<string, Record<string, unknown>[]>;

async function getCollection<T extends Record<string, unknown>>(
  db: Firestore,
  collectionName: string,
  companyId: string,
  cache: CollectionCache
): Promise<T[]> {
  const cacheKey = `${companyId}:${collectionName}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as T[];

  const snapshot = await db.collection(collectionName).where('companyId', '==', companyId).get();
  const rows = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as T;
      return { ...data, id: (data.id as string | undefined) ?? docSnap.id };
    })
    .filter((row) => !row.deleted);
  cache.set(cacheKey, rows);
  return rows;
}

async function loadDomainData(
  db: Firestore,
  companyId: string,
  domain: AiDataDomain,
  cache: CollectionCache
): Promise<Record<string, unknown>> {
  const { from, to } = getLast30DaysRange();

  switch (domain) {
    case 'sales': {
      const sales = (await getCollection<Record<string, unknown>>(db, 'sales', companyId, cache)).filter(
        (sale) => !sale.deleted
      );
      const inRange = sales.filter((sale) => isDateInRange(toDate(sale.orderDate), from, to));
      const grossRevenue = roundMoney(
        inRange.reduce((sum, sale) => sum + Number(sale.grossRevenue ?? 0), 0)
      );
      const profit = roundMoney(inRange.reduce((sum, sale) => sum + Number(sale.profit ?? 0), 0));
      const byPlatform = inRange.reduce<Record<string, { revenue: number; profit: number; count: number }>>(
        (acc, sale) => {
          const platform = String(sale.platform ?? 'Unknown');
          if (!acc[platform]) acc[platform] = { revenue: 0, profit: 0, count: 0 };
          acc[platform].revenue += Number(sale.grossRevenue ?? 0);
          acc[platform].profit += Number(sale.profit ?? 0);
          acc[platform].count += 1;
          return acc;
        },
        {}
      );
      return {
        totalSales: sales.length,
        recentSalesCount: inRange.length,
        periodSummary: {
          grossRevenue,
          profit,
          profitMarginPercent: grossRevenue > 0 ? roundMoney((profit / grossRevenue) * 100) : 0,
          orders: inRange.length,
        },
        byPlatform: Object.entries(byPlatform)
          .map(([platform, stats]) => ({ platform, ...stats }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 6),
        recentOrders: inRange.slice(0, 8).map((sale) => ({
          orderDate: toDate(sale.orderDate)?.toISOString(),
          platform: sale.platform,
          productName: sale.productName,
          quantity: sale.quantity,
          status: sale.status,
          grossRevenue: sale.grossRevenue,
          profit: sale.profit,
          profitMarginPercent: sale.profitMarginPercent,
        })),
      };
    }
    case 'products': {
      const products = (await getCollection<Record<string, unknown>>(db, 'products', companyId, cache)).filter(
        (product) => !product.deleted
      );
      return {
        totalProducts: products.length,
        products: products.slice(0, 12).map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          status: product.status,
        })),
      };
    }
    case 'expenses': {
      const expenses = (await getCollection<Record<string, unknown>>(db, 'expenses', companyId, cache)).filter(
        (expense) => !expense.deleted
      );
      const inRange = expenses.filter((expense) =>
        isDateInRange(toDate(expense.expenseDate), from, to)
      );
      const totalAmount = roundMoney(
        inRange.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
      );
      const byCategory = inRange.reduce<Record<string, number>>((acc, expense) => {
        const key = String(expense.category ?? 'uncategorized');
        acc[key] = roundMoney((acc[key] ?? 0) + Number(expense.amount ?? 0));
        return acc;
      }, {});
      return {
        totalExpenses: expenses.length,
        recentExpensesCount: inRange.length,
        recentTotalAmount: totalAmount,
        byCategory,
        recentExpenses: inRange.slice(0, 8).map((expense) => ({
          expenseDate: toDate(expense.expenseDate)?.toISOString(),
          category: expense.category,
          amount: expense.amount,
          description: expense.description,
        })),
      };
    }
    case 'purchases': {
      const purchases = (await getCollection<Record<string, unknown>>(db, 'purchases', companyId, cache)).filter(
        (purchase) => !purchase.deleted
      );
      return {
        totalPurchases: purchases.length,
        recentPurchases: purchases.slice(0, 8).map((purchase) => ({
          purchaseDate: toDate(purchase.purchaseDate)?.toISOString(),
          status: purchase.status,
          paymentStatus: purchase.paymentStatus,
          total: purchase.total,
          lineCount: Array.isArray(purchase.lines) ? purchase.lines.length : 0,
        })),
      };
    }
    case 'invoices': {
      const invoices = (await getCollection<Record<string, unknown>>(db, 'invoices', companyId, cache)).filter(
        (invoice) => !invoice.deleted && invoice.status !== 'draft' && invoice.status !== 'void'
      );
      const inRange = invoices.filter((invoice) =>
        isDateInRange(toDate(invoice.invoiceDate), from, to)
      );
      const outstanding = roundMoney(
        inRange.reduce((sum, invoice) => sum + Number(invoice.balanceDue ?? 0), 0)
      );
      return {
        totalInvoices: invoices.length,
        recentInvoicesCount: inRange.length,
        outstandingBalance: outstanding,
        recentInvoices: inRange.slice(0, 8).map((invoice) => ({
          invoiceDate: toDate(invoice.invoiceDate)?.toISOString(),
          status: invoice.status,
          total: invoice.total,
          totalPaid: invoice.totalPaid,
          balanceDue: invoice.balanceDue,
          customerId: invoice.customerId,
        })),
      };
    }
    case 'payments': {
      const payments = (await getCollection<Record<string, unknown>>(db, 'payments', companyId, cache)).filter(
        (payment) => !payment.deleted
      );
      const inRange = payments.filter((payment) =>
        isDateInRange(toDate(payment.paymentDate), from, to)
      );
      const totalReceived = roundMoney(
        inRange.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
      );
      return {
        totalPayments: payments.length,
        recentPaymentsCount: inRange.length,
        recentTotalReceived: totalReceived,
        recentPayments: inRange.slice(0, 8).map((payment) => ({
          paymentDate: toDate(payment.paymentDate)?.toISOString(),
          kind: payment.kind,
          amount: payment.amount,
          mode: payment.mode,
        })),
      };
    }
    case 'stock': {
      const stock = await getCollection<Record<string, unknown>>(db, 'stock', companyId, cache);
      const active = stock.filter((item) => Number(item.quantityOnHand ?? 0) > 0);
      return {
        stockSummary: {
          productCount: active.length,
          totalUnits: active.reduce((sum, item) => sum + Number(item.quantityOnHand ?? 0), 0),
          totalValue: roundMoney(
            active.reduce((sum, item) => sum + Number(item.totalValue ?? 0), 0)
          ),
        },
        lowStock: stock
          .filter((item) => Number(item.quantityOnHand ?? 0) <= 5)
          .slice(0, 8)
          .map((item) => ({
            productId: item.productId,
            quantityOnHand: item.quantityOnHand,
            avgPurchasePrice: item.avgPurchasePrice,
          })),
      };
    }
    case 'customers': {
      const customers = (await getCollection<Record<string, unknown>>(db, 'customers', companyId, cache)).filter(
        (customer) => !customer.deleted
      );
      return {
        totalCustomers: customers.length,
        activeCustomers: customers.filter((customer) => customer.status === 'active').length,
      };
    }
    case 'vendors': {
      const vendors = (await getCollection<Record<string, unknown>>(db, 'vendors', companyId, cache)).filter(
        (vendor) => !vendor.deleted
      );
      return {
        totalVendors: vendors.length,
        activeVendors: vendors.filter((vendor) => vendor.status === 'active').length,
      };
    }
    case 'overview': {
      const [sales, expenses, products, stock, invoices] = await Promise.all([
        getCollection<Record<string, unknown>>(db, 'sales', companyId, cache),
        getCollection<Record<string, unknown>>(db, 'expenses', companyId, cache),
        getCollection<Record<string, unknown>>(db, 'products', companyId, cache),
        getCollection<Record<string, unknown>>(db, 'stock', companyId, cache),
        getCollection<Record<string, unknown>>(db, 'invoices', companyId, cache),
      ]);
      const activeSales = sales.filter((sale) => !sale.deleted);
      const activeExpenses = expenses.filter((expense) => !expense.deleted);
      const inRangeSales = activeSales.filter((sale) =>
        isDateInRange(toDate(sale.orderDate), from, to)
      );
      const inRangeExpenses = activeExpenses.filter((expense) =>
        isDateInRange(toDate(expense.expenseDate), from, to)
      );
      const inRangeInvoices = invoices
        .filter((invoice) => !invoice.deleted && invoice.status !== 'draft' && invoice.status !== 'void')
        .filter((invoice) => isDateInRange(toDate(invoice.invoiceDate), from, to));
      const onlineRevenue = roundMoney(
        inRangeSales.reduce((sum, sale) => sum + Number(sale.grossRevenue ?? 0), 0)
      );
      const offlineRevenue = roundMoney(
        inRangeInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0)
      );
      const grossRevenue = roundMoney(onlineRevenue + offlineRevenue);
      const onlineProfit = roundMoney(
        inRangeSales.reduce((sum, sale) => sum + Number(sale.profit ?? 0), 0)
      );
      const offlineProfit = roundMoney(
        inRangeInvoices.reduce((sum, invoice) => sum + Number(invoice.profit ?? 0), 0)
      );
      const profit = roundMoney(onlineProfit + offlineProfit);
      const expenseTotal = roundMoney(
        inRangeExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
      );
      const activeStock = stock.filter((item) => Number(item.quantityOnHand ?? 0) > 0);
      return {
        last30Days: {
          revenue: grossRevenue,
          profit,
          profitMarginPercent: grossRevenue > 0 ? roundMoney((profit / grossRevenue) * 100) : 0,
          orders: inRangeSales.length + inRangeInvoices.length,
          expenses: expenseTotal,
        },
        totals: {
          products: products.filter((product) => !product.deleted).length,
          sales: activeSales.length,
          expenses: activeExpenses.length,
        },
        stockSummary: {
          productCount: activeStock.length,
          totalUnits: activeStock.reduce((sum, item) => sum + Number(item.quantityOnHand ?? 0), 0),
          totalValue: roundMoney(
            activeStock.reduce((sum, item) => sum + Number(item.totalValue ?? 0), 0)
          ),
        },
      };
    }
    default:
      return {};
  }
}

export async function fetchAiBusinessContext(
  db: Firestore,
  company: CompanyContext,
  companyId: string,
  domains: AiDataDomain[]
): Promise<Record<string, unknown>> {
  const uniqueDomains = [...new Set(domains)];
  const domainData: Record<string, unknown> = {};
  const cache: CollectionCache = new Map();

  const customers = (await getCollection<Record<string, unknown>>(db, 'customers', companyId, cache)).filter(
    (customer) => !customer.deleted
  );
  const customerIndex = buildCustomerIndex(
    customers.map((customer) => ({ id: String(customer.id) }))
  );

  await Promise.all(
    uniqueDomains.map(async (domain) => {
      domainData[domain] = await loadDomainData(db, companyId, domain, cache);
    })
  );

  return sanitizeBusinessData(
    {
      company,
      domains: uniqueDomains,
      data: domainData,
    },
    customerIndex
  );
}
