import type { Expense, Invoice, Payment, PeriodProfitSummary, ProductStock, PurchaseOrder, Sale } from '../types';
import { InvoiceStatus, PaymentKind, PurchaseOrderStatus } from '../types';
import {
  localDateInputToUtc,
  localDateInputToUtcEndOfDay,
  utcToLocalDateInput,
} from './firestoreDates';
import { isDateInRange } from './expenseHelpers';
import { getSaleLineMetrics, saleCogs, saleShipping } from './saleLines';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ReportPreset = '7d' | '30d' | 'month' | 'year' | 'all' | 'custom';

export const OFFLINE_SALES_CHANNEL = 'Invoices';

export function getReportDateRange(
  preset: ReportPreset,
  customFrom?: string,
  customTo?: string
): { from?: Date; to?: Date; label: string } {
  const todayStr = utcToLocalDateInput(new Date());
  const endOfToday = localDateInputToUtcEndOfDay(todayStr);

  if (preset === 'all') {
    return { label: 'All time' };
  }

  if (preset === 'custom') {
    if (customFrom && customTo) {
      return {
        from: localDateInputToUtc(customFrom),
        to: localDateInputToUtcEndOfDay(customTo),
        label: `${customFrom} – ${customTo}`,
      };
    }
    return { label: 'Custom range' };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (preset === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: endOfToday,
      label: 'This month',
    };
  }

  if (preset === 'year') {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: endOfToday,
      label: 'This year',
    };
  }

  const from = new Date(now);
  if (preset === '7d') from.setDate(from.getDate() - 6);
  if (preset === '30d') from.setDate(from.getDate() - 29);

  return {
    from,
    to: endOfToday,
    label: preset === '7d' ? 'Last 7 days' : 'Last 30 days',
  };
}

export function filterSalesInRange(sales: Sale[], from?: Date, to?: Date): Sale[] {
  return sales.filter((s) => isDateInRange(s.orderDate, from, to));
}

export function filterExpensesInRange(expenses: Expense[], from?: Date, to?: Date): Expense[] {
  return expenses.filter((e) => isDateInRange(e.expenseDate, from, to));
}

/** Invoices that count toward revenue and profit (not draft/void). */
export function isReportableInvoice(invoice: Invoice): boolean {
  return (
    !invoice.deleted &&
    invoice.status !== InvoiceStatus.DRAFT &&
    invoice.status !== InvoiceStatus.VOID
  );
}

export function filterInvoicesInRange(invoices: Invoice[], from?: Date, to?: Date): Invoice[] {
  return invoices
    .filter(isReportableInvoice)
    .filter((i) => isDateInRange(i.invoiceDate, from, to));
}

export function filterPaymentsInRange(payments: Payment[], from?: Date, to?: Date): Payment[] {
  return payments
    .filter((p) => !p.deleted)
    .filter((p) => isDateInRange(p.paymentDate, from, to));
}

export interface PaymentSummary {
  count: number;
  totalReceived: number;
  invoicePayments: number;
  directPayments: number;
  marketplacePayouts: number;
  invoicePaymentCount: number;
  directPaymentCount: number;
  marketplacePayoutCount: number;
}

export function computePaymentSummary(payments: Payment[]): PaymentSummary {
  let totalReceived = 0;
  let invoicePayments = 0;
  let directPayments = 0;
  let marketplacePayouts = 0;
  let invoicePaymentCount = 0;
  let directPaymentCount = 0;
  let marketplacePayoutCount = 0;

  for (const payment of payments) {
    totalReceived += payment.amount;
    if (payment.kind === PaymentKind.INVOICE) {
      invoicePayments += payment.amount;
      invoicePaymentCount++;
    } else if (payment.kind === PaymentKind.DIRECT) {
      directPayments += payment.amount;
      directPaymentCount++;
    } else if (payment.kind === PaymentKind.MARKETPLACE_PAYOUT) {
      marketplacePayouts += payment.amount;
      marketplacePayoutCount++;
    }
  }

  return {
    count: payments.length,
    totalReceived: roundMoney(totalReceived),
    invoicePayments: roundMoney(invoicePayments),
    directPayments: roundMoney(directPayments),
    marketplacePayouts: roundMoney(marketplacePayouts),
    invoicePaymentCount,
    directPaymentCount,
    marketplacePayoutCount,
  };
}

