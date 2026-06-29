import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { emptyStateClass } from '../../constants/ui';
import type { ReportId } from '../../constants/reportCatalog';
import type { Expense, PeriodProfitSummary, Sale } from '../../types';
import { formatMoney, formatPercent } from '../../utils/profit';
import {
  computeByExpenseCategory,
  computeByPlatform,
  computeByProduct,
  computeTaxLedger,
  computeTrend,
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
  filteredExpenses: Expense[];
  summary: PeriodProfitSummary;
  hasData: boolean;
}

export function ReportContent({
  reportId,
  currency,
  filteredSales,
  filteredExpenses,
  summary,
  hasData,
}: ReportContentProps) {
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('daily');

  const byProduct = useMemo(() => computeByProduct(filteredSales), [filteredSales]);
  const byPlatform = useMemo(() => computeByPlatform(filteredSales), [filteredSales]);
  const byCategory = useMemo(
    () => computeByExpenseCategory(filteredExpenses),
    [filteredExpenses]
  );
  const taxLedger = useMemo(
    () => computeTaxLedger(filteredSales, filteredExpenses),
    [filteredSales, filteredExpenses]
  );
  const trend = useMemo(
    () => computeTrend(filteredSales, filteredExpenses, trendGranularity),
    [filteredSales, filteredExpenses, trendGranularity]
  );

  const maxExpenseCategory = Math.max(...byCategory.map((c) => c.total), 1);

  if (!hasData) {
    return (
      <EmptyReport message="No sales or expenses in this period. Adjust the date range or log more data." />
    );
  }

  switch (reportId) {
    case 'profit-loss': {
      const plLines = [
        { label: 'Gross revenue', value: summary.grossRevenue, emphasize: false },
        { label: 'Cost of goods (COGS)', value: -summary.totalCogs, emphasize: false },
        { label: 'Shipping', value: -summary.totalShipping, emphasize: false },
        { label: 'Platform fees', value: -summary.totalPlatformFees, emphasize: false },
        { label: 'Tax collected', value: -summary.totalTax, emphasize: false },
        { label: 'Order profit', value: summary.grossProfit, emphasize: true },
        { label: 'Operating expenses', value: -summary.totalExpenses, emphasize: false },
        { label: 'Net profit', value: summary.netProfit, emphasize: true },
      ];

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Orders', value: String(summary.saleCount) },
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
          </ReportSection>
        </div>
      );
    }

    case 'sales-by-product':
      return (
        <ReportSection title="Sales by product">
          {byProduct.length === 0 ? (
            <EmptyReport message="No sales in this period." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Orders</th>
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
        <ReportSection title="Sales by platform">
          {byPlatform.length === 0 ? (
            <EmptyReport message="No sales in this period." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-3 py-2">Platform</th>
                    <th className="px-3 py-2 text-right">Orders</th>
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
        <ReportSection title="Expense breakdown">
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
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatMoney(row.total, currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                          {summary.totalExpenses > 0
                            ? formatPercent((row.total / summary.totalExpenses) * 100)
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
                    <span className="text-gray-700 dark:text-gray-300 truncate">{row.category}</span>
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
        { label: 'Output tax (collected on sales)', value: taxLedger.outputTax, emphasize: false },
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
              ITC. Purchase tax on COGS remains on sales.
            </p>
          </ReportSection>
        </div>
      );
    }

    case 'trend':
      return (
        <ReportSection title="Profit trend">
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
                  Expenses
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
