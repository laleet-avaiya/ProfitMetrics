import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText, Layers, Package, Plus, Trash2, UserCircle } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { FormSection } from '../../components/FormSection/FormSection';
import { FormStickyActions } from '../../components/FormStickyActions/FormStickyActions';
import { Button } from '../../components/Button/Button';
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
import { applyInvoiceStock, resyncInvoiceStock } from '../../utils/invoiceStock';
import { formatMoney } from '../../utils/profit';
import { emptyStateMessageClass } from '../../constants/ui';

const taxTypeOptions = [
  { value: TaxType.NONE, label: 'None' },
  { value: TaxType.VAT, label: 'VAT' },
  { value: TaxType.GST, label: 'GST' },
  { value: TaxType.SALES_TAX, label: 'Sales tax' },
];
const taxModeOptions = [
  { value: TaxMode.INCLUSIVE, label: 'Inclusive' },
  { value: TaxMode.EXCLUSIVE, label: 'Exclusive' },
];

export function InvoiceFormPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(invoiceId);
  const currency = company?.currency ?? 'AED';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<InvoiceFormState>(() => emptyInvoiceForm());
  const [saving, setSaving] = useState(false);
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
    return () => { cancelled = true; };
  }, [company, isEditing, invoiceId, searchParams, notification]);

  useEffect(() => {
    if (!company || isEditing) {
      setNextInvoiceNumber('');
      return;
    }
    let cancelled = false;
    previewNextInvoiceNumber(company.id, form.invoiceDate).then((num) => {
      if (!cancelled) setNextInvoiceNumber(num);
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
    const created = await firestoreService.customers.create(company.id, customerPayload);
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
    return Object.keys(next).length === 0;
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
        await firestoreService.invoices.update(company.id, invoice.id, payload);
        const stockResult = await resyncInvoiceStock(company.id, invoice, {
          ...payload,
          id: invoice.id,
        });
        if (!stockResult.ok) {
          notification.error(`Insufficient stock for ${stockResult.productName}`);
        }
        notification.success('Invoice updated');
        navigate(`/invoices/${invoice.id}`);
      } else {
        const created = await firestoreService.invoices.create(company.id, payload);
        if (shouldApplyInvoiceStock(created)) {
          const stockResult = await applyInvoiceStock(company.id, created);
          if (!stockResult.ok) {
            notification.error(`Invoice saved but insufficient stock for ${stockResult.productName}`);
          }
        }
        notification.success('Invoice created');
        navigate(`/invoices/${created.id}`);
      }
    } catch (err) {
      console.error(err);
      notification.error('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout><PageShell><p className="text-center py-20 text-gray-500">Loading…</p></PageShell></Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader title={isEditing ? `Edit invoice ${invoice?.invoiceNumber ?? ''}` : 'New offline sale invoice'} description="Invoice a customer for an offline sale with line items and tax." />
        {activeProducts.length === 0 ? (
          <p className={emptyStateMessageClass}>Add products first. <Link to="/products/new" className="text-indigo-600 hover:underline">Create product</Link></p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pb-24">
            <FormSection icon={FileText} title="Invoice details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Invoice number"
                  value={isEditing ? (invoice?.invoiceNumber ?? '') : nextInvoiceNumber}
                  readOnly
                  disabled
                  helperText={isEditing ? 'Auto-assigned and cannot be changed' : 'Assigned automatically on save'}
                />
                <Input label="Invoice date" type="date" value={form.invoiceDate} onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))} />
                <Input label="Due date" type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
                <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as InvoiceStatus }))}
                  options={INVOICE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              </div>
            </FormSection>

            <FormSection icon={UserCircle} title="Customer">
              {errors.customer ? <p className="text-sm text-rose-600 mb-2">{errors.customer}</p> : null}
              <Select label="Customer type" value={form.customer.mode}
                onChange={(e) => setForm((p) => ({ ...p, customer: { ...p.customer, mode: e.target.value as 'existing' | 'new' } }))}
                options={[{ value: 'existing', label: 'Existing customer' }, { value: 'new', label: 'New customer' }]} />
              {form.customer.mode === 'existing' ? (
                <div className="mt-3">
                  <Select label="Customer" value={form.customer.customerId}
                    onChange={(e) => setForm((p) => ({ ...p, customer: { ...p.customer, customerId: e.target.value } }))}
                    options={[{ value: '', label: 'Select…' }, ...activeCustomers.map((c) => ({ value: c.id, label: c.name }))]} />
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Name" value={form.customer.name} onChange={(e) => setForm((p) => ({ ...p, customer: { ...p.customer, name: e.target.value } }))} />
                  <Input label="Email" value={form.customer.email} onChange={(e) => setForm((p) => ({ ...p, customer: { ...p.customer, email: e.target.value } }))} />
                  <Input label="Phone" value={form.customer.phone} onChange={(e) => setForm((p) => ({ ...p, customer: { ...p.customer, phone: e.target.value } }))} />
                  <Input label="Tax ID" value={form.customer.taxId} onChange={(e) => setForm((p) => ({ ...p, customer: { ...p.customer, taxId: e.target.value } }))} />
                </div>
              )}
            </FormSection>

            <FormSection icon={Package} title="Line items" headerAction={<Button type="button" variant="outline" size="sm" onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, emptyInvoiceLineForm()] }))}><Plus className="w-4 h-4" />Add line</Button>}>
              {errors.lines ? <p className="text-sm text-rose-600 mb-2">{errors.lines}</p> : null}
              <div className="space-y-4">
                {form.lines.map((line, i) => (
                  <div key={line.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex justify-between"><span className="text-xs font-semibold uppercase text-gray-500">Line {i + 1}</span>
                      {form.lines.length > 1 && <button type="button" onClick={() => setForm((p) => ({ ...p, lines: p.lines.filter((l) => l.id !== line.id) }))}><Trash2 className="w-4 h-4 text-rose-600" /></button>}
                    </div>
                    <Select label="Product" value={line.productId} onChange={(e) => fillFromProduct(line.id, e.target.value)}
                      options={[{ value: '', label: 'Select…' }, ...activeProducts.map((p) => ({ value: p.id, label: p.name }))]} />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Input label="Qty" type="number" min={1} value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
                      <Input label="Unit price" type="number" min={0} step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })} />
                      <Input label="COGS / unit" type="number" min={0} step="0.01" value={line.purchasePrice} onChange={(e) => updateLine(line.id, { purchasePrice: e.target.value })} />
                      <Select label="Tax" value={line.taxType} onChange={(e) => updateLine(line.id, { taxType: e.target.value as TaxType })} options={taxTypeOptions} />
                    </div>
                    {line.taxType !== TaxType.NONE && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Tax %" type="number" value={line.taxPercentage} onChange={(e) => updateLine(line.id, { taxPercentage: e.target.value })} />
                        <Select label="Tax mode" value={line.taxMode} onChange={(e) => updateLine(line.id, { taxMode: e.target.value as TaxMode })} options={taxModeOptions} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection icon={Layers} title="Summary">
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(preview.subtotal, currency)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{formatMoney(preview.taxAmount, currency)}</span></div>
                <div className="flex justify-between"><span>COGS</span><span>{formatMoney(preview.totalCogs, currency)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span>Total</span><span className="text-indigo-600">{formatMoney(preview.total, currency)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Est. profit</span><span>{formatMoney(preview.profit, currency)}</span></div>
              </div>
            </FormSection>

            <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Notes" />

            <FormStickyActions>
              <Button type="button" variant="outline" onClick={() => navigate(isEditing && invoice ? `/invoices/${invoice.id}` : '/invoices')} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" loading={saving}>{isEditing ? 'Save invoice' : 'Create invoice'}</Button>
            </FormStickyActions>
          </form>
        )}
      </PageShell>
    </Layout>
  );
}