export interface InvoiceReceivablesSummary {
  balanceDue: number;
  openCount: number;
  totalInvoiced: number;
}

/** Current outstanding customer balances (not period-filtered). */
export function computeInvoiceReceivables(invoices: Invoice[]): InvoiceReceivablesSummary {
  let balanceDue = 0;
  let openCount = 0;
  let totalInvoiced = 0;

  for (const invoice of invoices) {
    if (!isReportableInvoice(invoice)) continue;
    totalInvoiced += invoice.total;
    if (invoice.balanceDue > 0) {
      balanceDue += invoice.balanceDue;
      openCount++;
    }
  }

  return {
    balanceDue: roundMoney(balanceDue),
    openCount,
    totalInvoiced: roundMoney(totalInvoiced),
  };
}

export interface CashFlowSummary {
  received: number;
  receivedCount: number;
  paid: number;
  paidCount: number;
  poPayments: number;
  poPaymentCount: number;
  operatingExpenses: number;
  operatingExpenseCount: number;
  netCashFlow: number;
}

/** Cash in (customer receipts) vs cash out (vendor PO payments + operating expenses) for a period. */
export function computeCashFlowSummary(
  receivedPayments: Payment[],
  purchases: PurchaseOrder[],
  expensesInRange: Expense[],
  from?: Date,
  to?: Date
): CashFlowSummary {
  const paymentSummary = computePaymentSummary(receivedPayments);
  const operatingExpenseRows = filterOperatingExpenses(expensesInRange);

  let poPayments = 0;
  let poPaymentCount = 0;
  for (const purchase of purchases) {
    if (purchase.deleted || purchase.status === PurchaseOrderStatus.CANCELLED) continue;
    for (const payment of purchase.payments) {
      if (!isDateInRange(payment.paymentDate, from, to)) continue;
      poPayments += payment.amount;
      poPaymentCount++;
    }
  }

  const operatingExpenses = roundMoney(
    operatingExpenseRows.reduce((sum, expense) => sum + expense.amount, 0)
  );
  const paid = roundMoney(roundMoney(poPayments) + operatingExpenses);

  return {
    received: paymentSummary.totalReceived,
    receivedCount: paymentSummary.count,
    paid,
    paidCount: poPaymentCount + operatingExpenseRows.length,
    poPayments: roundMoney(poPayments),
    poPaymentCount,
    operatingExpenses,
    operatingExpenseCount: operatingExpenseRows.length,
    netCashFlow: roundMoney(paymentSummary.totalReceived - paid),
  };
}

/**
 * Auto expenses already reflected in order/invoice profit or inventory (stock asset).
 * Excluded from P&L net profit to avoid double-counting.
 */
export function isExpenseExcludedFromNetProfit(expense: Expense): boolean {
  if (!expense.autoGenerated) return false;
  if (expense.saleId) return true;
  if (expense.purchaseOrderId && expense.category === 'Inventory Purchase') return true;
  return false;
}

/** Operating expenses that reduce net profit after order/invoice profit. */
export function filterOperatingExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((e) => !isExpenseExcludedFromNetProfit(e));
}

function saleCogsFromSale(sale: Sale): number {
  return saleCogs(sale);
}

function saleShippingFromSale(sale: Sale): number {
  return saleShipping(sale);
}

