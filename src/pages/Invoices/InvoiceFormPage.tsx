import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Package,
  Plus,
  UserCircle,
} from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { Button } from '../../components/Button/Button';
import {
  FormPageBody,
  FormPageGrid,
  FormPageHeaderActions,
  FormPageLoading,
  FormPageMobileActions,
  FormPanel,
  FormReadyBanner,
  FormSidebarRow,
  FormSidebarSection,
} from '../../components/FormPage';
import { InvoiceFormSummaryBar } from '../../components/InvoiceFormSummaryBar/InvoiceFormSummaryBar';
import { InvoiceLineEditor } from '../../components/InvoiceLineEditor/InvoiceLineEditor';
import { FormTabs } from '../../components/ui/FormTabs';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { INVOICE_STATUS_OPTIONS } from '../../constants/invoiceStatuses';
import { firestoreService } from '../../services/firestore';
import type { Customer, Invoice, Product } from '../../types';
import { InvoiceStatus, TaxMode, TaxType } from '../../types';
import {
  buildCustomerFromForm,
  emptyCustomerForm,
  getActiveCustomers,
} from '../../utils/customerHelpers';
import {
  buildInvoiceFromForm,
  computeInvoicePreview,
  emptyInvoiceForm,
  emptyInvoiceLineForm,
  getActiveProducts,
  invoiceToForm,
  shouldApplyInvoiceStock,
  type InvoiceFormState,
} from '../../utils/invoiceHelpers';
import { allocateNextInvoiceNumber, previewNextInvoiceNumber } from '../../utils/documentNumbers';
import { applyInvoiceStock, invoiceStockFailureMessage, resyncInvoiceStock } from '../../utils/invoiceStock';
import { formatMoney } from '../../utils/profit';
import {
  emptyStateMessageClass,
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableWrapClass,
} from '../../constants/ui';

type InvoiceFormTab = 'invoice' | 'customer' | 'items' | 'notes';

