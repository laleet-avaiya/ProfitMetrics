export const ReportId = {
  PROFIT_LOSS: 'profit-loss',
  SALES_BY_PRODUCT: 'sales-by-product',
  SALES_BY_PLATFORM: 'sales-by-platform',
  EXPENSE_BREAKDOWN: 'expense-breakdown',
  TAX_SUMMARY: 'tax-summary',
  TREND: 'trend',
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
    description: 'Online sales, offline invoices, order profit, operating expenses, and net profit.',
  },
  {
    id: ReportId.SALES_BY_PRODUCT,
    title: 'Sales by product',
    description: 'Revenue, profit, and margin per product from online orders and offline invoices.',
  },
  {
    id: ReportId.SALES_BY_PLATFORM,
    title: 'Sales by channel',
    description: 'Compare online marketplaces vs invoices by revenue and profit.',
  },
  {
    id: ReportId.EXPENSE_BREAKDOWN,
    title: 'Expense breakdown',
    description: 'Operating costs by category. Sale fees and inventory purchases are tracked separately.',
  },
  {
    id: ReportId.TAX_SUMMARY,
    title: 'GST / VAT summary',
    description: 'Output tax on online sales and invoices vs input tax (ITC) from expenses.',
  },
  {
    id: ReportId.TREND,
    title: 'Profit trend',
    description: 'Revenue, order profit, expenses, and net profit over time (online + offline).',
  },
];

export function getReportDefinition(id: string | undefined): ReportDefinition | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}
