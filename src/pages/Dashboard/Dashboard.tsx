import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
import { HorizontalBarList, NetProfitTrendChart } from '../../components/ui/DashboardCharts';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { useNotification } from '../../hooks/useNotification';
import { BRAND_NAME } from '../../constants/brand';
import { emptyStateMessageClass, filterRowClass, sectionDescriptionClass, sectionTitleClass } from '../../constants/ui';
import { firestoreService } from '../../services/firestore';
import type { Expense, Invoice, ProductStock, Sale } from '../../types';
import { TaxType } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { formatExpenseTaxLabel } from '../../utils/expenseHelpers';
import { formatMoney, formatPercent } from '../../utils/profit';
import { getExpenseVendorDisplay } from '../../utils/vendorHelpers';
import {
  computeByPlatform,
  computeByProduct,
  computePeriodSummary,
  computeReturnStats,
  computeStockSummary,
  computeTaxLedger,
  computeTrend,
  filterExpensesInRange,
  filterInvoicesInRange,
  filterSalesInRange,
  getReportDateRange,
  trendGranularityForPreset,
  type ReportPreset,
} from '../../utils/reports';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  Building2,
  ArrowRight,
  Plus,
  RotateCcw,
  Target,
  FileText,
  ClipboardList,
  Users,
  Warehouse,
} from 'lucide-react';

function taxSummaryTitle(taxType: TaxType | undefined): string {
  const label = formatExpenseTaxLabel(taxType);
  return label === 'Tax' ? 'Tax summary' : `${label} summary`;
}

const PRESET_OPTIONS: { value: ReportPreset; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const quickLinks = [
  {
    label: 'Products',
    path: '/products',
    icon: Package,
    description: 'SKUs & stock',
  },
  {
    label: 'Online sales',
    path: '/sales',
    icon: ShoppingCart,
    description: 'Marketplace orders',
  },
  {
    label: 'Invoices',
    path: '/invoices',
    icon: FileText,
    description: 'Customer invoices',
  },
  {
    label: 'Purchases',
    path: '/purchases',
    icon: ClipboardList,
    description: 'Vendor POs & stock',
  },
  {
    label: 'Expenses',
    path: '/expenses',
    icon: Receipt,
    description: 'Operating costs',
  },
  {
    label: 'Customers',
    path: '/customers',
    icon: Users,
    description: 'AR & ledger',
  },
  {
    label: 'Vendors',
    path: '/vendors',
    icon: Building2,
    description: 'Suppliers & AP',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    description: 'P&L & breakdowns',
  },
];

function profitClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return '';
}

const RECENT_LIMIT = 5;

