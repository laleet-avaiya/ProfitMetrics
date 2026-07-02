import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { SectionPage } from '../../components/SectionPage/SectionPage';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Card, StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterSelect } from '../../components/ui/FilterSelect';
import {
  filterRowClass,
  tableCellClass,
  tableHeadCellClass,
  tableTruncateCellClass,
  toolbarClass,
} from '../../constants/ui';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { INVOICE_STATUS_OPTIONS, invoiceStatusLabel } from '../../constants/invoiceStatuses';
import { purchasePaymentStatusLabel, normalizeSalePaymentStatus } from '../../constants/purchaseStatuses';
import {
  SALES_CHANNEL_FILTER_OPTIONS,
  SalesChannelFilter,
  normalizeSalesChannelFilter,
  salesKindLabel,
} from '../../constants/salesChannels';
import { firestoreService } from '../../services/firestore';
import type { Customer, Invoice, Sale } from '../../types';
import { InvoiceStatus } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { dateFilterRange, isDateInRange, type DateFilter } from '../../utils/expenseHelpers';
import { formatMoney } from '../../utils/profit';
import { restoreInvoiceStock } from '../../utils/invoiceStock';
import { deleteSaleLinkedExpenses } from '../../utils/saleExpenses';
import { restoreSaleStock } from '../../utils/saleStock';
import {
  filterUnifiedRows,
  mergeSalesRows,
  unifiedRowDetailPath,
  unifiedRowEditPath,
  unifiedRowPrintPath,
  unifiedRowProfit,
  unifiedRowReference,
  unifiedRowRevenue,
  unifiedRowSubtitle,
  type UnifiedSalesRow,
} from '../../utils/unifiedSalesList';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';

type InvoiceStatusFilter = 'all' | InvoiceStatus;

