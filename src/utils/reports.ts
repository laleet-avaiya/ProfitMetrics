import type { Expense, PeriodProfitSummary, Sale } from '../types';
import {
  localDateInputToUtc,
  localDateInputToUtcEndOfDay,
  utcToLocalDateInput,
} from './firestoreDates';
import { isDateInRange } from './expenseHelpers';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ReportPreset = '7d' | '30d' | 'month' | 'year' | 'all' | 'custom';

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

function saleCogs(sale: Sale): number {
  return roundMoney(sale.economics.purchasePrice * sale.quantity);
}

function saleShipping(sale: Sale): number {
  return roundMoney(sale.economics.shippingCost * sale.quantity);
}

export function computePeriodSummary(
  sales: Sale[],
  expenses: Expense[],
  rangeLabel: string,
  from?: Date,
  to?: Date
): PeriodProfitSummary {
  const grossRevenue = roundMoney(sales.reduce((sum, s) => sum + s.grossRevenue, 0));
  const totalCogs = roundMoney(sales.reduce((sum, s) => sum + saleCogs(s), 0));
  const totalShipping = roundMoney(sales.reduce((sum, s) => sum + saleShipping(s), 0));
  const totalPlatformFees = roundMoney(sales.reduce((sum, s) => sum + s.platformFees, 0));
  const totalTax = roundMoney(sales.reduce((sum, s) => sum + s.economics.taxAmount, 0));
  const grossProfit = roundMoney(sales.reduce((sum, s) => sum + s.profit, 0));
  const totalExpenses = roundMoney(expenses.reduce((sum, e) => sum + e.amount, 0));
  const netProfit = roundMoney(grossProfit - totalExpenses);
  const netMarginPercent =
    grossRevenue > 0 ? roundMoney((netProfit / grossRevenue) * 100) : 0;

  return {
    periodLabel: rangeLabel,
    startDate: from ?? (sales[0]?.orderDate ?? new Date()),
    endDate: to ?? (sales[sales.length - 1]?.orderDate ?? new Date()),
    saleCount: sales.length,
    grossRevenue,
    totalCogs,
    totalShipping,
    totalPlatformFees,
    totalTax,
    grossProfit,
    totalExpenses,
    netProfit,
    netMarginPercent,
  };
}

/** Input tax (ITC) from sales — purchase / COGS only (platform, delivery, and outcome fees are expenses). */
export function computeSaleInputTaxTotal(sales: Sale[]): number {
  return roundMoney(
    sales.reduce((sum, s) => sum + (s.economics.purchaseTaxAmount ?? 0), 0)
  );
}

/** Output tax collected on sales (for GST/VAT return comparison). */
export function computeOutputTaxTotal(sales: Sale[]): number {
  return roundMoney(sales.reduce((sum, s) => sum + s.economics.taxAmount, 0));
}

/** Input tax (ITC) from expenses where tax was tracked. */
export function computeInputTaxTotal(expenses: Expense[]): number {
  return roundMoney(expenses.reduce((sum, e) => sum + (e.taxAmount ?? 0), 0));
}

export interface TaxLedgerSummary {
  outputTax: number;
  inputTax: number;
  saleInputTax: number;
  expenseInputTax: number;
  netTax: number;
}

export function computeTaxLedger(sales: Sale[], expenses: Expense[]): TaxLedgerSummary {
  const outputTax = computeOutputTaxTotal(sales);
  const saleInputTax = computeSaleInputTaxTotal(sales);
  const expenseInputTax = computeInputTaxTotal(expenses);
  const inputTax = roundMoney(saleInputTax + expenseInputTax);
  return {
    outputTax,
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

export function computeByProduct(sales: Sale[]): ProductReportRow[] {
  const map = new Map<string, ProductReportRow>();

  for (const sale of sales) {
    const existing = map.get(sale.productId);
    if (existing) {
      existing.saleCount += 1;
      existing.revenue = roundMoney(existing.revenue + sale.grossRevenue);
      existing.profit = roundMoney(existing.profit + sale.profit);
    } else {
      map.set(sale.productId, {
        productId: sale.productId,
        productName: sale.productName,
        saleCount: 1,
        revenue: sale.grossRevenue,
        profit: sale.profit,
        marginPercent: 0,
      });
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

export function computeByPlatform(sales: Sale[]): PlatformReportRow[] {
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
}

export function computeByExpenseCategory(expenses: Expense[]): ExpenseCategoryRow[] {
  const map = new Map<string, ExpenseCategoryRow>();

  for (const expense of expenses) {
    const existing = map.get(expense.category);
    if (existing) {
      existing.count += 1;
      existing.total = roundMoney(existing.total + expense.amount);
    } else {
      map.set(expense.category, {
        category: expense.category,
        count: 1,
        total: expense.amount,
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
  expenses: Expense[],
  granularity: TrendGranularity
): TrendRow[] {
  const map = new Map<string, TrendRow>();

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

  for (const expense of expenses) {
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
