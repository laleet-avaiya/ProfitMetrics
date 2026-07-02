import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Paperclip, Receipt } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { TaxModeField } from '../../components/TaxModeField/TaxModeField';
import {
  FormFieldGroup,
  FormFieldGroupDivider,
  FormPageBody,
  FormPageGrid,
  FormPageHeaderActions,
  FormPageLoading,
  FormPageMobileActions,
  FormPageNotFound,
  FormPanel,
  FormReadyBanner,
  FormSidebarRow,
  FormSidebarSection,
} from '../../components/FormPage';
import { FormTabs } from '../../components/ui/FormTabs';
import {
  EntityAttachmentsPanel,
  type PendingFile,
} from '../../components/EntityAttachments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getCountryProfile } from '../../constants/countries';
import { EXPENSE_CATEGORIES } from '../../constants/expenseCategories';
import { firestoreService } from '../../services/firestore';
import type { Expense, Vendor } from '../../types';
import type { EntityAttachment } from '../../models/attachment';
import { finalizePendingAttachments } from '../../utils/entityAttachments';
import { TaxType } from '../../types';
import {
  buildExpenseFromForm,
  computeExpenseInputTax,
  emptyExpenseForm,
  expenseTaxDefaults,
  expenseToForm,
  formatExpenseTaxLabel,
  type ExpenseFormState,
} from '../../utils/expenseHelpers';
import { allocateNextExpenseNumber, previewNextExpenseNumber } from '../../utils/documentNumbers';
import { formatMoney } from '../../utils/profit';
import { getActiveVendors } from '../../utils/vendorHelpers';

const categoryOptions = [
  { value: '', label: 'Select category…' },
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
];

function parseNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

type ExpenseFormTab = 'details' | 'documents';