export function computePeriodSummary(
  sales: Sale[],
  invoices: Invoice[],
  expenses: Expense[],
  rangeLabel: string,
  from?: Date,
  to?: Date
): PeriodProfitSummary {
  const onlineRevenue = roundMoney(sales.reduce((sum, s) => sum + s.grossRevenue, 0));
  const offlineRevenue = roundMoney(invoices.reduce((sum, i) => sum + i.total, 0));
  const grossRevenue = roundMoney(onlineRevenue + offlineRevenue);

  const onlineCogs = roundMoney(sales.reduce((sum, s) => sum + saleCogsFromSale(s), 0));
  const offlineCogs = roundMoney(invoices.reduce((sum, i) => sum + i.totalCogs, 0));
  const totalCogs = roundMoney(onlineCogs + offlineCogs);

  const totalShipping = roundMoney(sales.reduce((sum, s) => sum + saleShippingFromSale(s), 0));
  const totalPlatformFees = roundMoney(sales.reduce((sum, s) => sum + s.platformFees, 0));

  const onlineTax = roundMoney(sales.reduce((sum, s) => sum + s.economics.taxAmount, 0));
  const offlineTax = roundMoney(invoices.reduce((sum, i) => sum + i.taxAmount, 0));
  const totalTax = roundMoney(onlineTax + offlineTax);

  const onlineProfit = roundMoney(sales.reduce((sum, s) => sum + s.profit, 0));
  const offlineProfit = roundMoney(invoices.reduce((sum, i) => sum + i.profit, 0));
  const grossProfit = roundMoney(onlineProfit + offlineProfit);

  const operatingExpenses = filterOperatingExpenses(expenses);
  const totalExpenses = roundMoney(operatingExpenses.reduce((sum, e) => sum + e.amount, 0));
  const excludedAutoExpenses = roundMoney(
    expenses
      .filter(isExpenseExcludedFromNetProfit)
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const netProfit = roundMoney(grossProfit - totalExpenses);
  const netMarginPercent =
    grossRevenue > 0 ? roundMoney((netProfit / grossRevenue) * 100) : 0;

  const onlineSaleCount = sales.length;
  const invoiceCount = invoices.length;

  const periodStart =
    from ??
    [sales[0]?.orderDate, invoices[0]?.invoiceDate].filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] ??
    new Date();
  const periodEnd =
    to ??
    [sales[sales.length - 1]?.orderDate, invoices[invoices.length - 1]?.invoiceDate]
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0] ??
    new Date();

  return {
    periodLabel: rangeLabel,
    startDate: periodStart,
    endDate: periodEnd,
    onlineSaleCount,
    invoiceCount,
    saleCount: onlineSaleCount + invoiceCount,
    onlineRevenue,
    offlineRevenue,
    grossRevenue,
    totalCogs,
    totalShipping,
    totalPlatformFees,
    totalTax,
    grossProfit,
    totalExpenses,
    excludedAutoExpenses,
    netProfit,
    netMarginPercent,
  };
}

/** Input tax (ITC) from online sales — purchase / COGS only. */
export function computeSaleInputTaxTotal(sales: Sale[]): number {
  return roundMoney(
    sales.reduce((sum, s) => sum + (s.economics.purchaseTaxAmount ?? 0), 0)
  );
}

/** Output tax collected on online sales. */
export function computeOutputTaxTotal(sales: Sale[]): number {
  return roundMoney(sales.reduce((sum, s) => sum + s.economics.taxAmount, 0));
}

/** Output tax collected on offline invoices. */
export function computeInvoiceOutputTaxTotal(invoices: Invoice[]): number {
  return roundMoney(invoices.reduce((sum, i) => sum + i.taxAmount, 0));
}

/** Input tax (ITC) from expenses where tax was tracked. */
export function computeInputTaxTotal(expenses: Expense[]): number {
  return roundMoney(expenses.reduce((sum, e) => sum + (e.taxAmount ?? 0), 0));
}

export interface TaxLedgerSummary {
  outputTax: number;
  onlineOutputTax: number;
  offlineOutputTax: number;
  inputTax: number;
  saleInputTax: number;
  expenseInputTax: number;
  netTax: number;
}

export function computeTaxLedger(
  sales: Sale[],
  invoices: Invoice[],
  expenses: Expense[]
): TaxLedgerSummary {
  const onlineOutputTax = computeOutputTaxTotal(sales);
  const offlineOutputTax = computeInvoiceOutputTaxTotal(invoices);
  const outputTax = roundMoney(onlineOutputTax + offlineOutputTax);
  const saleInputTax = computeSaleInputTaxTotal(sales);
  const expenseInputTax = computeInputTaxTotal(expenses);
  const inputTax = roundMoney(saleInputTax + expenseInputTax);
  return {
    outputTax,
    onlineOutputTax,
    offlineOutputTax,
    inputTax,
    saleInputTax,
    expenseInputTax,
    netTax: roundMoney(outputTax - inputTax),
  };
}

