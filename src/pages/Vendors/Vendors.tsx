import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Building2,
  Eye,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react';
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
import type { Expense, PurchaseOrder, Vendor } from '../../types';
import { formatMoney } from '../../utils/profit';
import { nowUtc } from '../../utils/firestoreDates';
import { sumExpensesByVendor } from '../../utils/vendorHelpers';
import { sumPurchasesByVendor } from '../../utils/vendorLedger';

type StatusFilter = 'active' | 'archived' | 'all';

export function Vendors() {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = useModuleAccess(AppModule.VENDORS);
  const { company, user } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const emptyData = useMemo(
    () => ({
      vendors: [] as Vendor[],
      expenses: [] as Expense[],
      purchases: [] as PurchaseOrder[],
    }),
    []
  );

  const { data, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load vendors',
    fetch: async (companyId) => {
      const [vendorList, expenseList, purchaseList] = await Promise.all([
        firestoreService.vendors.getAll(companyId),
        firestoreService.expenses.getAll(companyId),
        firestoreService.purchases.getAll(companyId),
      ]);
      return {
        vendors: vendorList.filter(notDeleted),
        expenses: expenseList.filter(notDeleted),
        purchases: purchaseList.filter(notDeleted),
      };
    },
  });

  const { vendors, expenses, purchases } = data;
  const [search, setSearch] = useState('');

  const expenseTotals = useMemo(() => sumExpensesByVendor(expenses), [expenses]);
  const purchaseTotals = useMemo(() => sumPurchasesByVendor(purchases), [purchases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (statusFilter === 'active' && v.status !== 'active') return false;
      if (statusFilter === 'archived' && v.status !== 'archived') return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.contactName?.toLowerCase().includes(q) ?? false) ||
        (v.email?.toLowerCase().includes(q) ?? false) ||
        (v.phone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [vendors, search, statusFilter]);

  const summary = useMemo(
    () => ({
      count: filtered.length,
      linkedExpenses: filtered.reduce(
        (sum, v) => sum + (expenseTotals.get(v.id)?.count ?? 0),
        0
      ),
      totalPaid: filtered.reduce(
        (sum, v) => sum + (expenseTotals.get(v.id)?.total ?? 0),
        0
      ),
    }),
    [filtered, expenseTotals]
  );

  const openCreate = () => navigate('/vendors/new');

  const openView = (vendor: Vendor) => navigate(`/vendors/${vendor.id}`);
  const openEdit = (vendor: Vendor) => navigate(`/vendors/${vendor.id}/edit`);

  const handleArchiveToggle = (vendor: Vendor) => {
    if (!company) return;
    const archiving = vendor.status === 'active';
    notification.confirm({
      title: archiving ? 'Archive vendor?' : 'Restore vendor?',
      message: archiving
        ? `"${vendor.name}" will be hidden from expense selection but kept in your records.`
        : `"${vendor.name}" will be active again for new expenses.`,
      confirmLabel: archiving ? 'Archive' : 'Restore',
      variant: 'primary',
      onConfirm: async () => {
        try {
          await firestoreService.vendors.update(company.id, vendor.id, {
            status: archiving ? 'archived' : 'active',
            updatedAt: nowUtc(),
          }, user!.uid);
          notification.success(archiving ? 'Vendor archived' : 'Vendor restored');
          reload();
        } catch (err) {
          console.error(err);
          notification.error('Failed to update vendor');
        }
      },
    });
  };

  const handleDelete = (vendor: Vendor) => {
    if (!company) return;
    const linked = expenseTotals.get(vendor.id);
    notification.confirm({
      title: 'Delete vendor?',
      message: linked
        ? `"${vendor.name}" has ${linked.count} linked expense(s). The vendor will be removed but expenses keep the saved vendor name.`
        : `"${vendor.name}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await firestoreService.vendors.delete(company.id, vendor.id, user!.uid);
          notification.success('Vendor deleted');
          reload();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete vendor');
        }
      },
    });
  };

  const columns: DataTableColumn<Vendor>[] = [
      {
        key: 'name',
        header: 'Vendor',
        sortable: true,
        sortValue: (v) => v.name,
        truncate: true,
        className: 'font-medium text-gray-900 dark:text-white',
        render: (vendor) => (
          <Link
            to={`/vendors/${vendor.id}`}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
          >
            {vendor.name}
          </Link>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        sortable: true,
        sortValue: (v) => v.email ?? '',
        truncate: true,
        className: 'text-gray-600 dark:text-gray-400',
        render: (vendor) => vendor.email ?? '—',
      },
      {
        key: 'contact',
        header: 'Contact',
        sortable: true,
        sortValue: (v) => v.contactName ?? v.phone ?? '',
        truncate: true,
        className: 'text-gray-600 dark:text-gray-400',
        render: (vendor) => vendor.contactName ?? vendor.phone ?? '—',
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (v) => v.status,
        render: (vendor) => (
          <span
            className={`inline-flex text-xs px-2 py-0.5 rounded-full ${
              vendor.status === 'active'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {vendor.status === 'active' ? 'Active' : 'Archived'}
          </span>
        ),
      },
      {
        key: 'expenses',
        header: 'Expenses',
        align: 'right',
        sortable: true,
        sortValue: (v) => expenseTotals.get(v.id)?.count ?? 0,
        render: (vendor) => expenseTotals.get(vendor.id)?.count ?? 0,
      },
      {
        key: 'totalPaid',
        header: 'Total paid',
        align: 'right',
        sortable: true,
        sortValue: (v) => expenseTotals.get(v.id)?.total ?? 0,
        className: 'font-medium text-gray-900 dark:text-white',
        render: (vendor) => formatMoney(expenseTotals.get(vendor.id)?.total ?? 0, currency),
      },
      {
        key: 'poBalance',
        header: 'PO balance',
        align: 'right',
        sortable: true,
        sortValue: (v) => purchaseTotals.get(v.id)?.balanceDue ?? 0,
        className: 'text-rose-600 dark:text-rose-400',
        render: (vendor) => {
          const balance = purchaseTotals.get(vendor.id)?.balanceDue ?? 0;
          return balance > 0 ? formatMoney(balance, currency) : '—';
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (vendor) => {
          const totals = expenseTotals.get(vendor.id);
          return (
            <div className="flex items-center justify-end gap-1">
              {totals && totals.count > 0 && (
                <Link
                  to={`/expenses?vendor=${vendor.id}`}
                  className="px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Expenses
                </Link>
              )}
              <button
                type="button"
                onClick={() => openView(vendor)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={`View ${vendor.name}`}
              >
                <Eye className="w-4 h-4" />
              </button>
              {canUpdate ? (
                <button
                  type="button"
                  onClick={() => openEdit(vendor)}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label={`Edit ${vendor.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              ) : null}
              {canUpdate ? (
                <button
                  type="button"
                  onClick={() => handleArchiveToggle(vendor)}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label={vendor.status === 'active' ? 'Archive' : 'Restore'}
                >
                  {vendor.status === 'active' ? (
                    <Archive className="w-4 h-4" />
                  ) : (
                    <ArchiveRestore className="w-4 h-4" />
                  )}
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => handleDelete(vendor)}
                  className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label={`Delete ${vendor.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          );
        },
      },
];

  return (
    <SectionPage
      title="Vendors"
      description="Manage suppliers and service providers. Link vendors to expenses to track who you paid and for what."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Vendors', value: String(summary.count), tone: 'indigo' as const, icon: Building2 },
          { label: 'Linked expenses', value: String(summary.linkedExpenses), tone: 'violet' as const, icon: Receipt },
          { label: 'Total paid', value: formatMoney(summary.totalPaid, currency), tone: 'emerald' as const, icon: Wallet },
        ].map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} subtext="Filtered results" tone={stat.tone} icon={stat.icon} />
        ))}
      </div>

      <Card className="space-y-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, contact, email, phone"
          searchAriaLabel="Search vendors"
          actions={
            canCreate ? (
              <Button variant="primary" onClick={openCreate} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4" />
                Add vendor
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
          <LoadingView message="Loading vendors…" size="lg" className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={vendors.length === 0 ? 'No vendors yet' : 'No vendors match your filters'}
            description={
              vendors.length === 0
                ? 'Add suppliers, ad platforms, and service providers to link them to expenses.'
                : 'Try a different search or status filter.'
            }
            action={
              vendors.length === 0 && canCreate ? (
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" />
                  Add first vendor
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(v) => v.id}
              defaultSort={{ key: 'name', direction: 'asc' }}
            />

            <div className="md:hidden space-y-3">
              {filtered.map((vendor) => {
                const totals = expenseTotals.get(vendor.id);
                return (
                  <div
                    key={vendor.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          <Link
                            to={`/vendors/${vendor.id}`}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                          >
                            {vendor.name}
                          </Link>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {vendor.contactName ?? vendor.email ?? vendor.phone ?? 'No contact info'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                          vendor.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {vendor.status === 'active' ? 'Active' : 'Archived'}
                      </span>
                    </div>
                    <p className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                      {totals?.count ?? 0} expense(s) · {formatMoney(totals?.total ?? 0, currency)} paid
                    </p>
                    <div className="flex gap-2 pt-1">
                      {totals && totals.count > 0 && (
                        <Link to={`/expenses?vendor=${vendor.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            View expenses
                          </Button>
                        </Link>
                      )}
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openView(vendor)}>
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      {canUpdate ? (
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(vendor)}>
                          <Pencil className="w-4 h-4" />
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(vendor)}
                          className="text-red-600 dark:text-red-400"
                          aria-label="Delete"
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
