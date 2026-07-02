import { ReportId, type ReportId as ReportIdType } from '../constants/reportCatalog';
import type { Expense, Invoice, PeriodProfitSummary, Product, ProductStock, Sale } from '../types';
import { formatDateLocal } from './date';
import {
  computeByExpenseCategory,
  computeByPlatform,
  computeByProduct,
  computeStockReport,
  computeStockSummary,
  computeTaxLedger,
  computeTrend,
  filterOperatingExpenses,
  type TrendGranularity,
} from './reports';
import type { WorkbookSheet } from './exportSpreadsheet';

export interface ReportExportContext {
  reportId: ReportIdType;
  reportTitle: string;
  currency: string;
  dateRangeLabel: string;
  filteredSales: Sale[];
  filteredInvoices: Invoice[];
  filteredExpenses: Expense[];
  stock: ProductStock[];
  products: Product[];
  summary: PeriodProfitSummary;
  trendGranularity?: TrendGranularity;
}

function metaRows(title: string, period: string, currency: string): WorkbookSheet['rows'] {
  return [
    [title],
    ['Period', period],
    ['Currency', currency],
    [],
  ];
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
    ...metaRows(`${ctx.reportTitle} (${granularity})`, ctx.dateRangeLabel, ctx.currency),
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
      const lines = [
        ['Line item', 'Amount'],
        ['Gross revenue', ctx.summary.grossRevenue],
        ...(ctx.summary.offlineRevenue > 0
          ? [
              ['  Online sales', ctx.summary.onlineRevenue],
              ['  Offline invoices', ctx.summary.offlineRevenue],
            ]
          : []),
        ['Cost of goods (COGS)', -ctx.summary.totalCogs],
        ['Shipping (online)', -ctx.summary.totalShipping],
        ['Platform fees (online)', -ctx.summary.totalPlatformFees],
        ['Tax collected', -ctx.summary.totalTax],
        ['Order / invoice profit', ctx.summary.grossProfit],
        ['Operating expenses', -ctx.summary.totalExpenses],
        ['Net profit', ctx.summary.netProfit],
        [],
        ['Net margin %', ctx.summary.netMarginPercent],
      ];

      return [
        {
          name: 'Profit and Loss',
          rows: [...metaRows(ctx.reportTitle, ctx.dateRangeLabel, ctx.currency), ...lines],
        },
      ];
    }

    case ReportId.SALES_BY_PRODUCT: {
      const rows = computeByProduct(ctx.filteredSales, ctx.filteredInvoices);
      return [
        {
          name: 'Sales by product',
          rows: [
            ...metaRows(ctx.reportTitle, ctx.dateRangeLabel, ctx.currency),
            ['Product', 'Lines', 'Revenue', 'Profit', 'Margin %'],
            ...rows.map((row) => [
              row.productName,
              row.saleCount,
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
            ...metaRows(ctx.reportTitle, ctx.dateRangeLabel, ctx.currency),
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
            ...metaRows(ctx.reportTitle, ctx.dateRangeLabel, ctx.currency),
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
            ...metaRows(ctx.reportTitle, ctx.dateRangeLabel, ctx.currency),
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

    case ReportId.STOCK_ON_HAND: {
      const skuMap = new Map(ctx.products.map((product) => [product.id, product.sku]));
      const rows = computeStockReport(ctx.stock, skuMap);
      const stockSummary = computeStockSummary(ctx.stock);

      return [
        {
          name: 'Stock on hand',
          rows: [
            ...metaRows(ctx.reportTitle, 'As of today', ctx.currency),
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

  return (
    ctx.filteredSales.length > 0 ||
    ctx.filteredInvoices.length > 0 ||
    ctx.filteredExpenses.length > 0
  );
}
