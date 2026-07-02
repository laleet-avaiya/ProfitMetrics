import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Building2,
  Eye,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
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
import type { Expense, PurchaseOrder, Vendor } from '../../types';
import { formatMoney } from '../../utils/profit';
import { nowUtc } from '../../utils/firestoreDates';
import { sumExpensesByVendor } from '../../utils/vendorHelpers';
import { sumPurchasesByVendor } from '../../utils/vendorLedger';

type StatusFilter = 'active' | 'archived' | 'all';

export function Vendors() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [vendorList, expenseList, purchaseList] = await Promise.all([
        firestoreService.vendors.getAll(company.id),
        firestoreService.expenses.getAll(company.id),
        firestoreService.purchases.getAll(company.id),
      ]);
      setVendors(vendorList.filter((v) => !v.deleted));
      setExpenses(expenseList.filter((e) => !e.deleted));
      setPurchases(purchaseList.filter((p) => !p.deleted));
    } catch (err) {
      console.error('Failed to load vendors:', err);
      notification.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          });
          notification.success(archiving ? 'Vendor archived' : 'Vendor restored');
          loadData();
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
          await firestoreService.vendors.delete(company.id, vendor.id);
          notification.success('Vendor deleted');
          loadData();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete vendor');
        }
      },
    });
  };

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
        <div className={toolbarClass}>
          <div className={filterRowClass}>
            <div className="flex-1 min-w-[200px] max-w-md">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, contact, email, phone"
                leftIcon={<Search className="w-4 h-4" />}
                aria-label="Search vendors"
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter by status"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </FilterSelect>
          </div>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add vendor
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading vendors…</p>
          </div>
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
              vendors.length === 0 ? (
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" />
                  Add first vendor
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
                    <th className={tableHeadCellClass}>Vendor</th>
                    <th className={tableHeadCellClass}>Email</th>
                    <th className={tableHeadCellClass}>Contact</th>
                    <th className={tableHeadCellClass}>Status</th>
                    <th className={`${tableHeadCellClass} text-right`}>Expenses</th>
                    <th className={`${tableHeadCellClass} text-right`}>Total paid</th>
                    <th className={`${tableHeadCellClass} text-right`}>PO balance</th>
                    <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((vendor) => {
                    const totals = expenseTotals.get(vendor.id);
                    const poTotals = purchaseTotals.get(vendor.id);
                    return (
                      <tr key={vendor.id} className="bg-white dark:bg-gray-800">
                        <td className={`${tableTruncateCellClass} font-medium text-gray-900 dark:text-white`}>
                          <Link
                            to={`/vendors/${vendor.id}`}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                          >
                            {vendor.name}
                          </Link>
                        </td>
                        <td className={`${tableTruncateCellClass} text-gray-600 dark:text-gray-400`}>
                          {vendor.email ?? '—'}
                        </td>
                        <td className={`${tableTruncateCellClass} text-gray-600 dark:text-gray-400`}>
                          {vendor.contactName ?? vendor.phone ?? '—'}
                        </td>
                        <td className={tableCellClass}>
                          <span
                            className={`inline-flex text-xs px-2 py-0.5 rounded-full ${
                              vendor.status === 'active'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {vendor.status === 'active' ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className={`${tableCellClass} text-right tabular-nums`}>
                          {totals?.count ?? 0}
                        </td>
                        <td className={`${tableCellClass} text-right tabular-nums font-medium text-gray-900 dark:text-white`}>
                          {formatMoney(totals?.total ?? 0, currency)}
                        </td>
                        <td className={`${tableCellClass} text-right tabular-nums text-rose-600 dark:text-rose-400`}>
                          {(poTotals?.balanceDue ?? 0) > 0
                            ? formatMoney(poTotals!.balanceDue, currency)
                            : '—'}
                        </td>
                        <td className={tableCellClass}>
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
                            <button
                              type="button"
                              onClick={() => openEdit(vendor)}
                              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              aria-label={`Edit ${vendor.name}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
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
                            <button
                              type="button"
                              onClick={() => handleDelete(vendor)}
                              className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              aria-label={`Delete ${vendor.name}`}
                            >
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
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(vendor)}>
                        <Pencil className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(vendor)}
                        className="text-red-600 dark:text-red-400"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
