export const ReportId = {
  PROFIT_LOSS: 'profit-loss',
  GROSS_PROFIT: 'gross-profit',
  SALES_BY_PRODUCT: 'sales-by-product',
  SALES_BY_PLATFORM: 'sales-by-platform',
  EXPENSE_BREAKDOWN: 'expense-breakdown',
  TAX_SUMMARY: 'tax-summary',
  TREND: 'trend',
  STOCK_ON_HAND: 'stock-on-hand',
  PURCHASE_ORDERS: 'purchase-orders',
  PURCHASE_TREND: 'purchase-trend',
} as const;

export type ReportId = (typeof ReportId)[keyof typeof ReportId];

export interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
}

export const REPORT_CATALOG: ReportDefinition[] = [
  {
    id: ReportId.PROFIT_LOSS,
    title: 'Profit & Loss',
    description: 'Sales revenue, order profit, operating expenses, and net profit.',
  },
  {
    id: ReportId.GROSS_PROFIT,
    title: 'Gross profit',
    description: 'Revenue minus cost of goods sold (COGS) and gross margin.',
  },
  {
    id: ReportId.SALES_BY_PRODUCT,
    title: 'Product-wise profit',
    description: 'Units, COGS, revenue, profit, and margin per product.',
  },
  {
    id: ReportId.SALES_BY_PLATFORM,
    title: 'Sales by platform',
    description: 'Compare platforms by revenue and profit.',
  },
  {
    id: ReportId.EXPENSE_BREAKDOWN,
    title: 'Expense breakdown',
    description: 'Operating costs by category. Sale fees and inventory purchases are tracked separately.',
  },
  {
    id: ReportId.TAX_SUMMARY,
    title: 'GST / VAT summary',
    description: 'Output tax on sales vs input tax (ITC) from expenses.',
  },
  {
    id: ReportId.TREND,
    title: 'Profit trend',
    description: 'Revenue, order profit, expenses, and net profit over time.',
  },
  {
    id: ReportId.STOCK_ON_HAND,
    title: 'Stock on hand',
    description: 'Current inventory — quantities, average cost, selling price, and stock value by product.',
  },
  {
    id: ReportId.PURCHASE_ORDERS,
    title: 'Purchase orders',
    description: 'PO totals, receipt status, and payment status (paid, partial, unpaid) by order date.',
  },
  {
    id: ReportId.PURCHASE_TREND,
    title: 'Purchases (month / year)',
    description: 'Purchase totals, paid, and balance due grouped by month or year.',
  },
];

export function getReportDefinition(id: string | undefined): ReportDefinition | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}
