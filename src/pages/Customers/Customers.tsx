import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2, UserCircle } from 'lucide-react';
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
import { firestoreService } from '../../services/firestore';
import type { Customer, Invoice } from '../../types';
import { isReportableInvoice } from '../../utils/reports';
import { nowUtc } from '../../utils/firestoreDates';
import { formatMoney } from '../../utils/profit';

type StatusFilter = 'active' | 'archived' | 'all';

export function Customers() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [customerList, invoiceList] = await Promise.all([
        firestoreService.customers.getAll(company.id),
        firestoreService.invoices.getAll(company.id),
      ]);
      setCustomers(customerList.filter((c) => !c.deleted));
      setInvoices(invoiceList.filter((i) => !i.deleted));
    } catch (err) {
      console.error(err);
      notification.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const invoiceStats = useMemo(() => {
    const map = new Map<string, { count: number; balanceDue: number }>();
    for (const inv of invoices) {
      if (!inv.customerId || !isReportableInvoice(inv)) continue;
      const prev = map.get(inv.customerId) ?? { count: 0, balanceDue: 0 };
      map.set(inv.customerId, {
        count: prev.count + 1,
        balanceDue: prev.balanceDue + inv.balanceDue,
      });
    }
    return map;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter === 'active' && c.status !== 'active') return false;
      if (statusFilter === 'archived' && c.status !== 'archived') return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.contactName?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [customers, search, statusFilter]);

  const toggleArchive = (customer: Customer) => {
    if (!company) return;
    const next = customer.status === 'active' ? 'archived' : 'active';
    firestoreService.customers
      .update(company.id, customer.id, { status: next, updatedAt: nowUtc() })
      .then(() => {
        notification.success(next === 'archived' ? 'Customer archived' : 'Customer restored');
        loadData();
      })
      .catch(() => notification.error('Failed to update customer'));
  };

  const handleDelete = (customer: Customer) => {
    if (!company) return;
    notification.confirm({
      title: 'Delete customer?',
      message: `Remove "${customer.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        await firestoreService.customers.delete(company.id, customer.id);
        notification.success('Customer deleted');
        loadData();
      },
    });
  };

  return (
    <SectionPage
      title="Customers"
      description="Buyers for offline sales and invoicing."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard label="Customers" value={String(filtered.length)} subtext="Filtered results" />
        <StatCard
          label="Open balances"
          value={formatMoney(
            filtered.reduce((s, c) => s + (invoiceStats.get(c.id)?.balanceDue ?? 0), 0),
            currency
          )}
          subtext="Unpaid on invoices"
        />
      </div>

      <Card className="space-y-3">
        <div className={toolbarClass}>
          <div className={filterRowClass}>
            <div className="flex-1 min-w-[200px] max-w-md">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone"
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </FilterSelect>
          </div>
          <Button variant="primary" onClick={() => navigate('/customers/new')}>
            <Plus className="w-4 h-4" />
            Add customer
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserCircle}
            title="No customers yet"
            description="Add customers when you create offline invoices."
            action={
              <Button variant="primary" onClick={() => navigate('/customers/new')}>
                <Plus className="w-4 h-4" />
                Add customer
              </Button>
            }
          />
        ) : (
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className={tableHeadCellClass}>Customer</th>
                  <th className={tableHeadCellClass}>Contact</th>
                  <th className={tableHeadCellClass}>Email</th>
                  <th className={tableHeadCellClass}>Status</th>
                  <th className={`${tableHeadCellClass} text-right`}>Invoices</th>
                  <th className={`${tableHeadCellClass} text-right`}>Balance</th>
                  <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((customer) => {
                  const stats = invoiceStats.get(customer.id);
                  return (
                    <tr key={customer.id} className="bg-white dark:bg-gray-800">
                      <td className={`${tableTruncateCellClass} font-medium`}>
                        <Link to={`/customers/${customer.id}`} className="hover:text-indigo-600 hover:underline">
                          {customer.name}
                        </Link>
                      </td>
                      <td className={tableTruncateCellClass}>{customer.contactName ?? customer.phone ?? '—'}</td>
                      <td className={tableTruncateCellClass}>{customer.email ?? '—'}</td>
                      <td className={tableCellClass}>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                          {customer.status}
                        </span>
                      </td>
                      <td className={`${tableCellClass} text-right tabular-nums`}>{stats?.count ?? 0}</td>
                      <td className={`${tableCellClass} text-right tabular-nums text-rose-600`}>
                        {(stats?.balanceDue ?? 0) > 0 ? formatMoney(stats!.balanceDue, currency) : '—'}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => navigate(`/customers/${customer.id}/edit`)} className="p-2 rounded-lg hover:bg-gray-100">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => toggleArchive(customer)} className="p-2 rounded-lg hover:bg-gray-100">
                            {customer.status === 'active' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                          </button>
                          <button type="button" onClick={() => handleDelete(customer)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </SectionPage>
  );
}
