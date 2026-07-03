import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, FileText, Pencil, Plus, Trash2, TrendingUp, Wallet } from 'lucide-react';
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
import { INVOICE_STATUS_OPTIONS, invoiceStatusLabel } from '../../constants/invoiceStatuses';
import { purchasePaymentStatusLabel } from '../../constants/purchaseStatuses';
import { firestoreService } from '../../services/firestore';
import type { Customer, Invoice } from '../../types';
import { InvoiceStatus } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { dateFilterRange, isDateInRange, type DateFilter } from '../../utils/expenseHelpers';
import { formatMoney } from '../../utils/profit';
import { restoreInvoiceStock } from '../../utils/invoiceStock';

type StatusFilter = 'all' | InvoiceStatus;

export function Invoices() {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.INVOICES);
  const { company, user } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';
  const [searchParams] = useSearchParams();

  const [customerFilter, setCustomerFilter] = useState(() => searchParams.get('customer') ?? '');

  const emptyData = useMemo(
    () => ({ invoices: [] as Invoice[], customers: [] as Customer[] }),
    []
  );

  const { data, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load invoices',
    fetch: async (companyId) => {
      const [invoiceList, customerList] = await Promise.all([
        firestoreService.invoices.getAll(companyId),
        firestoreService.customers.getAll(companyId),
      ]);
      return {
        invoices: invoiceList.filter(notDeleted),
        customers: customerList.filter(notDeleted),
      };
    },
  });

  const { invoices, customers } = data;

  useEffect(() => {
    setCustomerFilter(searchParams.get('customer') ?? '');
  }, [searchParams]);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = dateFilterRange(dateFilter);
    return invoices.filter((inv) => {
      if (!isDateInRange(inv.invoiceDate, from, to)) return false;
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (customerFilter && inv.customerId !== customerFilter) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.customerName?.toLowerCase().includes(q) ?? false) ||
        inv.lines.some((l) => l.productName.toLowerCase().includes(q))
      );
    });
  }, [invoices, search, dateFilter, statusFilter, customerFilter]);

  const summary = useMemo(
    () =>
      filtered.reduce(
        (acc, inv) => ({
          count: acc.count + 1,
          total: acc.total + inv.total,
          balanceDue: acc.balanceDue + inv.balanceDue,
        }),
        { count: 0, total: 0, balanceDue: 0 }
      ),
    [filtered]
  );

  const handleDelete = (invoice: Invoice) => {
    if (!company) return;
    notification.confirm({
      title: 'Delete invoice?',
      message: `Remove ${invoice.invoiceNumber}?`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          if (invoice.stockApplied) {
            await restoreInvoiceStock(company.id, invoice, user!.uid);
          }
          await firestoreService.invoices.delete(company.id, invoice.id, user!.uid);
          notification.success('Invoice deleted');
          reload();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete invoice');
        }
      },
    });
  };

  return (
    <SectionPage
      title="Invoices"
      description="Customer invoices with products, taxes, and payment tracking."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Invoices" value={String(summary.count)} tone="indigo" icon={FileText} />
        <StatCard
          label="Total invoiced"
          value={formatMoney(summary.total, currency)}
          tone="violet"
          icon={TrendingUp}
        />
        <StatCard
          label="Balance due"
          value={formatMoney(summary.balanceDue, currency)}
          tone={summary.balanceDue > 0 ? 'amber' : 'emerald'}
          icon={Wallet}
        />
      </div>
      <Card className="space-y-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search invoice, customer"
          searchAriaLabel="Search invoices"
          actions={
            canCreate ? (
              <Button variant="primary" onClick={() => navigate('/invoices/new')} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4" />
                New invoice
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
              <FilterSelect value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} wide aria-label="Customer">
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </FilterSelect>
              <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} wide aria-label="Invoice status">
                <option value="all">All statuses</option>
                {INVOICE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FilterSelect>
            </>
          }
        />
        {loading ? (
          <LoadingView message="Loading invoices…" size="lg" className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Create invoices for your customers." action={canCreate ? <Button variant="primary" onClick={() => navigate('/invoices/new')}>Create invoice</Button> : undefined} />
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500">
                  <th className={tableHeadCellClass}>Date</th>
                  <th className={tableHeadCellClass}>Invoice</th>
                  <th className={tableHeadCellClass}>Customer</th>
                  <th className={tableHeadCellClass}>Status</th>
                  <th className={tableHeadCellClass}>Payment</th>
                  <th className={`${tableHeadCellClass} text-right`}>Total</th>
                  <th className={`${tableHeadCellClass} text-right`}>Balance</th>
                  <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td className={tableCellClass}>{formatDateLocal(inv.invoiceDate)}</td>
                    <td className={tableCellClass}>
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">{inv.invoiceNumber}</Link>
                    </td>
                    <td className={tableTruncateCellClass}>{inv.customerName ?? '—'}</td>
                    <td className={tableCellClass}>{invoiceStatusLabel(inv.status)}</td>
                    <td className={tableCellClass}>{purchasePaymentStatusLabel(inv.paymentStatus)}</td>
                    <td className={`${tableCellClass} text-right tabular-nums`}>{formatMoney(inv.total, currency)}</td>
                    <td className={`${tableCellClass} text-right tabular-nums text-rose-600`}>
                      {inv.balanceDue > 0 ? formatMoney(inv.balanceDue, currency) : '—'}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => navigate(`/invoices/${inv.id}`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="View invoice">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canUpdate ? (
                          <button type="button" onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Edit invoice">
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" onClick={() => handleDelete(inv)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" aria-label="Delete invoice">
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
            {filtered.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      <Link to={`/invoices/${inv.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {inv.customerName ?? '—'} · {formatDateLocal(inv.invoiceDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {invoiceStatusLabel(inv.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs tabular-nums text-gray-600 dark:text-gray-400">
                  <span>{purchasePaymentStatusLabel(inv.paymentStatus)}</span>
                  <span>
                    {formatMoney(inv.total, currency)}
                    {inv.balanceDue > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400"> · {formatMoney(inv.balanceDue, currency)} due</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                  {canUpdate ? (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(inv)}
                      className="text-rose-600 dark:text-rose-400"
                      aria-label="Delete invoice"
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
