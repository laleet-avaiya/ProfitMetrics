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
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { useModuleAccess } from '../../hooks/usePermissions';
import { AppModule } from '../../constants/permissions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { notDeleted, useEntityList } from '../../hooks/useEntityList';
import { firestoreService } from '../../services/firestore';
import type { Customer, Sale } from '../../types';
import { SaleStatus } from '../../types';
import { nowUtc } from '../../utils/firestoreDates';
import { formatMoney } from '../../utils/profit';

type StatusFilter = 'active' | 'archived' | 'all';

export function Customers() {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.CUSTOMERS);
  const { company, user } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const emptyData = useMemo(
    () => ({ customers: [] as Customer[], sales: [] as Sale[] }),
    []
  );

  const { data, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load customers',
    fetch: async (companyId) => {
      const [customerList, saleList] = await Promise.all([
        firestoreService.customers.getAll(companyId),
        firestoreService.sales.getAll(companyId),
      ]);
      return {
        customers: customerList.filter(notDeleted),
        sales: saleList.filter(notDeleted),
      };
    },
  });

  const { customers, sales } = data;
  const [search, setSearch] = useState('');

  const invoiceStats = useMemo(() => {
    const map = new Map<string, { count: number; balanceDue: number }>();
    for (const sale of sales) {
      if (!sale.customerId || sale.status === SaleStatus.CANCELLED) continue;
      const total = sale.total ?? sale.grossRevenue;
      const balance = sale.balanceDue ?? Math.max(0, total - (sale.totalPaid ?? 0));
      const prev = map.get(sale.customerId) ?? { count: 0, balanceDue: 0 };
      map.set(sale.customerId, {
        count: prev.count + 1,
        balanceDue: prev.balanceDue + balance,
      });
    }
    return map;
  }, [sales]);

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
      .update(company.id, customer.id, { status: next, updatedAt: nowUtc() }, user!.uid)
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
        await firestoreService.customers.delete(company.id, customer.id, user!.uid);
        notification.success('Customer deleted');
        reload();
      },
    });
  };

  const columns = useMemo<DataTableColumn<Customer>[]>(
    () => [
      {
        key: 'name',
        header: 'Customer',
        sortable: true,
        sortValue: (c) => c.name,
        truncate: true,
        className: 'font-medium',
        render: (customer) => (
          <Link to={`/customers/${customer.id}`} className="hover:text-indigo-600 hover:underline">
            {customer.name}
          </Link>
        ),
      },
      {
        key: 'contact',
        header: 'Contact',
        sortable: true,
        sortValue: (c) => c.contactName ?? c.phone ?? '',
        truncate: true,
        render: (customer) => customer.contactName ?? customer.phone ?? '—',
      },
      {
        key: 'email',
        header: 'Email',
        sortable: true,
        sortValue: (c) => c.email ?? '',
        truncate: true,
        render: (customer) => customer.email ?? '—',
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (c) => c.status,
        render: (customer) => (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
            {customer.status}
          </span>
        ),
      },
      {
        key: 'orders',
        header: 'Orders',
        align: 'right',
        sortable: true,
        sortValue: (c) => invoiceStats.get(c.id)?.count ?? 0,
        render: (customer) => invoiceStats.get(customer.id)?.count ?? 0,
      },
      {
        key: 'balance',
        header: 'Balance',
        align: 'right',
        sortable: true,
        sortValue: (c) => invoiceStats.get(c.id)?.balanceDue ?? 0,
        className: 'text-rose-600',
        render: (customer) => {
          const balance = invoiceStats.get(customer.id)?.balanceDue ?? 0;
          return balance > 0 ? formatMoney(balance, currency) : '—';
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (customer) => (
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
        ),
      },
    ],
    [canUpdate, canDelete, currency, invoiceStats, navigate]
  );

  return (
    <SectionPage
      title="Customers"
      description="Buyers for order and payment tracking."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard label="Customers" value={String(filtered.length)} subtext="Filtered results" tone="indigo" icon={UserCircle} />
        <StatCard
          label="Open balances"
          value={formatMoney(
            filtered.reduce((s, c) => s + (invoiceStats.get(c.id)?.balanceDue ?? 0), 0),
            currency
          )}
          subtext="Unpaid on orders"
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
            description="Add customers to track their orders and payments."
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
          <>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(c) => c.id}
            defaultSort={{ key: 'name', direction: 'asc' }}
          />

          <div className="md:hidden space-y-3">
            {filtered.map((customer) => {
              const stats = invoiceStats.get(customer.id);
              return (
                <div
                  key={customer.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        <Link
                          to={`/customers/${customer.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {customer.contactName ?? customer.email ?? customer.phone ?? 'No contact info'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {customer.status}
                    </span>
                  </div>
                  <p className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                    {stats?.count ?? 0} order(s)
                    {(stats?.balanceDue ?? 0) > 0
                      ? ` · ${formatMoney(stats!.balanceDue, currency)} due`
                      : ''}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/customers/${customer.id}`)}>
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    {canUpdate ? (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
                        <Pencil className="w-4 h-4" />
                        Edit
                      </Button>
                    ) : null}
                    {canUpdate ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleArchive(customer)}
                        aria-label={customer.status === 'active' ? 'Archive customer' : 'Restore customer'}
                      >
                        {customer.status === 'active' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(customer)}
                        className="text-rose-600 dark:text-rose-400"
                        aria-label="Delete customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </Card>
    </SectionPage>
  );
}
