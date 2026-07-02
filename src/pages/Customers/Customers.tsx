import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Eye, Pencil, Plus, Trash2, UserCircle, Wallet } from 'lucide-react';
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
import { firestoreService } from '../../services/firestore';
import type { Customer, Invoice } from '../../types';
import { isReportableInvoice } from '../../utils/reports';
import { nowUtc } from '../../utils/firestoreDates';
import { formatMoney } from '../../utils/profit';

type StatusFilter = 'active' | 'archived' | 'all';

export function Customers() {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.CUSTOMERS);
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const emptyData = useMemo(
    () => ({ customers: [] as Customer[], invoices: [] as Invoice[] }),
    []
  );

  const { data, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load customers',
    fetch: async (companyId) => {
      const [customerList, invoiceList] = await Promise.all([
        firestoreService.customers.getAll(companyId),
        firestoreService.invoices.getAll(companyId),
      ]);
      return {
        customers: customerList.filter(notDeleted),
        invoices: invoiceList.filter(notDeleted),
      };
    },
  });

  const { customers, invoices } = data;
  const [search, setSearch] = useState('');

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
        reload();
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
        reload();
      },
    });
  };

  return (
    <SectionPage
      title="Customers"
      description="Buyers for invoicing and payment tracking."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard label="Customers" value={String(filtered.length)} subtext="Filtered results" tone="indigo" icon={UserCircle} />
        <StatCard
          label="Open balances"
          value={formatMoney(
            filtered.reduce((s, c) => s + (invoiceStats.get(c.id)?.balanceDue ?? 0), 0),
            currency
          )}
          subtext="Unpaid on invoices"
          tone="amber"
          icon={Wallet}
        />
      </div>

      <Card className="space-y-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, phone"
          searchAriaLabel="Search customers"
          actions={
            canCreate ? (
              <Button variant="primary" onClick={() => navigate('/customers/new')} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4" />
                Add customer
              </Button>
            ) : undefined
          }
          filters={
            <FilterSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Status"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </FilterSelect>
          }
        />

        {loading ? (
          <LoadingView message="Loading customers…" size="lg" className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserCircle}
            title="No customers yet"
            description="Add customers when you create offline invoices."
            action={
              canCreate ? (
                <Button variant="primary" onClick={() => navigate('/customers/new')}>
                  <Plus className="w-4 h-4" />
                  Add customer
                </Button>
              ) : undefined
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
                          <button type="button" onClick={() => navigate(`/customers/${customer.id}`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="View customer">
                            <Eye className="w-4 h-4" />
                          </button>
                          {canUpdate ? (
                            <button type="button" onClick={() => navigate(`/customers/${customer.id}/edit`)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Edit customer">
                              <Pencil className="w-4 h-4" />
                            </button>
                          ) : null}
                          {canUpdate ? (
                            <button type="button" onClick={() => toggleArchive(customer)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={customer.status === 'active' ? 'Archive customer' : 'Restore customer'}>
                              {customer.status === 'active' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button type="button" onClick={() => handleDelete(customer)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" aria-label="Delete customer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
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
