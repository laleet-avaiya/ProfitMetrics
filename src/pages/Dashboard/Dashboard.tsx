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
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { BRAND_NAME } from '../../constants/brand';
import { emptyStateMessageClass, filterRowClass, sectionDescriptionClass, sectionTitleClass } from '../../constants/ui';
import { firestoreService } from '../../services/firestore';
import type { Expense, Invoice, Payment, ProductStock, PurchaseOrder, Sale } from '../../types';
import { TaxType } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { formatExpenseTaxLabel } from '../../utils/expenseHelpers';
import { formatMoney, formatPercent } from '../../utils/profit';
import { getExpenseVendorDisplay } from '../../utils/vendorHelpers';
import { getPaymentDisplaySource } from '../../utils/paymentHelpers';
import { paymentKindLabel } from '../../constants/paymentKinds';
import {
  computeByPlatform,
  computeByProduct,
  computeCashFlowSummary,
  computeInvoiceReceivables,
  computePaymentSummary,
  computePeriodSummary,
  computeReturnStats,
  computeStockSummary,
  computeTaxLedger,
  computeTrend,
  filterExpensesInRange,
  filterInvoicesInRange,
  filterPaymentsInRange,
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
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
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
    label: 'Sales',
    path: '/sales',
    icon: ShoppingCart,
    description: 'Marketplace & offline',
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
    label: 'Payments',
    path: '/payments',
    icon: Wallet,
    description: 'Money received',
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
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
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
      const [salesList, invoicesList, paymentsList, purchasesList, expensesList, stockList] =
        await Promise.all([
        firestoreService.sales.getAll(company.id),
        firestoreService.invoices.getAll(company.id),
        firestoreService.payments.getAll(company.id),
        firestoreService.purchases.getAll(company.id),
        firestoreService.expenses.getAll(company.id),
        firestoreService.stock.getAll(company.id),
      ]);
      setSales(salesList.filter((s) => !s.deleted));
      setInvoices(invoicesList.filter((i) => !i.deleted));
      setPayments(paymentsList.filter((p) => !p.deleted));
      setPurchases(purchasesList.filter((p) => !p.deleted));
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

  const filteredPayments = useMemo(
    () => filterPaymentsInRange(payments, dateRange.from, dateRange.to),
    [payments, dateRange]
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

  const paymentSummary = useMemo(
    () => computePaymentSummary(filteredPayments),
    [filteredPayments]
  );

  const cashFlow = useMemo(
    () =>
      computeCashFlowSummary(
        filteredPayments,
        purchases,
        filteredExpenses,
        dateRange.from,
        dateRange.to
      ),
    [filteredPayments, purchases, filteredExpenses, dateRange]
  );

  const receivables = useMemo(() => computeInvoiceReceivables(invoices), [invoices]);

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

  const recentPayments = useMemo(
    () =>
      [...filteredPayments]
        .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())
        .slice(0, RECENT_LIMIT),
    [filteredPayments]
  );

  const hasAnyData =
    sales.length > 0 ||
    invoices.length > 0 ||
    payments.length > 0 ||
    purchases.length > 0 ||
    expenses.length > 0 ||
    stock.length > 0;
  const hasPeriodData =
    summary.saleCount > 0 ||
    filteredExpenses.length > 0 ||
    filteredPayments.length > 0 ||
    cashFlow.paid > 0;
  const hasCashFlowActivity = cashFlow.received > 0 || cashFlow.paid > 0;
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
              <Link to="/sales/new">
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4" />
                  Marketplace sale
                </Button>
              </Link>
              <Link to="/invoices/new">
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                  Offline sale
                </Button>
              </Link>
              <Link to="/payments/new">
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                  Record payment
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
            <LoadingView message="Loading metrics…" size="md" className="py-10" />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Revenue"
                  value={formatMoney(summary.grossRevenue, currency)}
                  subtext={revenueSubtext}
                  tone="violet"
                  icon={TrendingUp}
                />
                <StatCard
                  label="Order profit"
                  value={formatMoney(summary.grossProfit, currency)}
                  subtext={`Online + offline · ${periodSubtext}`}
                  tone={summary.grossProfit >= 0 ? 'emerald' : 'rose'}
                  icon={Target}
                  valueClassName={profitClass(summary.grossProfit)}
                />
                <StatCard
                  label="Expenses"
                  value={formatMoney(summary.totalExpenses, currency)}
                  subtext={`${filteredExpenses.length} entr${filteredExpenses.length === 1 ? 'y' : 'ies'} · ${periodSubtext}`}
                  tone="amber"
                  icon={Receipt}
                />
                <StatCard
                  label="Net profit"
                  value={formatMoney(summary.netProfit, currency)}
                  subtext={`${formatPercent(summary.netMarginPercent)} margin · ${periodSubtext}`}
                  tone={summary.netProfit >= 0 ? 'emerald' : 'rose'}
                  icon={BarChart3}
                  valueClassName={profitClass(summary.netProfit)}
                />
              </div>

              {hasPeriodData && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <StatCard
                    compact
                    label="Stock on hand"
                    value={formatMoney(stockSummary.totalValue, currency)}
                    subtext={`${stockSummary.totalUnits} units · ${stockSummary.productCount} products`}
                    tone="violet"
                    icon={Warehouse}
                  />
                  <StatCard
                    compact
                    label="Avg order profit"
                    value={formatMoney(avgOrderProfit, currency)}
                    tone={avgOrderProfit >= 0 ? 'emerald' : 'rose'}
                    icon={Target}
                    valueClassName={profitClass(avgOrderProfit)}
                  />
                  <StatCard
                    compact
                    label="Return rate"
                    value={
                      <>
                        {formatPercent(returnStats.returnRatePercent)}
                        {returnStats.returnedCount > 0 && (
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                            ({returnStats.returnedCount})
                          </span>
                        )}
                      </>
                    }
                    tone={returnStats.returnRatePercent > 0 ? 'rose' : 'slate'}
                    icon={RotateCcw}
                  />
                  <StatCard
                    compact
                    label="Platform fees"
                    value={formatMoney(summary.totalPlatformFees, currency)}
                    tone="amber"
                    icon={ShoppingCart}
                  />
                  <StatCard
                    compact
                    label="Return charges"
                    value={formatMoney(returnStats.totalReturnCharges, currency)}
                    tone="rose"
                    icon={RotateCcw}
                    valueClassName="text-red-600 dark:text-red-400"
                  />
                  <StatCard
                    compact
                    label="Cancellation charges"
                    value={formatMoney(returnStats.totalCancellationCharges, currency)}
                    tone="rose"
                    icon={RotateCcw}
                    valueClassName="text-red-600 dark:text-red-400"
                  />
                </div>
              )}
            </>
          )}
        </Card>

        {!loading && hasCashFlowActivity && (
          <Card>
            <CardHeader
              title="Cash flow"
              description={`Money in vs out · ${dateRange.label}`}
              action={
                <Link
                  to="/payments"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View payments
                </Link>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                label="Received"
                value={formatMoney(cashFlow.received, currency)}
                subtext={`${cashFlow.receivedCount} receipt${cashFlow.receivedCount === 1 ? '' : 's'} · ${periodSubtext}`}
                tone="emerald"
                icon={ArrowDownLeft}
              />
              <StatCard
                label="Paid out"
                value={formatMoney(cashFlow.paid, currency)}
                subtext={`${cashFlow.paidCount} outflow${cashFlow.paidCount === 1 ? '' : 's'} · ${periodSubtext}`}
                tone="amber"
                icon={ArrowUpRight}
              />
              <StatCard
                label="Net cash flow"
                value={formatMoney(cashFlow.netCashFlow, currency)}
                subtext={
                  cashFlow.netCashFlow > 0
                    ? 'Positive — more received than paid'
                    : cashFlow.netCashFlow < 0
                      ? 'Negative — more paid than received'
                      : 'Balanced'
                }
                tone={cashFlow.netCashFlow >= 0 ? 'emerald' : 'rose'}
                icon={TrendingUp}
                valueClassName={profitClass(cashFlow.netCashFlow)}
              />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 pt-3 mt-3 border-t border-gray-100 dark:border-gray-700">
              <StatCard
                compact
                label="Invoice payments"
                value={formatMoney(paymentSummary.invoicePayments, currency)}
                tone="emerald"
                icon={FileText}
              />
              <StatCard
                compact
                label="Direct receipts"
                value={formatMoney(paymentSummary.directPayments, currency)}
                tone="emerald"
                icon={ArrowDownLeft}
              />
              <StatCard
                compact
                label="Marketplace payouts"
                value={formatMoney(paymentSummary.marketplacePayouts, currency)}
                tone="emerald"
                icon={ShoppingCart}
              />
              <StatCard
                compact
                label="PO payments"
                value={formatMoney(cashFlow.poPayments, currency)}
                tone="amber"
                icon={ClipboardList}
              />
              <StatCard
                compact
                label="Operating expenses"
                value={formatMoney(cashFlow.operatingExpenses, currency)}
                tone="amber"
                icon={Receipt}
              />
              <StatCard
                compact
                label="Outstanding (AR)"
                value={formatMoney(receivables.balanceDue, currency)}
                subtext={
                  receivables.openCount > 0
                    ? `${receivables.openCount} open invoice${receivables.openCount === 1 ? '' : 's'}`
                    : 'Current balance'
                }
                tone={receivables.balanceDue > 0 ? 'amber' : 'emerald'}
                icon={Wallet}
              />
            </div>
          </Card>
        )}

        {!loading && !hasPeriodData && (
          <Card className="py-8 flex flex-col items-center space-y-3">
            <p className={emptyStateMessageClass}>
              No sales, invoices, payments, or expenses in{' '}
              <span className="font-medium">{dateRange.label.toLowerCase()}</span>.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/sales/new">
                <Button variant="primary" size="sm">
                  <ShoppingCart className="w-4 h-4" />
                  Marketplace sale
                </Button>
              </Link>
              <Link to="/invoices/new">
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4" />
                  Offline sale
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
                    tone="amber"
                    icon={Receipt}
                  />
                  <StatCard
                    label="ITC — purchase"
                    value={formatMoney(taxLedger.saleInputTax, currency)}
                    subtext="Input tax on COGS"
                    tone="emerald"
                    icon={Package}
                  />
                  <StatCard
                    label="ITC — expenses"
                    value={formatMoney(taxLedger.expenseInputTax, currency)}
                    subtext="Platform, delivery, fees & more"
                    tone="emerald"
                    icon={Receipt}
                  />
                  <StatCard
                    label="Net tax payable"
                    value={formatMoney(taxLedger.netTax, currency)}
                    subtext={`Total ITC ${formatMoney(taxLedger.inputTax, currency)}`}
                    tone={taxLedger.netTax <= 0 ? 'emerald' : 'amber'}
                    icon={BarChart3}
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
                description="Marketplace vs offline sales"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card>
              <CardHeader
                title="Recent marketplace sales"
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
                title="Recent offline sales"
                description={`Customer invoices · ${dateRange.label.toLowerCase()}`}
                action={
                  <Link
                    to="/sales?channel=offline"
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

            <Card>
              <CardHeader
                title="Recent payments"
                description={`Money received · ${dateRange.label.toLowerCase()}`}
                action={
                  <Link
                    to="/payments"
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View all
                  </Link>
                }
              />
              {recentPayments.length === 0 ? (
                <p className={`${emptyStateMessageClass} py-4 text-gray-500 dark:text-gray-400`}>
                  No payments in this period
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 -mx-1">
                  {recentPayments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5 px-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {getPaymentDisplaySource(payment)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateLocal(payment.paymentDate)} · {paymentKindLabel(payment.kind)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatMoney(payment.amount, currency)}
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
                  Add products, log marketplace and offline sales, record purchases to build stock,
                  and track expenses. Your dashboard fills in as you go.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {quickLinks.map((item) => (
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
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </PageShell>
    </Layout>
  );
}
