import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react';
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
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { useNotification } from '../../hooks/useNotification';
import { PAYMENT_KIND_OPTIONS, paymentKindLabel } from '../../constants/paymentKinds';
import { paymentModeLabel } from '../../constants/paymentModes';
import { firestoreService } from '../../services/firestore';
import type { Payment } from '../../types';
import { PaymentKind } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { dateFilterRange, isDateInRange, type DateFilter } from '../../utils/expenseHelpers';
import { getPaymentDisplaySource, syncInvoicePaymentRollup } from '../../utils/paymentHelpers';
import { formatMoney } from '../../utils/profit';

type KindFilter = 'all' | PaymentKind;
type PlatformFilter = 'all' | string;

export function Payments() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { summary: marketplaceSummary, getFilterPlatformOptions } = useCompanyMarketplaces();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const list = await firestoreService.payments.getAll(company.id);
      setPayments(list.filter((p) => !p.deleted));
    } catch {
      notification.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        await firestoreService.payments.delete(company.id, payment.id);
        if (payment.invoiceId) {
          await syncInvoicePaymentRollup(company.id, payment.invoiceId);
        }
        notification.success('Payment deleted');
        loadData();
      },
    });
  };

  return (
    <SectionPage
      title="Payments"
      description={`Money received — invoice payments, direct receipts, and marketplace payouts (${marketplaceSummary}).`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard label="Payments" value={String(summary.count)} subtext="Filtered results" />
        <StatCard label="Total received" value={formatMoney(summary.total, currency)} subtext="Filtered period" />
      </div>
      <Card className="space-y-3">
        <div className={toolbarClass}>
          <div className={filterRowClass}>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, customer, platform" leftIcon={<Search className="w-4 h-4" />} />
            <FilterSelect value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </FilterSelect>
            <FilterSelect value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} wide>
              <option value="all">All types</option>
              {PAYMENT_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} wide>
              <option value="all">All marketplaces</option>
              {platformFilterOptions.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </FilterSelect>
          </div>
          <Button variant="primary" onClick={() => navigate('/payments/new')}>
            <Plus className="w-4 h-4" />
            Record payment
          </Button>
        </div>
        {loading ? (
          <div className="py-16 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Record invoice payments, direct receipts, or marketplace payouts." action={<Button variant="primary" onClick={() => navigate('/payments/new')}>Record payment</Button>} />
        ) : (
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
                        <button type="button" onClick={() => navigate(`/payments/${payment.id}/edit`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Edit payment">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(payment)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" aria-label="Delete payment">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </SectionPage>
  );
}
