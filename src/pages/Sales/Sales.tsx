import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { SectionPage } from '../../components/SectionPage/SectionPage';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Card, StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { filterRowClass, tableCellClass, tableHeadCellClass, tableTruncateCellClass, toolbarClass } from '../../constants/ui';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Product, Sale } from '../../types';
import { formatDateLocal } from '../../utils/date';
import {
  localDateInputToUtc,
  localDateInputToUtcEndOfDay,
  utcToLocalDateInput,
} from '../../utils/firestoreDates';
import { formatMoney, formatPercent } from '../../utils/profit';
import { deleteSaleLinkedExpenses } from '../../utils/saleExpenses';
import { getActiveProducts } from '../../utils/saleHelpers';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';
import { SALE_STATUS_OPTIONS, normalizeSaleStatus } from '../../constants/saleStatuses';
import { SaleStatus } from '../../types';

type DateFilter = 'all' | 'today' | '7d' | '30d';
type StatusFilter = 'all' | SaleStatus;

function startOfLocalTodayStr(): string {
  return utcToLocalDateInput(new Date());
}

function dateFilterRange(filter: DateFilter): { from?: Date; to?: Date } {
  if (filter === 'all') return {};
  const today = startOfLocalTodayStr();
  if (filter === 'today') {
    return {
      from: localDateInputToUtc(today),
      to: localDateInputToUtcEndOfDay(today),
    };
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (filter === '7d') d.setDate(d.getDate() - 6);
  if (filter === '30d') d.setDate(d.getDate() - 29);
  return {
    from: d,
    to: localDateInputToUtcEndOfDay(today),
  };
}

function saleInDateRange(sale: Sale, from?: Date, to?: Date): boolean {
  const t = sale.orderDate.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export function Sales() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const activeProducts = useMemo(() => getActiveProducts(products), [products]);

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [salesList, productsList] = await Promise.all([
        firestoreService.sales.getAll(company.id),
        firestoreService.products.getAll(company.id),
      ]);
      setSales(salesList.filter((s) => !s.deleted));
      setProducts(productsList.filter((p) => !p.deleted));
    } catch (err) {
      console.error('Failed to load sales:', err);
      notification.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = dateFilterRange(dateFilter);

    return sales.filter((s) => {
      if (!saleInDateRange(s, from, to)) return false;
      if (statusFilter !== 'all' && normalizeSaleStatus(s.status) !== statusFilter) return false;
      if (!q) return true;
      return (
        s.orderId.toLowerCase().includes(q) ||
        (s.trackingId?.toLowerCase().includes(q) ?? false) ||
        s.productName.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q) ||
        (s.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [sales, search, dateFilter, statusFilter]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, s) => ({
        count: acc.count + 1,
        returned: acc.returned + (normalizeSaleStatus(s.status) === SaleStatus.RETURNED ? 1 : 0),
        revenue: acc.revenue + s.grossRevenue,
        profit: acc.profit + s.profit,
      }),
      { count: 0, returned: 0, revenue: 0, profit: 0 }
    );
  }, [filtered]);

  const openCreate = () => navigate('/sales/new');

  const openDetail = (sale: Sale) => navigate(`/sales/${sale.id}`);

  const handleDelete = (sale: Sale) => {
    if (!company) return;
    notification.confirm({
      title: 'Delete sale?',
      message: `Remove order ${sale.orderId} (${sale.productName})? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await firestoreService.sales.delete(company.id, sale.id);
          try {
            await deleteSaleLinkedExpenses(company.id, sale.id);
          } catch (syncErr) {
            console.error('Failed to delete linked expenses:', syncErr);
          }
          notification.success('Sale deleted');
          loadData();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete sale');
        }
      },
    });
  };

  return (
    <SectionPage
      title="Sales"
      description="Log daily orders. Select a product and platform — costs auto-fill from your listing, then profit is calculated instantly."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: 'Orders',
            value: String(summary.count),
            subtext:
              summary.returned > 0
                ? `${summary.returned} returned in filter`
                : 'Filtered results',
          },
          { label: 'Revenue', value: formatMoney(summary.revenue, currency), subtext: 'Filtered results' },
          { label: 'Order profit', value: formatMoney(summary.profit, currency), subtext: 'Filtered results' },
        ].map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} subtext={stat.subtext} />
        ))}
      </div>

      <Card className="space-y-3">
        <div className={toolbarClass}>
          <div className={filterRowClass}>
            <div className="flex-1 min-w-[200px] max-w-md">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order ID, tracking, product, notes"
                leftIcon={<Search className="w-4 h-4" />}
                aria-label="Search sales"
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {SALE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              aria-label="Filter by date"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </FilterSelect>
          </div>
          <Button variant="primary" onClick={openCreate} disabled={activeProducts.length === 0}>
            <Plus className="w-4 h-4" />
            Add sale
          </Button>
        </div>

        {activeProducts.length === 0 && !loading && (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            No active products yet.{' '}
            <Link to="/products" className="font-medium underline">
              Add a product
            </Link>{' '}
            with platform listings before logging sales.
          </p>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading sales…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={sales.length === 0 ? 'No sales logged yet' : 'No sales match your filters'}
            description={
              sales.length === 0
                ? 'Log your first order to start tracking per-order profit.'
                : 'Try a different search or date range.'
            }
            action={
              sales.length === 0 && activeProducts.length > 0 ? (
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" />
                  Log first sale
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className={tableHeadCellClass}>Date</th>
                    <th className={tableHeadCellClass}>Order ID</th>
                    <th className={tableHeadCellClass}>Tracking</th>
                    <th className={tableHeadCellClass}>Product</th>
                    <th className={tableHeadCellClass}>Platform</th>
                    <th className={tableHeadCellClass}>Status</th>
                    <th className={tableHeadCellClass}>Qty</th>
                    <th className={`${tableHeadCellClass} text-right`}>Revenue</th>
                    <th className={`${tableHeadCellClass} text-right`}>Profit</th>
                    <th className={`${tableHeadCellClass} text-right`}>Margin</th>
                    <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((sale) => (
                    <tr key={sale.id} className="bg-white dark:bg-gray-800">
                      <td className={`${tableCellClass} text-gray-700 dark:text-gray-300`}>
                        {formatDateLocal(sale.orderDate)}
                      </td>
                      <td className={`${tableTruncateCellClass} font-medium text-gray-900 dark:text-white`}>
                        <Link
                          to={`/sales/${sale.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                        >
                          {sale.orderId}
                        </Link>
                      </td>
                      <td className={`${tableTruncateCellClass} text-gray-600 dark:text-gray-400`}>
                        {sale.trackingId ?? '—'}
                      </td>
                      <td className={`${tableTruncateCellClass} text-gray-700 dark:text-gray-300`}>
                        {sale.productName}
                      </td>
                      <td className={tableCellClass}>
                        <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {sale.platform}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <SaleStatusBadge status={sale.status} />
                      </td>
                      <td className={`${tableCellClass} tabular-nums`}>{sale.quantity}</td>
                      <td className={`${tableCellClass} text-right tabular-nums`}>
                        {formatMoney(sale.grossRevenue, currency)}
                      </td>
                      <td
                        className={`${tableCellClass} text-right tabular-nums font-medium ${
                          sale.profit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatMoney(sale.profit, currency)}
                      </td>
                      <td
                        className={`${tableCellClass} text-right tabular-nums ${
                          sale.profit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatPercent(sale.profitMarginPercent)}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(sale)}
                            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label={`Edit order ${sale.orderId}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(sale)}
                            className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            aria-label={`Delete order ${sale.orderId}`}
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
              {filtered.map((sale) => (
                <div
                  key={sale.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        <Link
                          to={`/sales/${sale.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                        >
                          {sale.orderId}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateLocal(sale.orderDate)} · {sale.productName}
                      </p>
                      {sale.trackingId && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Track: {sale.trackingId}
                        </p>
                      )}
                      {sale.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {sale.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SaleStatusBadge status={sale.status} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {sale.platform}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-gray-600 dark:text-gray-400">
                    <span>Qty {sale.quantity}</span>
                    <span>Rev {formatMoney(sale.grossRevenue, currency)}</span>
                    <span
                      className={
                        sale.profit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-red-600 dark:text-red-400 font-medium'
                      }
                    >
                      Profit {formatMoney(sale.profit, currency)} ({formatPercent(sale.profitMarginPercent)})
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(sale)}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(sale)}
                      className="text-red-600 dark:text-red-400"
                      aria-label="Delete"
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