export function ExpenseFormPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(expenseId);
  const currency = company?.currency ?? 'AED';
  const countryProfile = getCountryProfile(company?.country);

  const [expense, setExpense] = useState<Expense | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ExpenseFormState>(() => emptyExpenseForm(company));
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ExpenseFormTab>('details');
  const [errors, setErrors] = useState<{
    category?: string;
    description?: string;
    amount?: string;
  }>({});
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [nextExpenseNumber, setNextExpenseNumber] = useState('');

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
            setAttachments(found?.attachments ?? []);
            setPendingFiles([]);
          }
        } else {
          setExpense(null);
          const initial = emptyExpenseForm(company);
          const vendorFromUrl = searchParams.get('vendor');
          if (vendorFromUrl) initial.vendorId = vendorFromUrl;
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
  }, [company, expenseId, isEditing, searchParams, notification]);

  useEffect(() => {
    if (!company || isEditing) {
      setNextExpenseNumber('');
      return;
    }
    let cancelled = false;
    previewNextExpenseNumber(company.id, form.expenseDate).then((num) => {
      if (!cancelled) setNextExpenseNumber(num);
    });
    return () => {
      cancelled = true;
    };
  }, [company, isEditing, form.expenseDate]);

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
      const expenseNumber =
        isEditing && expense
          ? expense.expenseNumber
          : await allocateNextExpenseNumber(company.id, form.expenseDate);

      const payload = buildExpenseFromForm(
        form,
        company.id,
        vendors,
        expenseNumber,
        expense ?? undefined
      );

      if (isEditing && expense) {
        await firestoreService.expenses.update(
          company.id,
          expense.id,
          { ...payload, attachments },
          user!.uid
        );
        notification.success('Expense updated');
        navigate(`/expenses/${expense.id}`);
      } else {
        const created = await firestoreService.expenses.create(company.id, payload, user!.uid);
        const uploaded = await finalizePendingAttachments(
          company.orgId,
          company.id,
          'expenses',
          created.id,
          pendingFiles.map((item) => item.file),
          user!.uid
        );
        if (uploaded.length > 0) {
          await firestoreService.expenses.update(
            company.id,
            created.id,
            { attachments: uploaded },
            user!.uid
          );
        }
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

  const cancelTo = isEditing && expense ? `/expenses/${expense.id}` : '/expenses';
  const amount = parseNumber(form.amount);
  const isReady =
    !isEditing && Boolean(form.category) && form.description.trim().length > 0 && amount > 0;

  const formTabs = [
    { id: 'details' as const, label: 'Details', icon: Receipt },
    {
      id: 'documents' as const,
      label: 'Documents',
      icon: Paperclip,
      badge: attachments.length + pendingFiles.length || undefined,
    },
  ];

  const sidebar = (
    <FormSidebarSection title="Preview">
      <FormSidebarRow
        label="Amount"
        value={amount > 0 ? formatMoney(amount, currency) : '—'}
      />
      {tracksTax ? (
        <FormSidebarRow
          label="Input tax"
          value={formatMoney(taxPreview, currency)}
        />
      ) : null}
      <FormSidebarRow
        label="Total"
        value={amount > 0 ? formatMoney(amount, currency) : '—'}
        emphasize
      />
    </FormSidebarSection>
  );

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <FormPageLoading message="Loading expense…" />
        </PageShell>
      </Layout>
    );
  }

  if (isEditing && !expense) {
    return (
      <Layout>
        <PageShell>
          <FormPageNotFound
            title="Expense not found"
            description="This expense may have been deleted."
            backLabel="Back to expenses"
            onBack={() => navigate('/expenses')}
          />
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
              : 'Record operating costs with optional input tax for reports.'
          }
          actions={
            <FormPageHeaderActions
              formId="expense-form"
              onCancel={() => navigate(cancelTo)}
              saving={saving}
              isEditing={isEditing}
              createLabel="Add expense"
            />
          }
        />

        <FormPageBody id="expense-form" onSubmit={handleSubmit}>
          <FormTabs
            tabs={formTabs}
            active={activeTab}
            onChange={(id) => setActiveTab(id as ExpenseFormTab)}
            ariaLabel="Expense form sections"
          />

          <FormPageGrid sidebar={sidebar}>
            <FormPanel role="tabpanel">
              {activeTab === 'details' ? (
                <>
              <FormFieldGroup title="Expense details">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Input
                    label="Expense number"
                    value={isEditing ? (expense?.expenseNumber ?? '—') : nextExpenseNumber}
                    readOnly
                    disabled
                    helperText={isEditing ? 'Cannot change' : 'Assigned on save'}
                  />
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
                  <Input
                    label={`Amount (${currency})`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    error={errors.amount}
                    required
                    placeholder="0.00"
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Description"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      error={errors.description}
                      required
                      placeholder="e.g. Amazon PPC, packaging"
                    />
                  </div>
                </div>
              </FormFieldGroup>

              <FormFieldGroupDivider />

              <FormFieldGroup
                title="Input tax"
                description={`Optional ${countryProfile.defaultTaxType === TaxType.GST ? 'GST' : 'VAT'} for input credit in reports.`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select
                    label="Tax type"
                    value={form.taxType}
                    options={taxTypeOptions}
                    onChange={(e) =>
                      handleTaxTypeChange(e.target.value as ExpenseFormState['taxType'])
                    }
                  />
                  {tracksTax ? (
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
                      <TaxModeField
                        label="Tax on amount"
                        value={form.taxMode}
                        onChange={(taxMode) =>
                          setForm((f) => ({
                            ...f,
                            taxMode,
                            taxAmountManual: false,
                          }))
                        }
                      />
                    </>
                  ) : null}
                </div>
                {tracksTax ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label={`${formatExpenseTaxLabel(form.taxType)} (${currency})`}
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
                          : `Auto from ${form.taxPercentage}%`
                      }
                    />
                  </div>
                ) : null}
              </FormFieldGroup>

              <FormFieldGroupDivider />

              <FormFieldGroup title="Vendor & notes">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Select
                      label="Vendor"
                      value={form.vendorId}
                      options={vendorOptions}
                      onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
                    />
                    {legacyVendorLabel && !form.vendorId ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Previously &quot;{legacyVendorLabel}&quot; — select a vendor to link.
                      </p>
                    ) : null}
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
                    placeholder="Invoice or receipt #"
                  />
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Notes"
                      optional
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>
              </FormFieldGroup>
                </>
              ) : null}

              {activeTab === 'documents' ? (
                <EntityAttachmentsPanel
                  orgId={company!.orgId}
                  companyId={company!.id}
                  collection="expenses"
                  entityId={expense?.id ?? null}
                  userId={user!.uid}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  pendingFiles={pendingFiles}
                  onPendingFilesChange={setPendingFiles}
                  disabled={saving}
                />
              ) : null}
            </FormPanel>
          </FormPageGrid>

          {isReady ? (
            <FormReadyBanner>
              <span className="font-medium">{form.description.trim()}</span> is ready to add.
            </FormReadyBanner>
          ) : null}

          <FormPageMobileActions
            onCancel={() => navigate(cancelTo)}
            saving={saving}
            isEditing={isEditing}
            createLabel="Add expense"
          />
        </FormPageBody>
      </PageShell>
    </Layout>
  );
}
