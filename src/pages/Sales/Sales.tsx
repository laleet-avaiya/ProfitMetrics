import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  Pencil,
  Plus,
  Printer,
  ShoppingCart,
  Store,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { SectionPage } from '../../components/SectionPage/SectionPage';
import { Button } from '../../components/Button/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { FilterSelect } from '../../components/ui/FilterSelect';
import {
  tableCellClass,
  tableHeadCellClass,
  tableTruncateCellClass,
} from '../../constants/ui';
import { useModuleAccess } from '../../hooks/usePermissions';
import { AppModule } from '../../constants/permissions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { notDeleted, useEntityList } from '../../hooks/useEntityList';
import { purchasePaymentStatusLabel, normalizeSalePaymentStatus } from '../../constants/purchaseStatuses';
import { firestoreService } from '../../services/firestore';
import type { Customer, Sale } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { dateFilterRange, isDateInRange, type DateFilter } from '../../utils/expenseHelpers';
import { formatMoney } from '../../utils/profit';
import { getSaleProfit } from '../../utils/saleHelpers';
import { deleteSaleLinkedExpenses } from '../../utils/saleExpenses';
import { restoreSaleStock } from '../../utils/saleStock';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';

function saleReference(sale: Sale): string {
  return sale.orderNumber ?? sale.orderId ?? '—';
}

function saleSubtitle(sale: Sale): string {
  return sale.customerName ?? sale.productName ?? '—';
}

function saleRevenue(sale: Sale): number {
  return sale.total ?? sale.grossRevenue;
}

export function Sales() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    canCreate: canCreateSale,
    canUpdate: canUpdateSale,
    canDelete: canDeleteSale,
  } = useModuleAccess(AppModule.SALES);
  const { company, user } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const customerFilter = searchParams.get('customer') ?? '';

  const emptyData = useMemo(
    () => ({
      sales: [] as Sale[],
      customers: [] as Customer[],
    }),
    []
  );

  const { data, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load sales',
    fetch: async (companyId) => {
      const [salesList, customerList] = await Promise.all([
        firestoreService.sales.getAll(companyId),
        firestoreService.customers.getAll(companyId),
      ]);
      return {
        sales: salesList.filter(notDeleted),
        customers: customerList.filter(notDeleted),
      };
    },
  });

  const { sales, customers } = data;

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = dateFilterRange(dateFilter);

    return sales
      .filter((sale) => {
        if (!isDateInRange(sale.orderDate, from, to)) return false;
        if (customerFilter && sale.customerId !== customerFilter) return false;
        if (!q) return true;
        return (
          (sale.orderNumber?.toLowerCase().includes(q) ?? false) ||
          (sale.orderId?.toLowerCase().includes(q) ?? false) ||
          (sale.trackingId?.toLowerCase().includes(q) ?? false) ||
          sale.productName.toLowerCase().includes(q) ||
          sale.platform.toLowerCase().includes(q) ||
          (sale.customerName?.toLowerCase().includes(q) ?? false) ||
          (sale.notes?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
  }, [sales, search, dateFilter, customerFilter]);

  const summary = useMemo(
    () =>
      filtered.reduce(
        (acc, sale) => ({
          count: acc.count + 1,
          revenue: acc.revenue + saleRevenue(sale),
          profit: acc.profit + getSaleProfit(sale),
        }),
        { count: 0, revenue: 0, profit: 0 }
      ),
    [filtered]
  );

  const handleDelete = (sale: Sale) => {
    if (!company) return;
    notification.confirm({
      title: 'Delete sale?',
      message: `Remove ${saleReference(sale)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await firestoreService.sales.delete(company.id, sale.id, user!.uid);
          await deleteSaleLinkedExpenses(company.id, sale.id, user!.uid);
          await restoreSaleStock(company.id, sale, user!.uid);
          notification.success('Sale deleted');
          await reload();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete');
        }
      },
    });
  };

  return (
    <SectionPage
      title="Sales"
      description="Customer orders with delivery, customer, and payment details."
    >
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
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search orders, customers, products…"
          searchAriaLabel="Search sales"
          actions={
            canCreateSale ? (
              <Button
                variant="primary"
                onClick={() => navigate('/sales/new')}
                className="flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4" />
                New sale
              </Button>
            ) : undefined
          }
          filters={
            <>
              <FilterSelect
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                aria-label="Date range"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </FilterSelect>
              <FilterSelect
                value={customerFilter}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) params.set('customer', e.target.value);
                  else params.delete('customer');
                  setSearchParams(params, { replace: true });
                }}
                wide
                aria-label="Customer"
              >
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </FilterSelect>
            </>
          }
        />

        {loading ? (
          <LoadingView message="Loading sales…" size="lg" className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No sales yet"
            description="Log a sale with customer and payment details."
            action={
              canCreateSale ? (
                <Button variant="primary" onClick={() => navigate('/sales/new')}>
                  <Plus className="w-4 h-4" />
                  New sale
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500">
                    <th className={tableHeadCellClass}>Date</th>
                    <th className={tableHeadCellClass}>Order</th>
                    <th className={tableHeadCellClass}>Customer / Product</th>
                    <th className={tableHeadCellClass}>Status</th>
                    <th className={tableHeadCellClass}>Payment</th>
                    <th className={`${tableHeadCellClass} text-right`}>Amount</th>
                    <th className={`${tableHeadCellClass} text-right`}>Profit</th>
                    <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((sale) => (
                    <tr key={sale.id}>
                      <td className={tableCellClass}>{formatDateLocal(sale.orderDate)}</td>
                      <td className={tableCellClass}>
                        <Link
                          to={`/sales/${sale.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {saleReference(sale)}
                        </Link>
                      </td>
                      <td className={tableTruncateCellClass}>{saleSubtitle(sale)}</td>
                      <td className={tableCellClass}>
                        <SaleStatusBadge status={sale.status} />
                      </td>
                      <td className={tableCellClass}>
                        {purchasePaymentStatusLabel(normalizeSalePaymentStatus(sale.paymentStatus))}
                      </td>
                      <td className={`${tableCellClass} text-right tabular-nums`}>
                        {formatMoney(saleRevenue(sale), currency)}
                      </td>
                      <td
                        className={`${tableCellClass} text-right tabular-nums font-medium ${
                          getSaleProfit(sale) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatMoney(getSaleProfit(sale), currency)}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/${sale.id}`)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/${sale.id}/print`)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="Print invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {canUpdateSale ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/sales/${sale.id}/edit`)}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              aria-label="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ) : null}
                          {canDeleteSale ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(sale)}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
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
                  key={`${sale.id}-mobile`}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        <Link to={`/sales/${sale.id}`} className="hover:text-indigo-600">
                          {saleReference(sale)}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500">{formatDateLocal(sale.orderDate)}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {saleSubtitle(sale)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(saleRevenue(sale), currency)}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/sales/${sale.id}/print`)}
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/sales/${sale.id}`)}
                    >
                      View
                    </Button>
                    {canDeleteSale ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sale)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : null}
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
