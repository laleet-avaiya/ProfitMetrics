import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ClipboardList, Eye, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
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
import {
  PURCHASE_STATUS_OPTIONS,
  purchasePaymentStatusLabel,
  purchaseStatusLabel,
} from '../../constants/purchaseStatuses';
import { firestoreService } from '../../services/firestore';
import type { PurchaseOrder } from '../../types';
import { PurchaseOrderStatus } from '../../types';
import { formatDateLocal } from '../../utils/date';
import {
  dateFilterRange,
  isDateInRange,
  type DateFilter,
} from '../../utils/expenseHelpers';
import { formatMoney } from '../../utils/profit';
import { vendorFilterOptions } from '../../utils/vendorHelpers';
import { deletePurchaseLinkedExpenses } from '../../utils/purchaseExpenses';
import { reverseAllPurchaseStock } from '../../utils/purchaseStock';

type StatusFilter = 'all' | PurchaseOrderStatus;

function statusTone(status: PurchaseOrderStatus): string {
  if (status === PurchaseOrderStatus.RECEIVED) {
    return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200';
  }
  if (status === PurchaseOrderStatus.PARTIALLY_RECEIVED) {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
  }
  if (status === PurchaseOrderStatus.CANCELLED) {
    return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
  return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200';
}

function paymentTone(status: PurchaseOrder['paymentStatus']): string {
  if (status === 'paid') {
    return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200';
  }
  if (status === 'partial') {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
  }
  return 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200';
}

export function Purchases() {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.PURCHASES);
  const { company, user } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';
  const [searchParams] = useSearchParams();

  const [vendorFilter, setVendorFilter] = useState(() => searchParams.get('vendor') ?? '');

  const emptyData = useMemo(() => [] as PurchaseOrder[], []);

  const { data: purchases, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load purchase orders',
    fetch: async (companyId) => {
      const purchaseList = await firestoreService.purchases.getAll(companyId);
      return purchaseList.filter(notDeleted);
    },
  });

  const vendorOptions = useMemo(
    () =>
      vendorFilterOptions(
        purchases,
        (p) => p.vendorName,
        vendorFilter || undefined
      ),
    [purchases, vendorFilter]
  );

  useEffect(() => {
    setVendorFilter(searchParams.get('vendor') ?? '');
  }, [searchParams]);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = dateFilterRange(dateFilter);

    return purchases.filter((p) => {
      if (!isDateInRange(p.purchaseDate, from, to)) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (vendorFilter && p.vendorId !== vendorFilter) return false;
      if (!q) return true;
      return (
        p.poNumber.toLowerCase().includes(q) ||
        (p.reference?.toLowerCase().includes(q) ?? false) ||
        (p.vendorName?.toLowerCase().includes(q) ?? false) ||
        p.lines.some((l) => l.productName.toLowerCase().includes(q))
      );
    });
  }, [purchases, search, dateFilter, statusFilter, vendorFilter]);

  const summary = useMemo(
    () =>
      filtered.reduce(
        (acc, p) => ({
          count: acc.count + 1,
          total: acc.total + p.total,
          balanceDue: acc.balanceDue + p.balanceDue,
        }),
        { count: 0, total: 0, balanceDue: 0 }
      ),
    [filtered]
  );

  const handleDelete = (purchase: PurchaseOrder) => {
    if (!company) return;
    notification.confirm({
      title: 'Delete purchase order?',
      message: `Remove PO ${purchase.poNumber} (${formatMoney(purchase.total, currency)})? Linked payment expenses will also be removed.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await reverseAllPurchaseStock(company.id, purchase, user!.uid);
          await deletePurchaseLinkedExpenses(company.id, purchase.id, user!.uid);
          await firestoreService.purchases.delete(company.id, purchase.id, user!.uid);
          notification.success('Purchase order deleted');
          reload();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete purchase order');
        }
      },
    });
  };

  return (
    <SectionPage
      title="Purchases"
      description="Create purchase orders from vendors, track delivery receipts, payments, and inventory stock."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Orders" value={String(summary.count)} subtext="Filtered results" tone="indigo" icon={ClipboardList} />
        <StatCard
          label="Order value"
          value={formatMoney(summary.total, currency)}
          subtext="Total PO amount"
          tone="violet"
          icon={Wallet}
        />
        <StatCard
          label="Balance due"
          value={formatMoney(summary.balanceDue, currency)}
          subtext="Unpaid on filtered orders"
          tone={summary.balanceDue > 0 ? 'amber' : 'emerald'}
          icon={Building2}
        />
      </div>

      <Card className="space-y-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search PO, vendor, product"
          searchAriaLabel="Search purchases"
          actions={
            canCreate ? (
              <Button variant="primary" onClick={() => navigate('/purchases/new')} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4" />
                New purchase order
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
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                wide
                aria-label="Vendor"
              >
                <option value="">All vendors</option>
                {vendorOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                wide
                aria-label="Status"
              >
                <option value="all">All statuses</option>
                {PURCHASE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </FilterSelect>
            </>
          }
        />

        {loading ? (
          <LoadingView message="Loading purchases…" size="lg" className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={purchases.length === 0 ? 'No purchase orders yet' : 'No orders match your filters'}
            description={
              purchases.length === 0
                ? 'Record vendor purchases, receive stock, and track payments here.'
                : 'Try a different search, vendor, or date range.'
            }
            action={
              purchases.length === 0 && canCreate ? (
                <Button variant="primary" onClick={() => navigate('/purchases/new')}>
                  <Plus className="w-4 h-4" />
                  Create first PO
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
                  <th className={tableHeadCellClass}>PO #</th>
                  <th className={tableHeadCellClass}>Reference</th>
                  <th className={tableHeadCellClass}>Vendor</th>
                  <th className={tableHeadCellClass}>Status</th>
                  <th className={tableHeadCellClass}>Payment</th>
                  <th className={`${tableHeadCellClass} text-right`}>Total</th>
                  <th className={`${tableHeadCellClass} text-right`}>Balance</th>
                  <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((purchase) => (
                  <tr key={purchase.id} className="bg-white dark:bg-gray-800">
                    <td className={`${tableCellClass} text-gray-700 dark:text-gray-300`}>
                      {formatDateLocal(purchase.purchaseDate)}
                    </td>
                    <td className={tableCellClass}>
                      <Link
                        to={`/purchases/${purchase.id}`}
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {purchase.poNumber}
                      </Link>
                    </td>
                    <td className={`${tableTruncateCellClass} font-mono text-xs text-gray-600 dark:text-gray-400`}>
                      {purchase.reference ?? '—'}
                    </td>
                    <td className={`${tableTruncateCellClass} text-gray-600 dark:text-gray-400`}>
                      {purchase.vendorName ?? '—'}
                    </td>
                    <td className={tableCellClass}>
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${statusTone(purchase.status)}`}>
                        {purchaseStatusLabel(purchase.status)}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${paymentTone(purchase.paymentStatus)}`}>
                        {purchasePaymentStatusLabel(purchase.paymentStatus)}
                      </span>
                    </td>
                    <td className={`${tableCellClass} text-right tabular-nums font-medium`}>
                      {formatMoney(purchase.total, currency)}
                    </td>
                    <td className={`${tableCellClass} text-right tabular-nums text-rose-600 dark:text-rose-400`}>
                      {purchase.balanceDue > 0 ? formatMoney(purchase.balanceDue, currency) : '—'}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/purchases/${purchase.id}`)}
                          className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          aria-label={`View ${purchase.poNumber}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canUpdate ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label={`Edit ${purchase.poNumber}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(purchase)}
                            className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                            aria-label={`Delete ${purchase.poNumber}`}
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
            {filtered.map((purchase) => (
              <div
                key={purchase.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      <Link
                        to={`/purchases/${purchase.id}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {purchase.poNumber}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {purchase.vendorName ?? '—'} · {formatDateLocal(purchase.purchaseDate)}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex text-xs px-2 py-0.5 rounded-full ${statusTone(purchase.status)}`}>
                    {purchaseStatusLabel(purchase.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs tabular-nums text-gray-600 dark:text-gray-400">
                  <span className={`inline-flex px-2 py-0.5 rounded-full ${paymentTone(purchase.paymentStatus)}`}>
                    {purchasePaymentStatusLabel(purchase.paymentStatus)}
                  </span>
                  <span>
                    {formatMoney(purchase.total, currency)}
                    {purchase.balanceDue > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400"> · {formatMoney(purchase.balanceDue, currency)} due</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/purchases/${purchase.id}`)}>
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                  {canUpdate ? (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/purchases/${purchase.id}/edit`)}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(purchase)}
                      className="text-rose-600 dark:text-rose-400"
                      aria-label={`Delete ${purchase.poNumber}`}
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
