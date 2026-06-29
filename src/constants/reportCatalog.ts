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
    description: 'Revenue, fulfillment costs, order profit, operating expenses, and net profit.',
  },
  {
    id: ReportId.SALES_BY_PRODUCT,
    title: 'Sales by product',
    description: 'Revenue, profit, and margin for each product in the selected period.',
  },
  {
    id: ReportId.SALES_BY_PLATFORM,
    title: 'Sales by platform',
    description: 'Compare orders, revenue, and profitability across marketplaces.',
  },
  {
    id: ReportId.EXPENSE_BREAKDOWN,
    title: 'Expense breakdown',
    description: 'Operating costs grouped by category, including auto-generated sale fees.',
  },
  {
    id: ReportId.TAX_SUMMARY,
    title: 'GST / VAT summary',
    description: 'Output tax collected on sales vs input tax (ITC) from purchases and expenses.',
  },
  {
    id: ReportId.TREND,
    title: 'Profit trend',
    description: 'Revenue, order profit, expenses, and net profit over time.',
  },
];

export function getReportDefinition(id: string | undefined): ReportDefinition | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}
