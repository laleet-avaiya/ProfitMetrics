import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { emptyStateClass } from '../../constants/ui';
import type { ReportId } from '../../constants/reportCatalog';
import type { Expense, Invoice, PeriodProfitSummary, Sale } from '../../types';
import { formatMoney, formatPercent } from '../../utils/profit';
import {
  computeByExpenseCategory,
  computeByPlatform,
  computeByProduct,
  computeTaxLedger,
  computeTrend,
  filterOperatingExpenses,
  type TrendGranularity,
} from '../../utils/reports';

export function profitClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-900 dark:text-white';
}

function ReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {children}
    </Card>
  );
}

function EmptyReport({ message }: { message: string }) {
  return <p className={emptyStateClass}>{message}</p>;
}

function TrendBars({
  rows,
  currency,
  metric,
}: {
  rows: ReturnType<typeof computeTrend>;
  currency: string;
  metric: 'revenue' | 'orderProfit' | 'expenses' | 'netProfit';
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r[metric])), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const value = row[metric];
        const width = Math.max(2, (Math.abs(value) / max) * 100);
        return (
          <div
            key={row.key}
            className="grid grid-cols-[72px_1fr_88px] sm:grid-cols-[96px_1fr_112px] gap-2 items-center text-xs"
          >
            <span className="text-gray-500 dark:text-gray-400 truncate">{row.label}</span>
            <div className="h-6 bg-gray-100 dark:bg-gray-900/50 rounded-md overflow-hidden">
              <div
                className={`h-full rounded-md transition-all ${
                  value >= 0 ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-red-400 dark:bg-red-500'
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className={`text-right tabular-nums font-medium ${profitClass(value)}`}>
              {formatMoney(value, currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ReportContentProps {
  reportId: ReportId;
  currency: string;
  filteredSales: Sale[];
  filteredInvoices: Invoice[];
  filteredExpenses: Expense[];
  summary: PeriodProfitSummary;
  hasData: boolean;
}

export function ReportContent({
  reportId,
  currency,
  filteredSales,
  filteredInvoices,
  filteredExpenses,
  summary,
  hasData,
}: ReportContentProps) {
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('daily');

  const operatingExpenses = useMemo(
    () => filterOperatingExpenses(filteredExpenses),
    [filteredExpenses]
  );

  const byProduct = useMemo(
    () => computeByProduct(filteredSales, filteredInvoices),
    [filteredSales, filteredInvoices]
  );
  const byPlatform = useMemo(
    () => computeByPlatform(filteredSales, filteredInvoices),
    [filteredSales, filteredInvoices]
  );
  const byCategory = useMemo(
    () => computeByExpenseCategory(filteredExpenses),
    [filteredExpenses]
  );
  const taxLedger = useMemo(
    () => computeTaxLedger(filteredSales, filteredInvoices, filteredExpenses),
    [filteredSales, filteredInvoices, filteredExpenses]
  );
  const trend = useMemo(
    () => computeTrend(filteredSales, filteredInvoices, filteredExpenses, trendGranularity),
    [filteredSales, filteredInvoices, filteredExpenses, trendGranularity]
  );

  const maxExpenseCategory = Math.max(...byCategory.map((c) => c.total), 1);
  const operatingExpenseTotal = useMemo(
    () => operatingExpenses.reduce((sum, e) => sum + e.amount, 0),
    [operatingExpenses]
  );

  if (!hasData) {
    return (
      <EmptyReport message="No sales, invoices, or expenses in this period. Adjust the date range or log more data." />
    );
  }

  switch (reportId) {
    case 'profit-loss': {
      const plLines = [
        { label: 'Gross revenue', value: summary.grossRevenue, emphasize: false },
        ...(summary.offlineRevenue > 0
          ? [
              { label: '  Online sales', value: summary.onlineRevenue, emphasize: false, indent: true },
              { label: '  Offline invoices', value: summary.offlineRevenue, emphasize: false, indent: true },
            ]
          : []),
        { label: 'Cost of goods (COGS)', value: -summary.totalCogs, emphasize: false },
        { label: 'Shipping (online)', value: -summary.totalShipping, emphasize: false },
        { label: 'Platform fees (online)', value: -summary.totalPlatformFees, emphasize: false },
        { label: 'Tax collected', value: -summary.totalTax, emphasize: false },
        { label: 'Order / invoice profit', value: summary.grossProfit, emphasize: true },
        { label: 'Operating expenses', value: -summary.totalExpenses, emphasize: false },
        { label: 'Net profit', value: summary.netProfit, emphasize: true },
      ];

      const orderLabel =
        summary.invoiceCount > 0
          ? `${summary.onlineSaleCount} online · ${summary.invoiceCount} offline`
          : String(summary.saleCount);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Orders / invoices', value: orderLabel },
              { label: 'Revenue', value: formatMoney(summary.grossRevenue, currency) },
              { label: 'Order profit', value: formatMoney(summary.grossProfit, currency) },
              {
                label: 'Net profit',
                value: formatMoney(summary.netProfit, currency),
                valueClass: profitClass(summary.netProfit),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p
                  className={`mt-0.5 text-base font-semibold tabular-nums ${stat.valueClass ?? 'text-gray-900 dark:text-white'}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <ReportSection title="Profit & Loss statement">
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {plLines.map((line) => (
                    <tr
                      key={line.label}
                      className={line.emphasize ? 'bg-gray-50 dark:bg-gray-900/40' : ''}
                    >
                      <td
                        className={`px-4 py-2.5 ${line.emphasize ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'} ${'indent' in line && line.indent ? 'pl-8 text-xs' : ''}`}
                      >
                        {line.label}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums ${line.emphasize ? 'font-bold' : 'font-medium'} ${profitClass(line.value)}`}
                      >
                        {line.value < 0 ? '−' : ''}
                        {formatMoney(Math.abs(line.value), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                      Net margin
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${profitClass(summary.netMarginPercent)}`}
                    >
                      {formatPercent(summary.netMarginPercent)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {summary.excludedAutoExpenses > 0 && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {formatMoney(summary.excludedAutoExpenses, currency)} in auto-generated sale fees and
                inventory purchases is excluded from operating expenses (already in order profit or
                stock).
              </p>
            )}
          </ReportSection>
        </div>
      );
    }

    case 'sales-by-product':
      return (
        <ReportSection
          title="Sales by product"
          description="Online orders and offline invoice line items combined."
        >
          {byProduct.length === 0 ? (
            <EmptyReport message="No sales or invoices in this period." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Lines</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                    <th className="px-3 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {byProduct.map((row) => (
                    <tr key={row.productId}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {row.productName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.saleCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(row.revenue, currency)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-medium ${profitClass(row.profit)}`}
                      >
                        {formatMoney(row.profit, currency)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${profitClass(row.profit)}`}
                      >
                        {formatPercent(row.marginPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>
      );

    case 'sales-by-platform':
      return (
        <ReportSection
          title="Sales by channel"
          description="Online marketplaces vs invoices."
        >
          {byPlatform.length === 0 ? (
            <EmptyReport message="No sales or invoices in this period." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2 text-right">Count</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                    <th className="px-3 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {byPlatform.map((row) => (
                    <tr key={row.platform}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {row.platform}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.saleCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(row.revenue, currency)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-medium ${profitClass(row.profit)}`}
                      >
                        {formatMoney(row.profit, currency)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${profitClass(row.profit)}`}
                      >
                        {formatPercent(row.marginPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>
      );

    case 'expense-breakdown':
      return (
        <ReportSection
          title="Expense breakdown"
          description="All expense categories. Items marked † are excluded from net profit (already in order profit or inventory)."
        >
          {byCategory.length === 0 ? (
            <EmptyReport message="No expenses in this period." />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2 text-right">Count</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {byCategory.map((row) => (
                      <tr key={row.category}>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                          {row.category}
                          {row.excludedFromNetProfit ? (
                            <span className="text-xs text-gray-400 ml-1">†</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatMoney(row.total, currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                          {operatingExpenseTotal > 0 && !row.excludedFromNetProfit
                            ? formatPercent((row.total / operatingExpenseTotal) * 100)
                            : row.excludedFromNetProfit
                              ? '—'
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                {byCategory.map((row) => (
                  <div
                    key={row.category}
                    className="grid grid-cols-[1fr_1fr_80px] gap-2 items-center text-xs"
                  >
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {row.category}
                      {row.excludedFromNetProfit ? ' †' : ''}
                    </span>
                    <div className="h-2 bg-gray-100 dark:bg-gray-900/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 dark:bg-amber-400 rounded-full"
                        style={{ width: `${(row.total / maxExpenseCategory) * 100}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums text-gray-600 dark:text-gray-400">
                      {formatMoney(row.total, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ReportSection>
      );

    case 'tax-summary': {
      const taxLines = [
        { label: 'Output tax — online sales', value: taxLedger.onlineOutputTax, emphasize: false },
        ...(taxLedger.offlineOutputTax > 0
          ? [{ label: 'Output tax — offline invoices', value: taxLedger.offlineOutputTax, emphasize: false }]
          : []),
        { label: 'Total output tax', value: taxLedger.outputTax, emphasize: true },
        { label: 'Input tax — purchase / COGS (ITC)', value: -taxLedger.saleInputTax, emphasize: false },
        { label: 'Input tax — expenses (ITC)', value: -taxLedger.expenseInputTax, emphasize: false },
        { label: 'Total input tax (ITC)', value: -taxLedger.inputTax, emphasize: true },
        { label: 'Net tax payable', value: taxLedger.netTax, emphasize: true },
      ];

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Output tax', value: formatMoney(taxLedger.outputTax, currency) },
              { label: 'Total ITC', value: formatMoney(taxLedger.inputTax, currency) },
              {
                label: 'Net payable',
                value: formatMoney(taxLedger.netTax, currency),
                valueClass: profitClass(-taxLedger.netTax),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p
                  className={`mt-0.5 text-base font-semibold tabular-nums ${stat.valueClass ?? 'text-gray-900 dark:text-white'}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <ReportSection title="Tax ledger">
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {taxLines.map((line) => (
                    <tr
                      key={line.label}
                      className={line.emphasize ? 'bg-gray-50 dark:bg-gray-900/40' : ''}
                    >
                      <td
                        className={`px-4 py-2.5 ${line.emphasize ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        {line.label}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums ${line.emphasize ? 'font-bold' : 'font-medium'} ${profitClass(line.value)}`}
                      >
                        {line.value < 0 ? '−' : ''}
                        {formatMoney(Math.abs(line.value), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Platform fees, delivery, and return/cancellation charges are tracked as expenses with
              ITC. Purchase tax on online COGS is on sales; inventory purchase payments are capitalized
              in stock until sold.
            </p>
          </ReportSection>
        </div>
      );
    }

    case 'trend':
      return (
        <ReportSection title="Profit trend" description="Online sales and offline invoices combined.">
          <div className="flex gap-2 mb-4">
            {(['daily', 'monthly'] as TrendGranularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setTrendGranularity(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  trendGranularity === g
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {g === 'daily' ? 'Daily' : 'Monthly'}
              </button>
            ))}
          </div>

          {trend.length === 0 ? (
            <EmptyReport message="No data points in this period." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Revenue
                </p>
                <TrendBars rows={trend} currency={currency} metric="revenue" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Net profit
                </p>
                <TrendBars rows={trend} currency={currency} metric="netProfit" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Order profit
                </p>
                <TrendBars rows={trend} currency={currency} metric="orderProfit" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Operating expenses
                </p>
                <TrendBars rows={trend} currency={currency} metric="expenses" />
              </div>
            </div>
          )}
        </ReportSection>
      );

    default:
      return <EmptyReport message="Unknown report type." />;
  }
}
