import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { SpreadsheetTable } from '../../components/ui/SpreadsheetTable';
import { ReportId, type ReportId as ReportIdType } from '../../constants/reportCatalog';
import { emptyStateClass } from '../../constants/ui';
import type { Expense, Invoice, PeriodProfitSummary, Product, ProductStock, Sale } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { formatMoney, formatPercent } from '../../utils/profit';
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
  reportId: ReportIdType;
  currency: string;
  filteredSales: Sale[];
  filteredInvoices: Invoice[];
  filteredExpenses: Expense[];
  stock: ProductStock[];
  products: Product[];
  summary: PeriodProfitSummary;
  hasData: boolean;
}

export function ReportContent({
  reportId,
  currency,
  filteredSales,
  filteredInvoices,
  filteredExpenses,
  stock,
  products,
  summary,
  hasData,
}: ReportContentProps) {
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('daily');
  const isStockReport = reportId === ReportId.STOCK_ON_HAND;

  const skuMap = useMemo(
    () => new Map(products.map((product) => [product.id, product.sku])),
    [products]
  );

  const stockRows = useMemo(() => computeStockReport(stock, skuMap), [stock, skuMap]);
  const stockSummary = useMemo(() => computeStockSummary(stock), [stock]);

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

  const operatingExpenseTotal = useMemo(
    () => operatingExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [operatingExpenses]
  );

  if (!isStockReport && !hasData) {
    return (
      <EmptyReport message="No sales, invoices, or expenses in this period. Adjust the date range or log more data." />
    );
  }

  if (isStockReport && stockRows.length === 0) {
    return (
      <EmptyReport message="No stock on hand yet. Receive purchase orders to build inventory." />
    );
  }

  switch (reportId) {
    case ReportId.STOCK_ON_HAND:
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Products in stock', value: String(stockSummary.productCount) },
              { label: 'Total units', value: String(stockSummary.totalUnits) },
              {
                label: 'Total stock value',
                value: formatMoney(stockSummary.totalValue, currency),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-emerald-200/70 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/30 dark:to-gray-800 p-3"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="mt-0.5 text-base font-semibold tabular-nums text-gray-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <ReportSection
            title="Stock on hand"
            description="Spreadsheet view — download XLS for Excel."
          >
            <SpreadsheetTable
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => row.productName,
                },
                {
                  key: 'sku',
                  header: 'SKU',
                  render: (row) => row.sku ?? '—',
                },
                {
                  key: 'qty',
                  header: 'Qty on hand',
                  align: 'right',
                  render: (row) => row.quantityOnHand,
                },
                {
                  key: 'cost',
                  header: 'Avg cost',
                  align: 'right',
                  render: (row) => formatMoney(row.avgPurchasePrice, currency),
                },
                {
                  key: 'sell',
                  header: 'Avg selling price',
                  align: 'right',
                  render: (row) => formatMoney(row.avgSellingPrice, currency),
                },
                {
                  key: 'value',
                  header: 'Stock value',
                  align: 'right',
                  className: 'font-semibold',
                  render: (row) => formatMoney(row.totalValue, currency),
                },
                {
                  key: 'received',
                  header: 'Last received',
                  align: 'right',
                  render: (row) =>
                    row.lastReceivedAt ? formatDateLocal(row.lastReceivedAt) : '—',
                },
              ]}
              rows={stockRows}
              rowKey={(row) => row.productId}
              footerRows={[
                {
                  cells: [
                    `Totals · ${stockSummary.productCount} products · ${stockSummary.totalUnits} units · ${formatMoney(stockSummary.totalValue, currency)}`,
                  ],
                },
              ]}
            />
          </ReportSection>
        </div>
      );

    case ReportId.PROFIT_LOSS: {
      const plLines = [
        { label: 'Gross revenue', value: summary.grossRevenue, emphasize: false },
        ...(summary.offlineRevenue > 0
          ? [
              { label: '  Online sales', value: summary.onlineRevenue, emphasize: false },
              { label: '  Offline invoices', value: summary.offlineRevenue, emphasize: false },
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
            <SpreadsheetTable
              columns={[
                {
                  key: 'label',
                  header: 'Line item',
                  render: (line) => (
                    <span className={line.emphasize ? 'font-semibold' : ''}>{line.label}</span>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  className: 'font-medium',
                  render: (line) => (
                    <span className={profitClass(line.value)}>
                      {line.value < 0 ? '−' : ''}
                      {formatMoney(Math.abs(line.value), currency)}
                    </span>
                  ),
                },
              ]}
              rows={plLines}
              rowKey={(line) => line.label}
              footerRows={[
                {
                  cells: ['Net margin', formatPercent(summary.netMarginPercent)],
                },
              ]}
            />
            {summary.excludedAutoExpenses > 0 && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {formatMoney(summary.excludedAutoExpenses, currency)} in auto-generated sale fees
                and inventory purchases is excluded from operating expenses (already in order profit
                or stock).
              </p>
            )}
          </ReportSection>
        </div>
      );
    }

    case ReportId.SALES_BY_PRODUCT:
      return (
        <ReportSection
          title="Sales by product"
          description="Online orders and offline invoice line items combined."
        >
          <SpreadsheetTable
            columns={[
              { key: 'product', header: 'Product', render: (row) => row.productName },
              { key: 'lines', header: 'Lines', align: 'right', render: (row) => row.saleCount },
              {
                key: 'revenue',
                header: 'Revenue',
                align: 'right',
                render: (row) => formatMoney(row.revenue, currency),
              },
              {
                key: 'profit',
                header: 'Profit',
                align: 'right',
                className: 'font-medium',
                render: (row) => (
                  <span className={profitClass(row.profit)}>
                    {formatMoney(row.profit, currency)}
                  </span>
                ),
              },
              {
                key: 'margin',
                header: 'Margin',
                align: 'right',
                render: (row) => (
                  <span className={profitClass(row.profit)}>
                    {formatPercent(row.marginPercent)}
                  </span>
                ),
              },
            ]}
            rows={byProduct}
            rowKey={(row) => row.productId}
            emptyMessage="No sales or invoices in this period."
          />
        </ReportSection>
      );

    case ReportId.SALES_BY_PLATFORM:
      return (
        <ReportSection title="Sales by channel" description="Online marketplaces vs invoices.">
          <SpreadsheetTable
            columns={[
              { key: 'channel', header: 'Channel', render: (row) => row.platform },
              { key: 'count', header: 'Count', align: 'right', render: (row) => row.saleCount },
              {
                key: 'revenue',
                header: 'Revenue',
                align: 'right',
                render: (row) => formatMoney(row.revenue, currency),
              },
              {
                key: 'profit',
                header: 'Profit',
                align: 'right',
                className: 'font-medium',
                render: (row) => (
                  <span className={profitClass(row.profit)}>
                    {formatMoney(row.profit, currency)}
                  </span>
                ),
              },
              {
                key: 'margin',
                header: 'Margin',
                align: 'right',
                render: (row) => (
                  <span className={profitClass(row.profit)}>
                    {formatPercent(row.marginPercent)}
                  </span>
                ),
              },
            ]}
            rows={byPlatform}
            rowKey={(row) => row.platform}
            emptyMessage="No sales or invoices in this period."
          />
        </ReportSection>
      );

    case ReportId.EXPENSE_BREAKDOWN:
      return (
        <ReportSection
          title="Expense breakdown"
          description="All expense categories. Items marked † are excluded from net profit."
        >
          <SpreadsheetTable
            columns={[
              {
                key: 'category',
                header: 'Category',
                render: (row) => (
                  <>
                    {row.category}
                    {row.excludedFromNetProfit ? (
                      <span className="text-xs text-gray-400 ml-1">†</span>
                    ) : null}
                  </>
                ),
              },
              { key: 'count', header: 'Count', align: 'right', render: (row) => row.count },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                className: 'font-medium',
                render: (row) => formatMoney(row.total, currency),
              },
              {
                key: 'share',
                header: 'Share',
                align: 'right',
                render: (row) =>
                  operatingExpenseTotal > 0 && !row.excludedFromNetProfit
                    ? formatPercent((row.total / operatingExpenseTotal) * 100)
                    : '—',
              },
            ]}
            rows={byCategory}
            rowKey={(row) => row.category}
            emptyMessage="No expenses in this period."
          />
        </ReportSection>
      );

    case ReportId.TAX_SUMMARY: {
      const taxLines = [
        { label: 'Output tax — online sales', value: taxLedger.onlineOutputTax, emphasize: false },
        ...(taxLedger.offlineOutputTax > 0
          ? [
              {
                label: 'Output tax — offline invoices',
                value: taxLedger.offlineOutputTax,
                emphasize: false,
              },
            ]
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
            <SpreadsheetTable
              columns={[
                {
                  key: 'label',
                  header: 'Line item',
                  render: (line) => (
                    <span className={line.emphasize ? 'font-semibold' : ''}>{line.label}</span>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  className: 'font-medium',
                  render: (line) => (
                    <span className={profitClass(line.value)}>
                      {line.value < 0 ? '−' : ''}
                      {formatMoney(Math.abs(line.value), currency)}
                    </span>
                  ),
                },
              ]}
              rows={taxLines}
              rowKey={(line) => line.label}
            />
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Platform fees, delivery, and return/cancellation charges are tracked as expenses with
              ITC. Purchase tax on online COGS is on sales; inventory purchase payments are
              capitalized in stock until sold.
            </p>
          </ReportSection>
        </div>
      );
    }

    case ReportId.TREND:
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
            <div className="space-y-6">
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
              </div>

              <SpreadsheetTable
                columns={[
                  { key: 'period', header: 'Period', render: (row) => row.label },
                  {
                    key: 'revenue',
                    header: 'Revenue',
                    align: 'right',
                    render: (row) => formatMoney(row.revenue, currency),
                  },
                  {
                    key: 'orderProfit',
                    header: 'Order profit',
                    align: 'right',
                    render: (row) => formatMoney(row.orderProfit, currency),
                  },
                  {
                    key: 'expenses',
                    header: 'Operating expenses',
                    align: 'right',
                    render: (row) => formatMoney(row.expenses, currency),
                  },
                  {
                    key: 'netProfit',
                    header: 'Net profit',
                    align: 'right',
                    className: 'font-medium',
                    render: (row) => (
                      <span className={profitClass(row.netProfit)}>
                        {formatMoney(row.netProfit, currency)}
                      </span>
                    ),
                  },
                ]}
                rows={trend}
                rowKey={(row) => row.key}
              />
            </div>
          )}
        </ReportSection>
      );

    default:
      return <EmptyReport message="Unknown report type." />;
  }
}