export function Sales() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const channel = normalizeSalesChannelFilter(searchParams.get('channel'));
  const customerFilter = searchParams.get('customer') ?? '';

  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatusFilter>('all');

  const setChannel = (next: SalesChannelFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === SalesChannelFilter.ALL) params.delete('channel');
    else params.set('channel', next);
    setSearchParams(params, { replace: true });
  };

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [salesList, invoiceList, customerList] = await Promise.all([
        firestoreService.sales.getAll(company.id),
        firestoreService.invoices.getAll(company.id),
        firestoreService.customers.getAll(company.id),
      ]);
      setSales(salesList.filter((s) => !s.deleted));
      setInvoices(invoiceList.filter((i) => !i.deleted));
      setCustomers(customerList.filter((c) => !c.deleted));
    } catch {
      notification.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const merged = useMemo(() => mergeSalesRows(sales, invoices), [sales, invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = dateFilterRange(dateFilter);
    const byChannel = filterUnifiedRows(merged, channel);

    return byChannel.filter((row) => {
      if (!isDateInRange(row.date, from, to)) return false;

      if (row.kind === 'offline') {
        if (customerFilter && row.invoice.customerId !== customerFilter) return false;
        if (invoiceStatusFilter !== 'all' && row.invoice.status !== invoiceStatusFilter) return false;
        if (!q) return true;
        return (
          row.invoice.invoiceNumber.toLowerCase().includes(q) ||
          (row.invoice.customerName?.toLowerCase().includes(q) ?? false) ||
          row.invoice.lines.some((l) => l.productName.toLowerCase().includes(q))
        );
      }

      if (!q) return true;
      const sale = row.sale;
      return (
        sale.orderId.toLowerCase().includes(q) ||
        (sale.trackingId?.toLowerCase().includes(q) ?? false) ||
        sale.productName.toLowerCase().includes(q) ||
        sale.platform.toLowerCase().includes(q) ||
        (sale.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [merged, channel, search, dateFilter, customerFilter, invoiceStatusFilter]);

  const summary = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => ({
          count: acc.count + 1,
          revenue: acc.revenue + unifiedRowRevenue(row),
          profit: acc.profit + unifiedRowProfit(row),
        }),
        { count: 0, revenue: 0, profit: 0 }
      ),
    [filtered]
  );

  const handleDelete = (row: UnifiedSalesRow) => {
    if (!company) return;
    const ref = unifiedRowReference(row);
    notification.confirm({
      title: row.kind === 'marketplace' ? 'Delete marketplace sale?' : 'Delete offline sale?',
      message: `Remove ${ref}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          if (row.kind === 'marketplace') {
            await firestoreService.sales.delete(company.id, row.id);
            await deleteSaleLinkedExpenses(company.id, row.id);
            await restoreSaleStock(company.id, row.sale);
          } else {
            if (row.invoice.stockApplied) {
              await restoreInvoiceStock(company.id, row.invoice);
            }
            await firestoreService.invoices.delete(company.id, row.id);
          }
          notification.success('Sale deleted');
          loadData();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete');
        }
      },
    });
  };

  const emptyTitle =
    channel === SalesChannelFilter.OFFLINE
      ? 'No offline sales yet'
      : channel === SalesChannelFilter.MARKETPLACE
        ? 'No marketplace sales yet'
        : 'No sales yet';

  return (
    <SectionPage
      title="Sales"
      description="Marketplace orders and offline customer sales in one place."
    >
      <div className="flex flex-wrap gap-2">
        {SALES_CHANNEL_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setChannel(option.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              channel === option.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Sales" value={String(summary.count)} tone="indigo" icon={ShoppingCart} />
        <StatCard
          label="Revenue"
          value={formatMoney(summary.revenue, currency)}
          tone="violet"
          icon={TrendingUp}
        />
        <StatCard
          label="Profit"
          value={formatMoney(summary.profit, currency)}
          tone={summary.profit >= 0 ? 'emerald' : 'rose'}
          icon={Store}
        />
      </div>

      <Card className="space-y-3">
        <div className={toolbarClass}>
          <div className={filterRowClass}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, invoice, customer, product"
              leftIcon={<Search className="w-4 h-4" />}
            />
            <FilterSelect value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </FilterSelect>
            {(channel === SalesChannelFilter.OFFLINE || channel === SalesChannelFilter.ALL) && (
              <>
                <FilterSelect
                  value={customerFilter}
                  onChange={(e) => {
                    const params = new URLSearchParams(searchParams);
                    if (e.target.value) params.set('customer', e.target.value);
                    else params.delete('customer');
                    setSearchParams(params, { replace: true });
                  }}
                  wide
                >
                  <option value="">All customers</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </FilterSelect>
                {channel === SalesChannelFilter.OFFLINE ? (
                  <FilterSelect
                    value={invoiceStatusFilter}
                    onChange={(e) => setInvoiceStatusFilter(e.target.value as InvoiceStatusFilter)}
                    wide
                  >
                    <option value="all">All statuses</option>
                    {INVOICE_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                ) : null}
              </>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => navigate('/invoices/new')} className="w-full sm:w-auto">
              <FileText className="w-4 h-4" />
              Offline sale
            </Button>
            <Button variant="primary" onClick={() => navigate('/sales/new')} className="w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Marketplace sale
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={emptyTitle}
            description="Log a marketplace order or create an offline customer sale."
            action={
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => navigate('/invoices/new')}>
                  Offline sale
                </Button>
                <Button variant="primary" onClick={() => navigate('/sales/new')}>
                  Marketplace sale
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500">
                    <th className={tableHeadCellClass}>Date</th>
                    <th className={tableHeadCellClass}>Type</th>
                    <th className={tableHeadCellClass}>Reference</th>
                    <th className={tableHeadCellClass}>Customer / Product</th>
                    <th className={tableHeadCellClass}>Status</th>
                    <th className={tableHeadCellClass}>Payment</th>
                    <th className={`${tableHeadCellClass} text-right`}>Amount</th>
                    <th className={`${tableHeadCellClass} text-right`}>Profit</th>
                    <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td className={tableCellClass}>{formatDateLocal(row.date)}</td>
                      <td className={tableCellClass}>
                        <span
                          className={`inline-flex text-xs px-2 py-0.5 rounded-full ${
                            row.kind === 'marketplace'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                              : 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
                          }`}
                        >
                          {salesKindLabel(row.kind)}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <Link
                          to={unifiedRowDetailPath(row)}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {unifiedRowReference(row)}
                        </Link>
                      </td>
                      <td className={tableTruncateCellClass}>{unifiedRowSubtitle(row)}</td>
                      <td className={tableCellClass}>
                        {row.kind === 'marketplace' ? (
                          <SaleStatusBadge status={row.sale.status} />
                        ) : (
                          invoiceStatusLabel(row.invoice.status)
                        )}
                      </td>
                      <td className={tableCellClass}>
                        {purchasePaymentStatusLabel(
                          row.kind === 'marketplace'
                            ? normalizeSalePaymentStatus(row.sale.paymentStatus)
                            : row.invoice.paymentStatus
                        )}
                      </td>
                      <td className={`${tableCellClass} text-right tabular-nums`}>
                        {formatMoney(unifiedRowRevenue(row), currency)}
                      </td>
                      <td
                        className={`${tableCellClass} text-right tabular-nums font-medium ${
                          unifiedRowProfit(row) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatMoney(unifiedRowProfit(row), currency)}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(unifiedRowDetailPath(row))}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(unifiedRowPrintPath(row))}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="Print invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(unifiedRowEditPath(row))}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtered.map((row) => (
                <div
                  key={`${row.kind}-${row.id}-mobile`}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-flex text-[10px] px-2 py-0.5 rounded-full mb-1 ${
                          row.kind === 'marketplace'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        {salesKindLabel(row.kind)}
                      </span>
                      <p className="font-semibold">
                        <Link to={unifiedRowDetailPath(row)} className="hover:text-indigo-600">
                          {unifiedRowReference(row)}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500">{formatDateLocal(row.date)}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {unifiedRowSubtitle(row)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(unifiedRowRevenue(row), currency)}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(unifiedRowPrintPath(row))}
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(unifiedRowDetailPath(row))}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(row)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </SectionPage>
  );
}
