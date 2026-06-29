import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { FormActions } from '../../components/FormActions/FormActions';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getCountryProfile } from '../../constants/countries';
import { EXPENSE_CATEGORIES } from '../../constants/expenseCategories';
import { firestoreService } from '../../services/firestore';
import type { Expense, Vendor } from '../../types';
import { TaxMode, TaxType } from '../../types';
import {
  buildExpenseFromForm,
  computeExpenseInputTax,
  emptyExpenseForm,
  expenseTaxDefaults,
  expenseToForm,
  formatExpenseTaxLabel,
  type ExpenseFormState,
} from '../../utils/expenseHelpers';
import { formatMoney } from '../../utils/profit';
import { getActiveVendors } from '../../utils/vendorHelpers';

const categoryOptions = [
  { value: '', label: 'Select category…' },
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
];

const taxModeOptions = [
  { value: TaxMode.INCLUSIVE, label: 'Inclusive in amount' },
  { value: TaxMode.EXCLUSIVE, label: 'Exclusive (on top)' },
];

function parseNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function ExpenseFormPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(expenseId);
  const currency = company?.currency ?? 'AED';
  const countryProfile = getCountryProfile(company?.country);

  const [expense, setExpense] = useState<Expense | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ExpenseFormState>(() => emptyExpenseForm(company));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    category?: string;
    description?: string;
    amount?: string;
  }>({});

  useEffect(() => {
    if (!company) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const vendorList = await firestoreService.vendors.getAll(company.id);
        if (cancelled) return;
        setVendors(vendorList.filter((v) => !v.deleted));

        if (isEditing && expenseId) {
          const found = await firestoreService.expenses.get(company.id, expenseId);
          if (cancelled) return;
          if (found?.deleted) {
            setExpense(null);
            setForm(emptyExpenseForm(company));
          } else {
            setExpense(found);
            setForm(found ? expenseToForm(found) : emptyExpenseForm(company));
          }
        } else {
          setExpense(null);
          const initial = emptyExpenseForm(company);
          const vendorFromUrl = searchParams.get('vendor');
          if (vendorFromUrl) {
            initial.vendorId = vendorFromUrl;
          }
          setForm(initial);
        }
      } catch (err) {
        console.error('Failed to load expense form:', err);
        if (!cancelled) notification.error('Failed to load expense');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [company, expenseId, isEditing, searchParams]);

  const taxTypeOptions = useMemo((): { value: ExpenseFormState['taxType']; label: string }[] => {
    const suggested = countryProfile.defaultTaxType;
    const options: { value: ExpenseFormState['taxType']; label: string }[] = [
      { value: TaxType.NONE, label: 'None (optional)' },
    ];
    if (suggested === TaxType.GST) {
      options.push({ value: TaxType.GST, label: 'GST (input tax)' });
    } else if (suggested === TaxType.VAT) {
      options.push({ value: TaxType.VAT, label: 'VAT (input tax)' });
    } else {
      options.push(
        { value: TaxType.VAT, label: 'VAT (input tax)' },
        { value: TaxType.GST, label: 'GST (input tax)' }
      );
    }
    options.push({ value: TaxType.SALES_TAX, label: 'Sales tax' });
    return options;
  }, [countryProfile.defaultTaxType]);

  const tracksTax = form.taxType !== TaxType.NONE;

  const taxPreview = useMemo(() => {
    const amount = parseNumber(form.amount);
    const taxPercentage = parseNumber(form.taxPercentage);
    const manual =
      form.taxAmountManual && form.taxAmount.trim() ? parseNumber(form.taxAmount) : undefined;
    return computeExpenseInputTax(amount, form.taxType, taxPercentage, form.taxMode, manual);
  }, [form]);

  const selectableVendors = useMemo(() => {
    const active = getActiveVendors(vendors);
    if (!expense?.vendorId) return active;
    const linked = vendors.find((v) => v.id === expense.vendorId);
    if (linked && !active.some((v) => v.id === linked.id)) {
      return [...active, linked];
    }
    return active;
  }, [vendors, expense?.vendorId]);

  const vendorOptions = useMemo(
    () => [
      { value: '', label: 'No vendor (optional)' },
      ...selectableVendors.map((v) => ({ value: v.id, label: v.name })),
    ],
    [selectableVendors]
  );

  const legacyVendorLabel = useMemo(() => {
    if (!expense?.vendor || expense.vendorId) return null;
    return expense.vendor;
  }, [expense]);

  const handleTaxTypeChange = (taxType: ExpenseFormState['taxType']) => {
    setForm((f) => {
      const next = { ...f, taxType };
      if (taxType !== TaxType.NONE && f.taxPercentage === '0') {
        const defaults = expenseTaxDefaults(company);
        next.taxPercentage = defaults.taxPercentage;
        next.taxMode = defaults.taxMode;
      }
      if (taxType === TaxType.NONE) {
        next.taxAmountManual = false;
        next.taxAmount = '';
      }
      return next;
    });
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.category) next.category = 'Category is required';
    if (!form.description.trim()) next.description = 'Description is required';
    const amount = parseFloat(form.amount);
    if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      next.amount = 'Enter a valid amount greater than zero';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildExpenseFromForm(form, company.id, vendors, expense ?? undefined);

      if (isEditing && expense) {
        await firestoreService.expenses.update(company.id, expense.id, payload);
        notification.success('Expense updated');
        navigate(`/expenses/${expense.id}`);
      } else {
        const created = await firestoreService.expenses.create(company.id, payload);
        notification.success('Expense added');
        navigate(`/expenses/${created.id}`);
      }
    } catch (err) {
      console.error('Failed to save expense:', err);
      notification.error('Failed to save expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        </PageShell>
      </Layout>
    );
  }

  if (isEditing && !expense) {
    return (
      <Layout>
        <PageShell>
          <PageHeader title="Expense not found" description="This expense may have been deleted." />
          <Button type="button" variant="outline" onClick={() => navigate('/expenses')}>
            Back to expenses
          </Button>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit expense' : 'Add expense'}
          description={
            isEditing
              ? 'Update expense details and input tax.'
              : 'Record operating costs with optional GST/VAT input tax.'
          }
        />

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Expense date"
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              required
            />
            <Select
              label="Category"
              value={form.category}
              options={categoryOptions}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              error={errors.category}
              required
            />
          </div>

          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            error={errors.description}
            required
            placeholder="e.g. Amazon PPC campaign, Shopify app subscription"
          />

          <Input
            label={`Amount paid (${currency})`}
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            error={errors.amount}
            required
            placeholder="0.00"
            helperText="Total you paid on the invoice or receipt"
          />

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Input tax (optional)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Track {countryProfile.defaultTaxType === TaxType.GST ? 'GST' : 'VAT'} paid on this
                expense for input credit vs output tax on sales in reports.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Tax type"
                value={form.taxType}
                options={taxTypeOptions}
                onChange={(e) =>
                  handleTaxTypeChange(e.target.value as ExpenseFormState['taxType'])
                }
              />
              {tracksTax && (
                <>
                  <Input
                    label="Tax %"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.taxPercentage}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        taxPercentage: e.target.value,
                        taxAmountManual: false,
                      }))
                    }
                  />
                  <Select
                    label="Tax on amount"
                    value={form.taxMode}
                    options={taxModeOptions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        taxMode: e.target.value as ExpenseFormState['taxMode'],
                        taxAmountManual: false,
                      }))
                    }
                  />
                </>
              )}
            </div>
            {tracksTax && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={`${formatExpenseTaxLabel(form.taxType)} amount (${currency})`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.taxAmountManual ? form.taxAmount : taxPreview || ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      taxAmount: e.target.value,
                      taxAmountManual: true,
                    }))
                  }
                  helperText={
                    form.taxAmountManual
                      ? 'Manual override'
                      : `Auto from ${form.taxPercentage}% · ${form.taxMode === TaxMode.INCLUSIVE ? 'inclusive' : 'exclusive'}`
                  }
                />
                {!form.taxAmountManual && taxPreview > 0 && (
                  <div className="flex items-end pb-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Input tax:{' '}
                      <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                        {formatMoney(taxPreview, currency)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Select
                label="Vendor"
                value={form.vendorId}
                options={vendorOptions}
                onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
              />
              {legacyVendorLabel && !form.vendorId && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Previously saved as &quot;{legacyVendorLabel}&quot; — select a vendor to link it.
                </p>
              )}
              <Link
                to="/vendors/new"
                className="inline-block text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Add vendor
              </Link>
            </div>
            <Input
              label="Reference"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Optional — invoice or receipt #"
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional additional details"
            rows={2}
          />

          <FormActions layout="end">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(isEditing && expense ? `/expenses/${expense.id}` : '/expenses')
              }
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {isEditing ? 'Save changes' : 'Add expense'}
            </Button>
          </FormActions>
        </form>
      </PageShell>
    </Layout>
  );
}