export function InvoiceFormPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(invoiceId);
  const currency = company?.currency ?? 'AED';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<InvoiceFormState>(() => emptyInvoiceForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<InvoiceFormTab>('invoice');
  const [errors, setErrors] = useState<{ customer?: string; lines?: string }>({});
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');

  const activeProducts = useMemo(() => getActiveProducts(products), [products]);
  const activeCustomers = useMemo(() => getActiveCustomers(customers), [customers]);
  const preview = useMemo(() => computeInvoicePreview(form, products), [form, products]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const [productList, customerList] = await Promise.all([
          firestoreService.products.getAll(company.id),
          firestoreService.customers.getAll(company.id),
        ]);
        if (cancelled) return;
        setProducts(productList.filter((p) => !p.deleted));
        setCustomers(customerList.filter((c) => !c.deleted));

        if (isEditing && invoiceId) {
          const found = await firestoreService.invoices.get(company.id, invoiceId);
          if (cancelled) return;
          setInvoice(found?.deleted ? null : found);
          setForm(found && !found.deleted ? invoiceToForm(found) : emptyInvoiceForm());
        } else {
          setInvoice(null);
          const initial = emptyInvoiceForm();
          const customerFromUrl = searchParams.get('customer');
          if (customerFromUrl) {
            initial.customer.mode = 'existing';
            initial.customer.customerId = customerFromUrl;
            setActiveTab('items');
          }
          setForm(initial);
        }
      } catch {
        if (!cancelled) notification.error('Failed to load invoice');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [company, isEditing, invoiceId, searchParams, notification]);

  useEffect(() => {
    if (!company || isEditing) {
      setNextInvoiceNumber('');
      return;
    }
    let cancelled = false;
    previewNextInvoiceNumber(company.id, form.invoiceDate)
      .then((num) => {
        if (!cancelled) setNextInvoiceNumber(num);
      })
      .catch((err) => {
        console.error('Failed to preview invoice number:', err);
        if (!cancelled) setNextInvoiceNumber('');
      });
    return () => {
      cancelled = true;
    };
  }, [company, isEditing, form.invoiceDate]);

  const updateLine = (lineId: string, patch: Partial<InvoiceFormState['lines'][0]>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  };

  const fillFromProduct = async (lineId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    const listing = product?.platformListings[0];
    let purchasePrice = listing ? String(listing.purchasePrice) : '';
    const stock = company ? await firestoreService.stock.getByProductId(company.id, productId) : null;
    if (stock && stock.avgPurchasePrice > 0) purchasePrice = String(stock.avgPurchasePrice);
    updateLine(lineId, {
      productId,
      unitPrice: listing ? String(listing.sellingPrice) : stock ? String(stock.avgSellingPrice) : '',
      purchasePrice,
      taxType: listing?.taxType ?? TaxType.NONE,
      taxPercentage: String(listing?.sellingTaxPercentage ?? listing?.taxPercentage ?? 0),
      taxMode: listing?.sellingTaxMode ?? listing?.taxMode ?? TaxMode.INCLUSIVE,
    });
  };

  const addLine = () => {
    setForm((p) => ({ ...p, lines: [...p.lines, emptyInvoiceLineForm()] }));
    setActiveTab('items');
  };

  const removeLine = (lineId: string) => {
    setForm((p) => ({
      ...p,
      lines: p.lines.length <= 1 ? p.lines : p.lines.filter((l) => l.id !== lineId),
    }));
  };

  const resolveCustomer = async (): Promise<Customer | undefined> => {
    if (!company) return undefined;
    if (form.customer.mode === 'existing') {
      return customers.find((c) => c.id === form.customer.customerId);
    }
    if (!form.customer.name.trim()) return undefined;
    const customerPayload = buildCustomerFromForm(
      { ...emptyCustomerForm(), ...form.customer, status: 'active' },
      company.id
    );
    const created = await firestoreService.customers.create(company.id, customerPayload, user!.uid);
    return created;
  };

  const validate = () => {
    const next: typeof errors = {};
    if (form.customer.mode === 'existing' && !form.customer.customerId) {
      next.customer = 'Select a customer or add a new one';
    }
    if (form.customer.mode === 'new' && !form.customer.name.trim()) {
      next.customer = 'Customer name is required';
    }
    if (form.lines.filter((l) => l.productId).length === 0) next.lines = 'Add at least one product';
    setErrors(next);

    if (next.customer) {
      setActiveTab('customer');
      return false;
    }
    if (next.lines) {
      setActiveTab('items');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !validate()) return;
    setSaving(true);
    try {
      const customer = await resolveCustomer();
      const invoiceNumber =
        isEditing && invoice
          ? invoice.invoiceNumber
          : await allocateNextInvoiceNumber(company.id, form.invoiceDate);
      const payload = buildInvoiceFromForm(
        form,
        company.id,
        products,
        customer,
        invoiceNumber,
        invoice ?? undefined
      );

      if (isEditing && invoice) {
        await firestoreService.invoices.update(company.id, invoice.id, payload, user!.uid);
        try {
          const stockResult = await resyncInvoiceStock(company.id, invoice, {
            ...payload,
            id: invoice.id,
          }, user!.uid);
          if (!stockResult.ok) {
            throw new Error(invoiceStockFailureMessage(stockResult));
          }
        } catch (stockErr) {
          console.error('Failed to resync invoice stock:', stockErr);
          notification.error(
            stockErr instanceof Error
              ? stockErr.message
              : 'Invoice saved but stock could not be updated.'
          );
          setSaving(false);
          return;
        }
        notification.success('Invoice updated');
        navigate(`/invoices/${invoice.id}`);
      } else {
        const created = await firestoreService.invoices.create(company.id, payload, user!.uid);
        if (shouldApplyInvoiceStock(created)) {
          try {
            const stockResult = await applyInvoiceStock(company.id, created, user!.uid);
            if (!stockResult.ok) {
              throw new Error(invoiceStockFailureMessage(stockResult));
            }
          } catch (stockErr) {
            console.error('Failed to apply invoice stock:', stockErr);
            try {
              await firestoreService.invoices.delete(company.id, created.id, user!.uid);
            } catch (rollbackErr) {
              console.error('Failed to roll back invoice after stock error:', rollbackErr);
            }
            notification.error(
              stockErr instanceof Error
                ? stockErr.message
                : 'Could not update stock. The offline sale was not saved.'
            );
            setSaving(false);
            return;
          }
        }
        notification.success('Offline sale created');
        navigate(`/invoices/${created.id}`);
      }
    } catch (err) {
      console.error(err);
      notification.error('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const cancelTo =
    isEditing && invoice ? `/invoices/${invoice.id}` : '/sales?channel=offline';

  const filledLines = form.lines.filter((l) => l.productId).length;
  const hasCustomer =
    form.customer.mode === 'existing'
      ? Boolean(form.customer.customerId)
      : Boolean(form.customer.name.trim());
  const isReady = !isEditing && hasCustomer && filledLines > 0;

  const formTabs = [
    { id: 'invoice' as const, label: 'Invoice', icon: FileText },
    { id: 'customer' as const, label: 'Customer', icon: UserCircle },
    { id: 'items' as const, label: 'Items', icon: Package, badge: form.lines.length },
    { id: 'notes' as const, label: 'Notes', icon: FileText },
  ];

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <FormPageLoading message="Loading…" />
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? `Edit offline sale` : 'New offline sale'}
          description={
            isEditing
              ? `Invoice ${invoice?.invoiceNumber ?? ''}`
              : 'Invoice a customer with line items and tax.'
          }
          actions={
            activeProducts.length > 0 ? (
              <FormPageHeaderActions
                formId="invoice-form"
                onCancel={() => navigate(cancelTo)}
                saving={saving}
                isEditing={isEditing}
                createLabel="Create sale"
              />
            ) : null
          }
        />

        {activeProducts.length === 0 ? (
          <p className={emptyStateMessageClass}>
            Add products first.{' '}
            <Link to="/products/new" className="text-indigo-600 hover:underline">
              Create product
            </Link>
          </p>
        ) : (
          <FormPageBody id="invoice-form" onSubmit={handleSubmit}>
            <InvoiceFormSummaryBar
              subtotal={preview.subtotal}
              taxAmount={preview.taxAmount}
              total={preview.total}
              profit={preview.profit}
              lineCount={preview.lineCount}
              currency={currency}
            />

            <FormTabs
              tabs={formTabs}
              active={activeTab}
              onChange={(id) => setActiveTab(id as InvoiceFormTab)}
              ariaLabel="Invoice form sections"
            />

            <FormPageGrid
              sidebar={
                <FormSidebarSection title="Breakdown">
                  <FormSidebarRow label="Subtotal" value={formatMoney(preview.subtotal, currency)} />
                  <FormSidebarRow label="Tax" value={formatMoney(preview.taxAmount, currency)} />
                  <FormSidebarRow label="COGS" value={formatMoney(preview.totalCogs, currency)} />
                  <FormSidebarRow
                    label="Total"
                    value={formatMoney(preview.total, currency)}
                    emphasize
                  />
                  <FormSidebarRow
                    label="Est. profit"
                    value={formatMoney(preview.profit, currency)}
                  />
                </FormSidebarSection>
              }
            >
              <FormPanel role="tabpanel">
                {activeTab === 'invoice' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Input
                      label="Invoice number"
                      value={isEditing ? (invoice?.invoiceNumber ?? '') : nextInvoiceNumber}
                      readOnly
                      disabled
                      helperText={isEditing ? 'Cannot change' : 'Assigned on save'}
                    />
                    <Input
                      label="Invoice date"
                      type="date"
                      value={form.invoiceDate}
                      onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))}
                    />
                    <Input
                      label="Due date"
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                    />
                    <Select
                      label="Status"
                      value={form.status}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, status: e.target.value as InvoiceStatus }))
                      }
                      options={INVOICE_STATUS_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                    />
                  </div>
                ) : null}

                {activeTab === 'customer' ? (
                  <div className="space-y-3 max-w-2xl">
                    {errors.customer ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{errors.customer}</p>
                    ) : null}
                    <Select
                      label="Customer type"
                      value={form.customer.mode}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          customer: {
                            ...p.customer,
                            mode: e.target.value as 'existing' | 'new',
                          },
                        }))
                      }
                      options={[
                        { value: 'existing', label: 'Existing customer' },
                        { value: 'new', label: 'New customer' },
                      ]}
                    />
                    {form.customer.mode === 'existing' ? (
                      <Select
                        label="Customer"
                        value={form.customer.customerId}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            customer: { ...p.customer, customerId: e.target.value },
                          }))
                        }
                        options={[
                          { value: '', label: 'Select…' },
                          ...activeCustomers.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Name"
                          value={form.customer.name}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              customer: { ...p.customer, name: e.target.value },
                            }))
                          }
                          required
                        />
                        <Input
                          label="Email"
                          value={form.customer.email}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              customer: { ...p.customer, email: e.target.value },
                            }))
                          }
                        />
                        <Input
                          label="Phone"
                          value={form.customer.phone}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              customer: { ...p.customer, phone: e.target.value },
                            }))
                          }
                        />
                        <Input
                          label="Tax ID"
                          value={form.customer.taxId}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              customer: { ...p.customer, taxId: e.target.value },
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === 'items' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {filledLines} product line{filledLines === 1 ? '' : 's'}
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={addLine}>
                        <Plus className="w-4 h-4" />
                        Add line
                      </Button>
                    </div>
                    {errors.lines ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{errors.lines}</p>
                    ) : null}

                    <div className={`${tableWrapClass} hidden md:block`}>
                      <table className={tableClass}>
                        <thead>
                          <tr className={tableHeadRowClass}>
                            <th className={`${tableHeadCellClass} w-8`}>#</th>
                            <th className={tableHeadCellClass}>Product</th>
                            <th className={`${tableHeadCellClass} w-16`}>Qty</th>
                            <th className={`${tableHeadCellClass} w-24`}>Price</th>
                            <th className={`${tableHeadCellClass} w-24`}>COGS</th>
                            <th className={`${tableHeadCellClass} w-24 text-right`}>Line</th>
                            <th className={`${tableHeadCellClass} w-20`} />
                          </tr>
                        </thead>
                        <tbody>
                          {form.lines.map((line, i) => (
                            <InvoiceLineEditor
                              key={line.id}
                              layout="table"
                              line={line}
                              index={i}
                              products={activeProducts}
                              currency={currency}
                              canRemove={form.lines.length > 1}
                              onChange={(patch) => updateLine(line.id, patch)}
                              onProductSelect={(productId) => fillFromProduct(line.id, productId)}
                              onRemove={() => removeLine(line.id)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden space-y-2">
                      {form.lines.map((line, i) => (
                        <InvoiceLineEditor
                          key={line.id}
                          layout="card"
                          line={line}
                          index={i}
                          products={activeProducts}
                          currency={currency}
                          canRemove={form.lines.length > 1}
                          onChange={(patch) => updateLine(line.id, patch)}
                          onProductSelect={(productId) => fillFromProduct(line.id, productId)}
                          onRemove={() => removeLine(line.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === 'notes' ? (
                  <Textarea
                    label="Invoice notes"
                    optional
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="Payment terms, delivery notes…"
                  />
                ) : null}
              </FormPanel>
            </FormPageGrid>

            {isReady ? (
              <FormReadyBanner>
                {filledLines} line{filledLines === 1 ? '' : 's'} — ready to create.
              </FormReadyBanner>
            ) : null}

            <FormPageMobileActions
              onCancel={() => navigate(cancelTo)}
              saving={saving}
              isEditing={isEditing}
              createLabel="Create sale"
            />
          </FormPageBody>
        )}
      </PageShell>
    </Layout>
  );
}
