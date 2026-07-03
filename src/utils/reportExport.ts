import { ReportId, type ReportId as ReportIdType } from '../constants/reportCatalog';
import { getCountryProfile, isBusinessCountry } from '../constants/countries';
import type { Company, Expense, Invoice, PeriodProfitSummary, Product, ProductStock, PurchaseOrder, Sale } from '../types';
import { formatDateLocal, formatDateTimeLocal } from './date';
import { purchasePaymentStatusLabel, purchaseStatusLabel } from '../constants/purchaseStatuses';
import {
  computeByExpenseCategory,
  computeByPlatform,
  computeByProduct,
  computeGrossProfit,
  computePurchaseReportRows,
  computePurchaseReportSummary,
  computePurchaseTrend,
  computeStockReport,
  computeStockSummary,
  computeTaxLedger,
  computeTrend,
  filterOperatingExpenses,
  buildProfitLossStatement,
  type ProfitLossBasis,
  type TrendGranularity,
} from './reports';
import type { WorkbookSheet } from './exportSpreadsheet';

export interface ReportCompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  taxIdLabel?: string;
  countryLabel?: string;
}

export function buildReportCompanyInfo(company: Company | null | undefined): ReportCompanyInfo {
  const profile =
    company && isBusinessCountry(company.country) ? getCountryProfile(company.country) : null;

  return {
    name: company?.name?.trim() || 'Company',
    address: company?.address?.trim() || undefined,
    phone: company?.phone?.trim() || undefined,
    email: company?.email?.trim() || undefined,
    taxId: company?.trn?.trim() || undefined,
    taxIdLabel: profile?.taxIdLabel,
    countryLabel: profile?.label,
  };
}

export interface ReportExportContext {
  reportId: ReportIdType;
  reportTitle: string;
  company: ReportCompanyInfo;
  currency: string;
  dateRangeLabel: string;
  filteredSales: Sale[];
  filteredInvoices: Invoice[];
  filteredExpenses: Expense[];
  filteredPurchases: PurchaseOrder[];
  stock: ProductStock[];
  products: Product[];
  summary: PeriodProfitSummary;
  plBasis?: ProfitLossBasis;
  trendGranularity?: TrendGranularity;
}

function metaRows(
  ctx: ReportExportContext,
  options?: { title?: string; period?: string }
): WorkbookSheet['rows'] {
  const { company } = ctx;
  const title = options?.title ?? ctx.reportTitle;
  const period = options?.period ?? ctx.dateRangeLabel;

  const rows: WorkbookSheet['rows'] = [[company.name]];

  if (company.address) rows.push([company.address]);

  const contactParts = [company.phone, company.email].filter(Boolean);
  if (contactParts.length > 0) rows.push([contactParts.join(' · ')]);

  if (company.taxId) {
    const taxLabel = company.taxIdLabel ?? 'Tax ID';
    rows.push([`${taxLabel}: ${company.taxId}`]);
  }

  if (company.countryLabel) rows.push([company.countryLabel]);

  rows.push(
    [],
    [title],
    ['Period', period],
    ['Currency', ctx.currency],
    ['Generated', formatDateTimeLocal(new Date())],
    []
  );

  return rows;
}

function trendSheetRows(
  ctx: ReportExportContext,
  granularity: TrendGranularity
): WorkbookSheet['rows'] {
  const trend = computeTrend(
    ctx.filteredSales,
    ctx.filteredInvoices,
    ctx.filteredExpenses,
    granularity
  );

  return [
    ...metaRows(ctx, { title: `${ctx.reportTitle} (${granularity})` }),
    ['Period', 'Revenue', 'Order profit', 'Operating expenses', 'Net profit'],
    ...trend.map((row) => [
      row.label,
      row.revenue,
      row.orderProfit,
      row.expenses,
      row.netProfit,
    ]),
  ];
}

