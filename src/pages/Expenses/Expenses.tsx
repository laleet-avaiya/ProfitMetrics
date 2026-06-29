import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react';
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
import { EXPENSE_CATEGORIES } from '../../constants/expenseCategories';
import { firestoreService } from '../../services/firestore';
import type { Expense, Vendor } from '../../types';
import { formatDateLocal } from '../../utils/date';
import {
  dateFilterRange,
  formatExpenseTaxLabel,
  getExpenseInputTax,
  isDateInRange,
  type DateFilter,
} from '../../utils/expenseHelpers';
import { formatMoney } from '../../utils/profit';
import { getExpenseVendorDisplay } from '../../utils/vendorHelpers';

export function Expenses() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';
  const [searchParams, setSearchParams] = useSearchParams();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState(() => searchParams.get('vendor') ?? '');

  useEffect(() => {
    const vendorFromUrl = searchParams.get('vendor') ?? '';
    setVendorFilter(vendorFromUrl);
  }, [searchParams]);

  const loadExpenses = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [list, vendorList] = await Promise.all([
        firestoreService.expenses.getAll(company.id),
        firestoreService.vendors.getAll(company.id),
      ]);
      setExpenses(list.filter((e) => !e.deleted));
      setVendors(vendorList.filter((v) => !v.deleted));
    } catch (err) {
      console.error('Failed to load expenses:', err);
      notification.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = dateFilterRange(dateFilter);

    return expenses.filter((e) => {
      if (!isDateInRange(e.expenseDate, from, to)) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (vendorFilter && e.vendorId !== vendorFilter) return false;
      if (!q) return true;
      const vendorDisplay = getExpenseVendorDisplay(e);
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (vendorDisplay?.toLowerCase().includes(q) ?? false) ||
        (e.reference?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [expenses, search, dateFilter, categoryFilter, vendorFilter]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, e) => ({
        count: acc.count + 1,
        total: acc.total + e.amount,
        inputTax: acc.inputTax + getExpenseInputTax(e),
      }),
      { count: 0, total: 0, inputTax: 0 }
    );
  }, [filtered]);

  const openCreate = () => {
    const vendor = searchParams.get('vendor');
    navigate(vendor ? `/expenses/new?vendor=${vendor}` : '/expenses/new');
  };

  const openDetail = (expense: Expense) => navigate(`/expenses/${expense.id}`);

  const handleDelete = (expense: Expense) => {
    if (!company) return;
    notification.confirm({
      title: 'Delete expense?',
      message: `Remove "${expense.description}" (${formatMoney(expense.amount, currency)})? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await firestoreService.expenses.delete(company.id, expense.id);
          notification.success('Expense deleted');
          loadExpenses();
        } catch (err) {
          console.error(err);
          notification.error('Failed to delete expense');
        }
      },
    });
  };

  return (
    <SectionPage
      title="Expenses"
      description="Track business costs that aren't tied to a single order — ads, software, storage, salaries, and more."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Expenses', value: String(summary.count) },
          { label: 'Total spent', value: formatMoney(summary.total, currency) },
          {
            label: 'Input tax',
            value: formatMoney(summary.inputTax, currency),
            subtext: summary.inputTax > 0 ? 'GST/VAT tracked on expenses' : 'Track tax on expenses optionally',
          },
        ].map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            subtext={stat.subtext ?? 'Filtered results'}
          />
        ))}
      </div>

      <Card className="space-y-3">
        <div className={toolbarClass}>
          <div className={filterRowClass}>
            <div className="flex-1 min-w-[200px] max-w-md">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, vendor, reference"
                leftIcon={<Search className="w-4 h-4" />}
                aria-label="Search expenses"
              />
            </div>
            <FilterSelect
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              aria-label="Filter by date"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </FilterSelect>
            <FilterSelect
              value={vendorFilter}
              onChange={(e) => {
                const value = e.target.value;
                setVendorFilter(value);
                if (value) {
                  setSearchParams({ vendor: value });
                } else {
                  setSearchParams({});
                }
              }}
              wide
              aria-label="Filter by vendor"
            >
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              wide
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </FilterSelect>
          </div>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add expense
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading expenses…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={expenses.length === 0 ? 'No expenses yet' : 'No expenses match your filters'}
            description={
              expenses.length === 0
                ? 'Record ads, software, storage, and other operating costs here.'
                : 'Try a different search, category, or date range.'
            }
            action={
              expenses.length === 0 ? (
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" />
                  Add first expense
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
                    <th className={tableHeadCellClass}>Category</th>
                    <th className={tableHeadCellClass}>Description</th>
                    <th className={tableHeadCellClass}>Reference</th>
                    <th className={tableHeadCellClass}>Vendor</th>
                    <th className={`${tableHeadCellClass} text-right`}>Amount</th>
                    <th className={`${tableHeadCellClass} text-right`}>Input tax</th>
                    <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((expense) => (
                    <tr key={expense.id} className="bg-white dark:bg-gray-800">
                      <td className={`${tableCellClass} text-gray-700 dark:text-gray-300`}>
                        {formatDateLocal(expense.expenseDate)}
                      </td>
                      <td className={tableCellClass}>
                        <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {expense.category}
                        </span>
                      </td>
                      <td className={`${tableTruncateCellClass} text-gray-900 dark:text-white`}>
                        <Link
                          to={`/expenses/${expense.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                        >
                          {expense.description}
                        </Link>
                      </td>
                      <td className={`${tableTruncateCellClass} text-gray-600 dark:text-gray-400`}>
                        {expense.reference ?? '—'}
                      </td>
                      <td className={`${tableTruncateCellClass} text-gray-600 dark:text-gray-400`}>
                        {getExpenseVendorDisplay(expense) ?? '—'}
                      </td>
                      <td className={`${tableCellClass} text-right tabular-nums font-medium text-gray-900 dark:text-white`}>
                        {formatMoney(expense.amount, currency)}
                      </td>
                      <td className={`${tableCellClass} text-right tabular-nums text-gray-600 dark:text-gray-400`}>
                        {getExpenseInputTax(expense) > 0
                          ? formatMoney(getExpenseInputTax(expense), currency)
                          : '—'}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(expense)}
                            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label={`Edit ${expense.description}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(expense)}
                            className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            aria-label={`Delete ${expense.description}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtered.map((expense) => (
                <div
                  key={expense.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        <Link
                          to={`/expenses/${expense.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                        >
                          {expense.description}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateLocal(expense.expenseDate)}
                        {getExpenseVendorDisplay(expense)
                          ? ` · ${getExpenseVendorDisplay(expense)}`
                          : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white text-right">
                      {formatMoney(expense.amount, currency)}
                      {getExpenseInputTax(expense) > 0 && (
                        <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                          {formatExpenseTaxLabel(expense.taxType)}{' '}
                          {formatMoney(getExpenseInputTax(expense), currency)}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {expense.category}
                  </span>
                  {expense.reference && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ref: {expense.reference}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(expense)}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(expense)}
                      className="text-red-600 dark:text-red-400"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