export interface ProductReportRow {
  productId: string;
  productName: string;
  saleCount: number;
  revenue: number;
  profit: number;
  marginPercent: number;
}

export function computeByProduct(sales: Sale[], invoices: Invoice[] = []): ProductReportRow[] {
  const map = new Map<string, ProductReportRow>();

  const add = (productId: string, productName: string, revenue: number, profit: number) => {
    const existing = map.get(productId);
    if (existing) {
      existing.saleCount += 1;
      existing.revenue = roundMoney(existing.revenue + revenue);
      existing.profit = roundMoney(existing.profit + profit);
    } else {
      map.set(productId, {
        productId,
        productName,
        saleCount: 1,
        revenue,
        profit,
        marginPercent: 0,
      });
    }
  };

  for (const sale of sales) {
    for (const line of getSaleLineMetrics(sale)) {
      add(line.productId, line.productName, line.revenue, line.profit);
    }
  }

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const lineRevenue = line.lineTotal;
      const lineCogs = roundMoney(line.purchasePrice * line.quantity);
      const lineProfit = roundMoney(lineRevenue - lineCogs);
      add(line.productId, line.productName, lineRevenue, lineProfit);
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      marginPercent: row.revenue > 0 ? roundMoney((row.profit / row.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

export interface PlatformReportRow {
  platform: string;
  saleCount: number;
  revenue: number;
  profit: number;
  marginPercent: number;
}

export function computeByPlatform(sales: Sale[], invoices: Invoice[] = []): PlatformReportRow[] {
  const map = new Map<string, PlatformReportRow>();

  for (const sale of sales) {
    const existing = map.get(sale.platform);
    if (existing) {
      existing.saleCount += 1;
      existing.revenue = roundMoney(existing.revenue + sale.grossRevenue);
      existing.profit = roundMoney(existing.profit + sale.profit);
    } else {
      map.set(sale.platform, {
        platform: sale.platform,
        saleCount: 1,
        revenue: sale.grossRevenue,
        profit: sale.profit,
        marginPercent: 0,
      });
    }
  }

  if (invoices.length > 0) {
    const directRevenue = roundMoney(invoices.reduce((sum, i) => sum + i.total, 0));
    const directProfit = roundMoney(invoices.reduce((sum, i) => sum + i.profit, 0));
    map.set(OFFLINE_SALES_CHANNEL, {
      platform: OFFLINE_SALES_CHANNEL,
      saleCount: invoices.length,
      revenue: directRevenue,
      profit: directProfit,
      marginPercent:
        directRevenue > 0 ? roundMoney((directProfit / directRevenue) * 100) : 0,
    });
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      marginPercent: row.revenue > 0 ? roundMoney((row.profit / row.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

export interface ExpenseCategoryRow {
  category: string;
  count: number;
  total: number;
  excludedFromNetProfit: boolean;
}

export function computeByExpenseCategory(expenses: Expense[]): ExpenseCategoryRow[] {
  const map = new Map<string, ExpenseCategoryRow>();

  for (const expense of expenses) {
    const excluded = isExpenseExcludedFromNetProfit(expense);
    const existing = map.get(expense.category);
    if (existing) {
      existing.count += 1;
      existing.total = roundMoney(existing.total + expense.amount);
      existing.excludedFromNetProfit = existing.excludedFromNetProfit && excluded;
    } else {
      map.set(expense.category, {
        category: expense.category,
        count: 1,
        total: expense.amount,
        excludedFromNetProfit: excluded,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export type TrendGranularity = 'daily' | 'monthly';

export interface TrendRow {
  key: string;
  label: string;
  revenue: number;
  orderProfit: number;
  expenses: number;
  netProfit: number;
}

export interface ReturnStats {
  returnedCount: number;
  returnRatePercent: number;
  totalReturnCharges: number;
  cancelledCount: number;
  totalCancellationCharges: number;
}

export interface StockSummary {
  productCount: number;
  totalUnits: number;
  totalValue: number;
}

export function computeStockSummary(stock: ProductStock[]): StockSummary {
  const active = stock.filter((s) => s.quantityOnHand > 0);
  return {
    productCount: active.length,
    totalUnits: active.reduce((sum, s) => sum + s.quantityOnHand, 0),
    totalValue: roundMoney(active.reduce((sum, s) => sum + s.totalValue, 0)),
  };
}

export interface StockReportRow {
  productId: string;
  productName: string;
  sku?: string;
  quantityOnHand: number;
  avgPurchasePrice: number;
  avgSellingPrice: number;
  totalValue: number;
  lastReceivedAt?: Date;
}

export function computeStockReport(
  stock: ProductStock[],
  skuByProductId: Map<string, string | undefined> = new Map(),
  options?: { inStockOnly?: boolean }
): StockReportRow[] {
  let rows: StockReportRow[] = stock.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    sku: skuByProductId.get(item.productId),
    quantityOnHand: item.quantityOnHand,
    avgPurchasePrice: item.avgPurchasePrice,
    avgSellingPrice: item.avgSellingPrice,
    totalValue: item.totalValue,
    lastReceivedAt: item.lastReceivedAt,
  }));

  if (options?.inStockOnly !== false) {
    rows = rows.filter((row) => row.quantityOnHand > 0);
  }

  return rows.sort(
    (a, b) => b.totalValue - a.totalValue || a.productName.localeCompare(b.productName)
  );
}

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(y, m - 1, d)
  );
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(
    new Date(y, m - 1, 1)
  );
}

export function computeReturnStats(sales: Sale[]): ReturnStats {
  const returnedCount = sales.filter((s) => s.status === 'returned').length;
  const cancelledCount = sales.filter((s) => s.status === 'cancelled').length;
  const returnRatePercent =
    sales.length > 0 ? roundMoney((returnedCount / sales.length) * 100) : 0;
  const totalReturnCharges = roundMoney(
    sales.reduce((sum, s) => sum + (s.returnCharges ?? 0), 0)
  );
  const totalCancellationCharges = roundMoney(
    sales.reduce((sum, s) => sum + (s.cancellationCharges ?? 0), 0)
  );
  return {
    returnedCount,
    returnRatePercent,
    totalReturnCharges,
    cancelledCount,
    totalCancellationCharges,
  };
}

export function trendGranularityForPreset(preset: ReportPreset): TrendGranularity {
  return preset === 'year' || preset === 'all' ? 'monthly' : 'daily';
}

export function computeTrend(
  sales: Sale[],
  invoices: Invoice[],
  expenses: Expense[],
  granularity: TrendGranularity
): TrendRow[] {
  const map = new Map<string, TrendRow>();
  const operatingExpenses = filterOperatingExpenses(expenses);

  const ensure = (key: string): TrendRow => {
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        label: granularity === 'daily' ? formatDayLabel(key) : formatMonthLabel(key),
        revenue: 0,
        orderProfit: 0,
        expenses: 0,
        netProfit: 0,
      };
      map.set(key, row);
    }
    return row;
  };

  for (const sale of sales) {
    const key = granularity === 'daily' ? localDayKey(sale.orderDate) : localMonthKey(sale.orderDate);
    const row = ensure(key);
    row.revenue = roundMoney(row.revenue + sale.grossRevenue);
    row.orderProfit = roundMoney(row.orderProfit + sale.profit);
  }

  for (const invoice of invoices) {
    const key =
      granularity === 'daily' ? localDayKey(invoice.invoiceDate) : localMonthKey(invoice.invoiceDate);
    const row = ensure(key);
    row.revenue = roundMoney(row.revenue + invoice.total);
    row.orderProfit = roundMoney(row.orderProfit + invoice.profit);
  }

  for (const expense of operatingExpenses) {
    const key =
      granularity === 'daily' ? localDayKey(expense.expenseDate) : localMonthKey(expense.expenseDate);
    const row = ensure(key);
    row.expenses = roundMoney(row.expenses + expense.amount);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      netProfit: roundMoney(row.orderProfit - row.expenses),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
