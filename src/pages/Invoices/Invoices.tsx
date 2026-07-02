import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, FileText, Pencil, Plus, Search, Trash2, TrendingUp, Wallet } from 'lucide-react';
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
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';
  const [searchParams] = useSearchParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [customerFilter, setCustomerFilter] = useState(() => searchParams.get('customer') ?? '');

  useEffect(() => {
    setCustomerFilter(searchParams.get('customer') ?? '');
  }, [searchParams]);

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [invoiceList, customerList] = await Promise.all([
        firestoreService.invoices.getAll(company.id),
        firestoreService.customers.getAll(company.id),
      ]);
      setInvoices(invoiceList.filter((i) => !i.deleted));
      setCustomers(customerList.filter((c) => !c.deleted));
    } catch {
      notification.error('Failed to load invoices');
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
            await restoreInvoiceStock(company.id, invoice);
          }
          await firestoreService.invoices.delete(company.id, invoice.id);
          notification.success('Invoice deleted');
          loadData();
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
        <div className={toolbarClass}>
          <div className={filterRowClass}>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, customer" leftIcon={<Search className="w-4 h-4" />} />
            <FilterSelect value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </FilterSelect>
            <FilterSelect value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} wide>
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} wide>
              <option value="all">All statuses</option>
              {INVOICE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </FilterSelect>
          </div>
          <Button variant="primary" onClick={() => navigate('/invoices/new')}>
            <Plus className="w-4 h-4" />
            New invoice
          </Button>
        </div>
        {loading ? (
          <div className="py-16 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Create invoices for your customers." action={<Button variant="primary" onClick={() => navigate('/invoices/new')}>Create invoice</Button>} />
        ) : (
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
                        <button type="button" onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Edit invoice">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(inv)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" aria-label="Delete invoice">
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