export function buildReportWorkbook(ctx: ReportExportContext): WorkbookSheet[] {
  const operatingExpenses = filterOperatingExpenses(ctx.filteredExpenses);
  const operatingExpenseTotal = operatingExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  switch (ctx.reportId) {
    case ReportId.PROFIT_LOSS: {
      const basis = ctx.plBasis ?? 'paid';
      const statement = buildProfitLossStatement(ctx.summary, ctx.filteredPurchases, basis);
      const lines = [
        ['Basis', statement.basisLabel],
        [],
        ['Line item', 'Amount'],
        ...statement.lines.map((line) => [line.label, line.value]),
        [],
        ['Net margin %', statement.netMarginPercent],
      ];

      if (statement.pendingPoCount > 0 && basis === 'with-pending-po') {
        lines.splice(3, 0, ['Pending POs (unpaid balance)', statement.pendingPoCount]);
      }

      return [
        {
          name: 'Profit and Loss',
          rows: [
            ...metaRows(ctx, { title: `${ctx.reportTitle} — ${statement.basisLabel}` }),
            ...lines,
          ],
        },
      ];
    }

    case ReportId.GROSS_PROFIT: {
      const gp = computeGrossProfit(ctx.filteredSales, ctx.filteredInvoices);
      return [
        {
          name: 'Gross profit',
          rows: [
            ...metaRows(ctx),
            ['Line item', 'Amount'],
            ['Revenue — online sales', gp.onlineRevenue],
            ...(gp.offlineRevenue > 0 ? [['Revenue — offline invoices', gp.offlineRevenue]] : []),
            ['Gross revenue', gp.grossRevenue],
            ['COGS — online sales', -gp.onlineCogs],
            ...(gp.offlineCogs > 0 ? [['COGS — offline invoices', -gp.offlineCogs]] : []),
            ['Total COGS', -gp.totalCogs],
            ['Gross profit', gp.grossProfit],
            ['Gross margin %', gp.grossMarginPercent],
            [],
            ['Channel', 'Revenue', 'COGS', 'Gross profit', 'Margin %'],
            ['Online sales', gp.onlineRevenue, gp.onlineCogs, gp.onlineGrossProfit, gp.onlineMarginPercent],
            ['Offline invoices', gp.offlineRevenue, gp.offlineCogs, gp.offlineGrossProfit, gp.offlineMarginPercent],
          ],
        },
      ];
    }

    case ReportId.SALES_BY_PRODUCT: {
      const rows = computeByProduct(ctx.filteredSales, ctx.filteredInvoices);
      return [
        {
          name: 'Product-wise profit',
          rows: [
            ...metaRows(ctx),
            ['Product', 'Units', 'COGS', 'Revenue', 'Profit', 'Margin %'],
            ...rows.map((row) => [
              row.productName,
              row.unitsSold,
              row.cogs,
              row.revenue,
              row.profit,
              row.marginPercent,
            ]),
          ],
        },
      ];
    }

    case ReportId.SALES_BY_PLATFORM: {
      const rows = computeByPlatform(ctx.filteredSales, ctx.filteredInvoices);
      return [
        {
          name: 'Sales by channel',
          rows: [
            ...metaRows(ctx),
            ['Channel', 'Count', 'Revenue', 'Profit', 'Margin %'],
            ...rows.map((row) => [
              row.platform,
              row.saleCount,
              row.revenue,
              row.profit,
              row.marginPercent,
            ]),
          ],
        },
      ];
    }

    case ReportId.EXPENSE_BREAKDOWN: {
      const rows = computeByExpenseCategory(ctx.filteredExpenses);
      return [
        {
          name: 'Expense breakdown',
          rows: [
            ...metaRows(ctx),
            ['Category', 'Count', 'Total', 'Share %', 'Excluded from net profit'],
            ...rows.map((row) => [
              row.category,
              row.count,
              row.total,
              operatingExpenseTotal > 0 && !row.excludedFromNetProfit
                ? (row.total / operatingExpenseTotal) * 100
                : '',
              row.excludedFromNetProfit ? 'Yes' : 'No',
            ]),
          ],
        },
      ];
    }

    case ReportId.TAX_SUMMARY: {
      const taxLedger = computeTaxLedger(
        ctx.filteredSales,
        ctx.filteredInvoices,
        ctx.filteredExpenses
      );

      return [
        {
          name: 'Tax summary',
          rows: [
            ...metaRows(ctx),
            ['Line item', 'Amount'],
            ['Output tax — online sales', taxLedger.onlineOutputTax],
            ...(taxLedger.offlineOutputTax > 0
              ? [['Output tax — offline invoices', taxLedger.offlineOutputTax]]
              : []),
            ['Total output tax', taxLedger.outputTax],
            ['Input tax — purchase / COGS (ITC)', -taxLedger.saleInputTax],
            ['Input tax — expenses (ITC)', -taxLedger.expenseInputTax],
            ['Total input tax (ITC)', -taxLedger.inputTax],
            ['Net tax payable', taxLedger.netTax],
          ],
        },
      ];
    }

    case ReportId.TREND:
      return [
        { name: 'Daily trend', rows: trendSheetRows(ctx, 'daily') },
        { name: 'Monthly trend', rows: trendSheetRows(ctx, 'monthly') },
      ];

    case ReportId.PURCHASE_ORDERS: {
      const rows = computePurchaseReportRows(ctx.filteredPurchases);
      const purchaseSummary = computePurchaseReportSummary(ctx.filteredPurchases);

      return [
        {
          name: 'Purchase orders',
          rows: [
            ...metaRows(ctx),
            ['Summary', 'Value'],
            ['Purchase orders', purchaseSummary.count],
            ['Total value', purchaseSummary.totalValue],
            ['Total paid', purchaseSummary.totalPaid],
            ['Balance due', purchaseSummary.balanceDue],
            ['Unpaid', purchaseSummary.unpaidCount],
            ['Partially paid', purchaseSummary.partialCount],
            ['Paid', purchaseSummary.paidCount],
            [],
            [
              'Date',
              'PO #',
              'Vendor',
              'Reference',
              'Status',
              'Payment',
              'Lines',
              'Subtotal',
              'Tax',
              'Total',
              'Paid',
              'Balance',
            ],
            ...rows.map((row) => [
              formatDateLocal(row.purchaseDate),
              row.poNumber,
              row.vendorName,
              row.reference,
              purchaseStatusLabel(row.status),
              purchasePaymentStatusLabel(row.paymentStatus),
              row.lineCount,
              row.subtotal,
              row.taxAmount,
              row.total,
              row.totalPaid,
              row.balanceDue,
            ]),
          ],
        },
      ];
    }

    case ReportId.PURCHASE_TREND: {
      const buildRows = (granularity: 'monthly' | 'yearly'): WorkbookSheet['rows'] => {
        const trend = computePurchaseTrend(ctx.filteredPurchases, granularity);
        return [
          ...metaRows(ctx, {
            title: `${ctx.reportTitle} (${granularity === 'monthly' ? 'monthly' : 'yearly'})`,
          }),
          ['Period', 'POs', 'Total value', 'Paid', 'Balance due'],
          ...trend.map((row) => [
            row.label,
            row.count,
            row.totalValue,
            row.totalPaid,
            row.balanceDue,
          ]),
        ];
      };

      return [
        { name: 'Monthly purchases', rows: buildRows('monthly') },
        { name: 'Yearly purchases', rows: buildRows('yearly') },
      ];
    }

    case ReportId.STOCK_ON_HAND: {
      const skuMap = new Map(ctx.products.map((product) => [product.id, product.sku]));
      const rows = computeStockReport(ctx.stock, skuMap);
      const stockSummary = computeStockSummary(ctx.stock);

      return [
        {
          name: 'Stock on hand',
          rows: [
            ...metaRows(ctx, { period: 'As of today' }),
            ['Summary', 'Value'],
            ['Products in stock', stockSummary.productCount],
            ['Total units', stockSummary.totalUnits],
            ['Total stock value', stockSummary.totalValue],
            [],
            ['Product', 'SKU', 'Qty on hand', 'Avg cost', 'Avg selling price', 'Stock value', 'Last received'],
            ...rows.map((row) => [
              row.productName,
              row.sku ?? '',
              row.quantityOnHand,
              row.avgPurchasePrice,
              row.avgSellingPrice,
              row.totalValue,
              row.lastReceivedAt ? formatDateLocal(row.lastReceivedAt) : '',
            ]),
          ],
        },
      ];
    }

    default:
      return [];
  }
}

export function canExportReport(ctx: ReportExportContext): boolean {
  if (ctx.reportId === ReportId.STOCK_ON_HAND) {
    return computeStockReport(
      ctx.stock,
      new Map(ctx.products.map((product) => [product.id, product.sku]))
    ).length > 0;
  }

  if (ctx.reportId === ReportId.PURCHASE_ORDERS || ctx.reportId === ReportId.PURCHASE_TREND) {
    return ctx.filteredPurchases.length > 0;
  }

  return (
    ctx.filteredSales.length > 0 ||
    ctx.filteredInvoices.length > 0 ||
    ctx.filteredExpenses.length > 0
  );
}
