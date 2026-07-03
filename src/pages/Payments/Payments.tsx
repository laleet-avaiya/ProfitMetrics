import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Trash2, TrendingUp, Wallet } from 'lucide-react';
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
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { useNotification } from '../../hooks/useNotification';
import { notDeleted, useEntityList } from '../../hooks/useEntityList';
import { PAYMENT_KIND_OPTIONS, paymentKindLabel } from '../../constants/paymentKinds';
import { paymentModeLabel } from '../../constants/paymentModes';
import { firestoreService } from '../../services/firestore';
import type { Payment } from '../../types';
import { PaymentKind } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { dateFilterRange, isDateInRange, type DateFilter } from '../../utils/expenseHelpers';
import { getPaymentDisplaySource, syncSalePaymentRollup } from '../../utils/paymentHelpers';
import { formatMoney } from '../../utils/profit';

type KindFilter = 'all' | PaymentKind;
type PlatformFilter = 'all' | string;

export function Payments() {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.PAYMENTS);
  const { company, user } = useAuth();
  const { summary: marketplaceSummary, getFilterPlatformOptions } = useCompanyMarketplaces();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const emptyData = useMemo(() => [] as Payment[], []);

  const { data: payments, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load payments',
    fetch: async (companyId) => {
      const list = await firestoreService.payments.getAll(companyId);
      return list.filter(notDeleted);
    },
  });

  const platformFilterOptions = useMemo(
    () =>
      getFilterPlatformOptions(
        payments.filter((p) => p.platform).map((p) => p.platform as string)
      ),
    [getFilterPlatformOptions, payments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = dateFilterRange(dateFilter);
    return payments.filter((p) => {
      if (!isDateInRange(p.paymentDate, from, to)) return false;
      if (kindFilter !== 'all' && p.kind !== kindFilter) return false;
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      if (!q) return true;
      return (
        (p.reference?.toLowerCase().includes(q) ?? false) ||
        (p.customerName?.toLowerCase().includes(q) ?? false) ||
        (p.platform?.toLowerCase().includes(q) ?? false) ||
        (p.invoiceNumber?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [payments, search, dateFilter, kindFilter, platformFilter]);

  const summary = useMemo(
    () => filtered.reduce((acc, p) => ({ count: acc.count + 1, total: acc.total + p.amount }), { count: 0, total: 0 }),
    [filtered]
  );

  const handleDelete = (payment: Payment) => {
    if (!company) return;
    notification.confirm({
      title: 'Delete payment?',
      message: `Remove payment of ${formatMoney(payment.amount, currency)}?`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        await firestoreService.payments.delete(company.id, payment.id, user!.uid);
        if (payment.saleId) {
          await syncSalePaymentRollup(company.id, payment.saleId, user!.uid);
        }
        notification.success('Payment deleted');
        reload();
      },
    });
  };

  return (
    <SectionPage
      title="Payments"
      description={`Money received — sale payments, direct receipts, and marketplace payouts (${marketplaceSummary}).`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard label="Payments" value={String(summary.count)} subtext="Filtered results" tone="indigo" icon={Wallet} />
        <StatCard
          label="Total received"
          value={formatMoney(summary.total, currency)}
          subtext="Filtered period"
          tone="emerald"
          icon={TrendingUp}
        />
      </div>
      <Card className="space-y-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reference, customer, platform"
          searchAriaLabel="Search payments"
          actions={
            canCreate ? (
              <Button variant="primary" onClick={() => navigate('/payments/new')} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4" />
                Record payment
              </Button>
            ) : undefined
          }
          filters={
            <>
              <FilterSelect value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} aria-label="Date range">
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </FilterSelect>
              <FilterSelect value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} wide aria-label="Payment type">
                <option value="all">All types</option>
                {PAYMENT_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FilterSelect>
              <FilterSelect value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} wide aria-label="Marketplace">
                <option value="all">All marketplaces</option>
                {platformFilterOptions.map((platform) => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </FilterSelect>
            </>
          }
        />
        {loading ? (
          <LoadingView message="Loading payments…" size="lg" className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Record sale payments, direct receipts, or marketplace payouts." action={canCreate ? <Button variant="primary" onClick={() => navigate('/payments/new')}>Record payment</Button> : undefined} />
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500">
                  <th className={tableHeadCellClass}>Date</th>
                  <th className={tableHeadCellClass}>Type</th>
                  <th className={tableHeadCellClass}>Mode</th>
                  <th className={tableHeadCellClass}>Source</th>
                  <th className={tableHeadCellClass}>Reference</th>
                  <th className={`${tableHeadCellClass} text-right`}>Amount</th>
                  <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((payment) => (
                  <tr key={payment.id}>
                    <td className={tableCellClass}>{formatDateLocal(payment.paymentDate)}</td>
                    <td className={tableCellClass}>{paymentKindLabel(payment.kind)}</td>
                    <td className={tableCellClass}>{paymentModeLabel(payment.paymentMode)}</td>
                    <td className={tableTruncateCellClass}>
                      <Link to={`/payments/${payment.id}`} className="hover:text-indigo-600 hover:underline">
                        {getPaymentDisplaySource(payment)}
                      </Link>
                    </td>
                    <td className={tableTruncateCellClass}>{payment.reference ?? '—'}</td>
                    <td className={`${tableCellClass} text-right tabular-nums font-medium text-emerald-700`}>
                      {formatMoney(payment.amount, currency)}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => navigate(`/payments/${payment.id}`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="View payment">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canUpdate ? (
                          <button type="button" onClick={() => navigate(`/payments/${payment.id}/edit`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Edit payment">
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" onClick={() => handleDelete(payment)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" aria-label="Delete payment">
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
            {filtered.map((payment) => (
              <div
                key={payment.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      <Link to={`/payments/${payment.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">
                        {getPaymentDisplaySource(payment)}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {paymentKindLabel(payment.kind)} · {formatDateLocal(payment.paymentDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatMoney(payment.amount, currency)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {paymentModeLabel(payment.paymentMode)}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/payments/${payment.id}`)}>
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                  {canUpdate ? (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/payments/${payment.id}/edit`)}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(payment)}
                      className="text-rose-600 dark:text-rose-400"
                      aria-label="Delete payment"
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