export function Dashboard() {
  const { company } = useAuth();
  const { summary: marketplaceSummary } = useCompanyMarketplaces();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stock, setStock] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<ReportPreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [salesList, invoicesList, expensesList, stockList] = await Promise.all([
        firestoreService.sales.getAll(company.id),
        firestoreService.invoices.getAll(company.id),
        firestoreService.expenses.getAll(company.id),
        firestoreService.stock.getAll(company.id),
      ]);
      setSales(salesList.filter((s) => !s.deleted));
      setInvoices(invoicesList.filter((i) => !i.deleted));
      setExpenses(expensesList.filter((e) => !e.deleted));
      setStock(stockList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      notification.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dateRange = useMemo(
    () => getReportDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const filteredSales = useMemo(
    () => filterSalesInRange(sales, dateRange.from, dateRange.to),
    [sales, dateRange]
  );

  const filteredInvoices = useMemo(
    () => filterInvoicesInRange(invoices, dateRange.from, dateRange.to),
    [invoices, dateRange]
  );

  const filteredExpenses = useMemo(
    () => filterExpensesInRange(expenses, dateRange.from, dateRange.to),
    [expenses, dateRange]
  );

  const summary = useMemo(
    () =>
      computePeriodSummary(
        filteredSales,
        filteredInvoices,
        filteredExpenses,
        dateRange.label,
        dateRange.from,
        dateRange.to
      ),
    [filteredSales, filteredInvoices, filteredExpenses, dateRange]
  );

  const stockSummary = useMemo(() => computeStockSummary(stock), [stock]);

  const returnStats = useMemo(() => computeReturnStats(filteredSales), [filteredSales]);

  const taxLedger = useMemo(
    () => computeTaxLedger(filteredSales, filteredInvoices, filteredExpenses),
    [filteredSales, filteredInvoices, filteredExpenses]
  );

  const hasTaxActivity =
    taxLedger.outputTax > 0 ||
    taxLedger.inputTax > 0 ||
    summary.totalTax > 0;

  const avgOrderProfit = useMemo(
    () =>
      summary.saleCount > 0
        ? Math.round((summary.grossProfit / summary.saleCount) * 100) / 100
        : 0,
    [summary]
  );

  const topProducts = useMemo(
    () => computeByProduct(filteredSales, filteredInvoices).slice(0, 5),
    [filteredSales, filteredInvoices]
  );

  const topPlatforms = useMemo(
    () => computeByPlatform(filteredSales, filteredInvoices).slice(0, 5),
    [filteredSales, filteredInvoices]
  );

  const trendData = useMemo(
    () =>
      computeTrend(
        filteredSales,
        filteredInvoices,
        filteredExpenses,
        trendGranularityForPreset(preset)
      ),
    [filteredSales, filteredInvoices, filteredExpenses, preset]
  );

  const recentSales = useMemo(
    () =>
      [...filteredSales]
        .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())
        .slice(0, RECENT_LIMIT),
    [filteredSales]
  );

  const recentInvoices = useMemo(
    () =>
      [...filteredInvoices]
        .sort((a, b) => b.invoiceDate.getTime() - a.invoiceDate.getTime())
        .slice(0, RECENT_LIMIT),
    [filteredInvoices]
  );

  const recentExpenses = useMemo(
    () =>
      [...filteredExpenses]
        .sort((a, b) => b.expenseDate.getTime() - a.expenseDate.getTime())
        .slice(0, RECENT_LIMIT),
    [filteredExpenses]
  );

  const hasAnyData =
    sales.length > 0 || invoices.length > 0 || expenses.length > 0 || stock.length > 0;
  const hasPeriodData =
    summary.saleCount > 0 || filteredExpenses.length > 0;
  const periodSubtext = dateRange.label;

  const revenueSubtext =
    summary.invoiceCount > 0
      ? `${summary.onlineSaleCount} online · ${summary.invoiceCount} offline · ${periodSubtext}`
      : `${summary.saleCount} order${summary.saleCount === 1 ? '' : 's'} · ${periodSubtext}`;

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="Dashboard"
          description={`${BRAND_NAME} · ${company?.name ?? 'Your company'}`}
          actions={
            <>
              <Link to="/sales">
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4" />
                  Log sale
                </Button>
              </Link>
              <Link to="/invoices/new">
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                  New invoice
                </Button>
              </Link>
              <Link to="/expenses">
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                  Add expense
                </Button>
              </Link>
            </>
          }
        />

        <Card className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
            <div>
              <p className={sectionTitleClass}>Period</p>
              <p className={sectionDescriptionClass}>{dateRange.label}</p>
            </div>
            <div className={filterRowClass}>
              <FilterSelect
                value={preset}
                onChange={(e) => setPreset(e.target.value as ReportPreset)}
                aria-label="Dashboard date range"
              >
                {PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FilterSelect>
              {preset === 'custom' && (
                <>
                  <Input
                    label="From"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    fullWidth={false}
                  />
                  <Input
                    label="To"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    fullWidth={false}
                  />
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading metrics…</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Revenue"
                  value={formatMoney(summary.grossRevenue, currency)}
                  subtext={revenueSubtext}
                />
                <StatCard
                  label="Order profit"
                  value={formatMoney(summary.grossProfit, currency)}
                  subtext={`Online + offline · ${periodSubtext}`}
                  valueClassName={profitClass(summary.grossProfit)}
                />
                <StatCard
                  label="Expenses"
                  value={formatMoney(summary.totalExpenses, currency)}
                  subtext={`${filteredExpenses.length} entr${filteredExpenses.length === 1 ? 'y' : 'ies'} · ${periodSubtext}`}
                />
                <StatCard
                  label="Net profit"
                  value={formatMoney(summary.netProfit, currency)}
                  subtext={`${formatPercent(summary.netMarginPercent)} margin · ${periodSubtext}`}
                  valueClassName={profitClass(summary.netProfit)}
                />
              </div>

              {hasPeriodData && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Warehouse className="w-3 h-3" />
                      Stock on hand
                    </p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5 text-gray-900 dark:text-white">
                      {formatMoney(stockSummary.totalValue, currency)}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {stockSummary.totalUnits} units · {stockSummary.productCount} products
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Avg order profit
                    </p>
                    <p className={`text-sm font-semibold tabular-nums mt-0.5 ${profitClass(avgOrderProfit)}`}>
                      {formatMoney(avgOrderProfit, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      Return rate
                    </p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5 text-gray-900 dark:text-white">
                      {formatPercent(returnStats.returnRatePercent)}
                      {returnStats.returnedCount > 0 && (
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                          ({returnStats.returnedCount})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Platform fees</p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5 text-gray-900 dark:text-white">
                      {formatMoney(summary.totalPlatformFees, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Return charges</p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5 text-red-600 dark:text-red-400">
                      {formatMoney(returnStats.totalReturnCharges, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cancellation charges</p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5 text-red-600 dark:text-red-400">
                      {formatMoney(returnStats.totalCancellationCharges, currency)}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {!loading && !hasPeriodData && (
          <Card className="py-8 flex flex-col items-center space-y-3">
            <p className={emptyStateMessageClass}>
              No sales, invoices, or expenses in{' '}
              <span className="font-medium">{dateRange.label.toLowerCase()}</span>.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/sales/new">
                <Button variant="primary" size="sm">
                  <ShoppingCart className="w-4 h-4" />
                  Log online sale
                </Button>
              </Link>
              <Link to="/invoices/new">
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4" />
                  Create invoice
                </Button>
              </Link>
              <Link to="/products/new">
                <Button variant="outline" size="sm">
                  <Package className="w-4 h-4" />
                  Add products
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {!loading && hasPeriodData && (
          <Card>
            <CardHeader
              title={taxSummaryTitle(company?.defaultTaxType)}
              description={`Output tax vs input tax (ITC) · ${dateRange.label}`}
              action={
                <Link
                  to="/reports/tax-summary"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Full tax report
                </Link>
              }
            />
            {!hasTaxActivity ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                No tax tracked in this period. Enable GST/VAT on sales and expenses to see output
                tax and ITC here.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    label="Output tax"
                    value={formatMoney(taxLedger.outputTax, currency)}
                    subtext={
                      taxLedger.offlineOutputTax > 0
                        ? 'Online + offline invoices'
                        : 'Collected on sales'
                    }
                    valueClassName="text-amber-700 dark:text-amber-400"
                  />
                  <StatCard
                    label="ITC — purchase"
                    value={formatMoney(taxLedger.saleInputTax, currency)}
                    subtext="Input tax on COGS"
                    valueClassName="text-emerald-600 dark:text-emerald-400"
                  />
                  <StatCard
                    label="ITC — expenses"
                    value={formatMoney(taxLedger.expenseInputTax, currency)}
                    subtext="Platform, delivery, fees & more"
                    valueClassName="text-emerald-600 dark:text-emerald-400"
                  />
                  <StatCard
                    label="Net tax payable"
                    value={formatMoney(taxLedger.netTax, currency)}
                    subtext={`Total ITC ${formatMoney(taxLedger.inputTax, currency)}`}
                    valueClassName={profitClass(-taxLedger.netTax)}
                  />
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          Output tax (debit)
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-700 dark:text-amber-400">
                          {formatMoney(taxLedger.outputTax, currency)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          Input tax — purchase / COGS (ITC)
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                          −{formatMoney(taxLedger.saleInputTax, currency)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          Input tax — expenses (ITC)
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                          −{formatMoney(taxLedger.expenseInputTax, currency)}
                        </td>
                      </tr>
                      <tr className="bg-gray-50 dark:bg-gray-900/40">
                        <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                          Net tax payable
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-bold ${profitClass(-taxLedger.netTax)}`}
                        >
                          {formatMoney(taxLedger.netTax, currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        )}

        {!loading && hasPeriodData && trendData.length > 0 && (
          <Card>
            <CardHeader
              title="Net profit trend"
              description={`${dateRange.label} · hover bars for values`}
              action={
                <Link
                  to="/reports"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Full reports
                </Link>
              }
            />
            <NetProfitTrendChart data={trendData} currency={currency} />
          </Card>
        )}

        {!loading && hasPeriodData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader
                title="Top products"
                description="By order profit"
                action={
                  topProducts.length > 0 ? (
                    <Link
                      to="/reports"
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      See all
                    </Link>
                  ) : null
                }
              />
              <HorizontalBarList
                items={topProducts.map((p) => ({
                  label: p.productName,
                  value: p.profit,
                  sublabel: `${p.saleCount} sale${p.saleCount === 1 ? '' : 's'} · ${formatPercent(p.marginPercent)} margin`,
                }))}
                currency={currency}
              />
            </Card>

            <Card>
              <CardHeader
                title="Sales by channel"
                description="Online sales vs invoices"
                action={
                  topPlatforms.length > 0 ? (
                    <Link
                      to="/reports"
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      See all
                    </Link>
                  ) : null
                }
              />
              <HorizontalBarList
                items={topPlatforms.map((p) => ({
                  label: p.platform,
                  value: p.profit,
                  sublabel: `${p.saleCount} order${p.saleCount === 1 ? '' : 's'} · ${formatMoney(p.revenue, currency)} revenue`,
                }))}
                currency={currency}
              />
            </Card>
          </div>
        )}

        {!loading && hasPeriodData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card>
              <CardHeader
                title="Recent online sales"
                description={`Latest in ${dateRange.label.toLowerCase()}`}
                action={
                  <Link
                    to="/sales"
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View all
                  </Link>
                }
              />
              {recentSales.length === 0 ? (
                <p className={`${emptyStateMessageClass} py-4 text-gray-500 dark:text-gray-400`}>
                  No sales in this period
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 -mx-1">
                  {recentSales.map((sale) => (
                    <li key={sale.id} className="flex items-center justify-between gap-3 py-2.5 px-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {sale.productName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateLocal(sale.orderDate)} · {sale.platform} · {sale.orderId}
                        </p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <SaleStatusBadge status={sale.status} />
                        <p className={`text-sm font-semibold tabular-nums ${profitClass(sale.profit)}`}>
                          {formatMoney(sale.profit, currency)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent invoices"
                description={`Invoices · ${dateRange.label.toLowerCase()}`}
                action={
                  <Link
                    to="/invoices"
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View all
                  </Link>
                }
              />
              {recentInvoices.length === 0 ? (
                <p className={`${emptyStateMessageClass} py-4 text-gray-500 dark:text-gray-400`}>
                  No invoices in this period
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 -mx-1">
                  {recentInvoices.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5 px-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {inv.invoiceNumber}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateLocal(inv.invoiceDate)} · {inv.customerName ?? 'Customer'}
                        </p>
                      </div>
                      <p className={`shrink-0 text-sm font-semibold tabular-nums ${profitClass(inv.profit)}`}>
                        {formatMoney(inv.profit, currency)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent expenses"
                description={`Latest in ${dateRange.label.toLowerCase()}`}
                action={
                  <Link
                    to="/expenses"
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View all
                  </Link>
                }
              />
              {recentExpenses.length === 0 ? (
                <p className={`${emptyStateMessageClass} py-4 text-gray-500 dark:text-gray-400`}>
                  No expenses in this period
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 -mx-1">
                  {recentExpenses.map((expense) => (
                    <li key={expense.id} className="flex items-center justify-between gap-3 py-2.5 px-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {expense.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateLocal(expense.expenseDate)}
                          {getExpenseVendorDisplay(expense)
                            ? ` · ${getExpenseVendorDisplay(expense)}`
                            : ''}
                          {' · '}
                          {expense.category}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                        {formatMoney(expense.amount, currency)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {!loading && !hasAnyData && (
          <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Get started with {BRAND_NAME}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Add products, log online sales on {marketplaceSummary}, create invoices, record
                  purchases to build stock, and track expenses. Your dashboard fills in as you go.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {quickLinks.map((item) => {
            const description =
              item.path === '/sales' ? `${marketplaceSummary} orders` : item.description;
            return (
            <Link
              key={item.path}
              to={item.path}
              className="group flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                  <item.icon className="w-4 h-4 text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 shrink-0" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{description}</p>
              </div>
            </Link>
            );
          })}
        </div>
      </PageShell>
    </Layout>
  );
}
