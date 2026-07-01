import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClipboardList, Layers, Package, Plus, Trash2 } from 'lucide-react';
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
import { PURCHASE_STATUS_OPTIONS } from '../../constants/purchaseStatuses';
import { firestoreService } from '../../services/firestore';
import type { Product, PurchaseOrder, Vendor } from '../../types';
import { PurchaseOrderStatus, TaxMode, TaxType } from '../../types';
import {
  buildPurchaseFromForm,
  computePurchasePreview,
  emptyPurchaseForm,
  emptyPurchaseLineForm,
  getActiveProducts,
  purchaseToForm,
  type PurchaseFormState,
} from '../../utils/purchaseHelpers';
import { allocateNextPoNumber, previewNextPoNumber } from '../../utils/documentNumbers';
import { syncPurchaseStockReceipts } from '../../utils/purchaseStock';
import { getActiveVendors } from '../../utils/vendorHelpers';
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

export function PurchaseFormPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(purchaseId);
  const currency = company?.currency ?? 'AED';

  const [purchase, setPurchase] = useState<PurchaseOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PurchaseFormState>(() => emptyPurchaseForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ vendorId?: string; lines?: string }>({});
  const [nextPoNumber, setNextPoNumber] = useState('');

  const activeProducts = useMemo(() => getActiveProducts(products), [products]);
  const activeVendors = useMemo(() => getActiveVendors(vendors), [vendors]);
  const preview = useMemo(() => computePurchasePreview(form, products), [form, products]);

  useEffect(() => {
    if (!company) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const [productList, vendorList] = await Promise.all([
          firestoreService.products.getAll(company.id),
          firestoreService.vendors.getAll(company.id),
        ]);
        if (cancelled) return;
        setProducts(productList.filter((p) => !p.deleted));
        setVendors(vendorList.filter((v) => !v.deleted));

        if (isEditing && purchaseId) {
          const found = await firestoreService.purchases.get(company.id, purchaseId);
          if (cancelled) return;
          if (found?.deleted) {
            setPurchase(null);
            setForm(emptyPurchaseForm());
          } else {
            setPurchase(found);
            setForm(found ? purchaseToForm(found) : emptyPurchaseForm());
          }
        } else {
          setPurchase(null);
          const initial = emptyPurchaseForm();
          const vendorFromUrl = searchParams.get('vendor');
          if (vendorFromUrl) initial.vendorId = vendorFromUrl;
          setForm(initial);
        }
      } catch (err) {
        console.error('Failed to load purchase form:', err);
        if (!cancelled) notification.error('Failed to load purchase order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [company, isEditing, purchaseId, searchParams, notification]);

  useEffect(() => {
    if (!company || isEditing) {
      setNextPoNumber('');
      return;
    }
    let cancelled = false;
    previewNextPoNumber(company.id, form.purchaseDate).then((num) => {
      if (!cancelled) setNextPoNumber(num);
    });
    return () => {
      cancelled = true;
    };
  }, [company, isEditing, form.purchaseDate]);

  const updateLine = (lineId: string, patch: Partial<PurchaseFormState['lines'][0]>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyPurchaseLineForm()] }));
  };

  const removeLine = (lineId: string) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length <= 1 ? prev.lines : prev.lines.filter((l) => l.id !== lineId),
    }));
  };

  const fillFromProduct = (lineId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    const listing = product?.platformListings[0];
    updateLine(lineId, {
      productId,
      purchasePrice: listing ? String(listing.purchasePrice) : '',
      sellingPrice: listing ? String(listing.sellingPrice) : '',
      taxType: listing?.taxType ?? TaxType.NONE,
      taxPercentage: String(listing?.purchaseTaxPercentage ?? listing?.taxPercentage ?? 0),
      taxMode: listing?.purchaseTaxMode ?? listing?.taxMode ?? TaxMode.INCLUSIVE,
    });
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.vendorId) next.vendorId = 'Select a vendor';
    const validLines = form.lines.filter((l) => l.productId);
    if (validLines.length === 0) next.lines = 'Add at least one product line';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const poNumber =
        isEditing && purchase
          ? purchase.poNumber
          : await allocateNextPoNumber(company.id, form.purchaseDate);

      const payload = buildPurchaseFromForm(
        form,
        company.id,
        products,
        vendors,
        poNumber,
        purchase ?? undefined
      );

      if (isEditing && purchase) {
        try {
          await syncPurchaseStockReceipts(company.id, purchase, payload);
        } catch (stockErr) {
          console.error(stockErr);
          notification.error(
            stockErr instanceof Error ? stockErr.message : 'Could not update stock receipts'
          );
          setSaving(false);
          return;
        }
        await firestoreService.purchases.update(company.id, purchase.id, payload);
        notification.success('Purchase order updated');
        navigate(`/purchases/${purchase.id}`);
      } else {
        const created = await firestoreService.purchases.create(company.id, payload);
        try {
          await syncPurchaseStockReceipts(company.id, null, created);
        } catch (stockErr) {
          console.error('Stock sync after create:', stockErr);
          notification.error(
            stockErr instanceof Error ? stockErr.message : 'Purchase created but stock could not be updated'
          );
          setSaving(false);
          navigate(`/purchases/${created.id}`);
          return;
        }
        notification.success('Purchase order created');
        navigate(`/purchases/${created.id}`);
      }
    } catch (err) {
      console.error('Failed to save purchase:', err);
      notification.error('Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  const cancelTo = isEditing && purchase ? `/purchases/${purchase.id}` : '/purchases';

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-600 animate-pulse" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading purchase order…</p>
          </div>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? `Edit PO ${purchase?.poNumber ?? ''}` : 'New purchase order'}
          description="Order products from a vendor with purchase and selling prices per line."
        />

        {activeProducts.length === 0 ? (
          <p className={emptyStateMessageClass}>
            Add a product first.{' '}
            <Link to="/products/new" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Create product
            </Link>
          </p>
        ) : activeVendors.length === 0 ? (
          <p className={emptyStateMessageClass}>
            Add a vendor first.{' '}
            <Link to="/vendors/new" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Create vendor
            </Link>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pb-24">
            <FormSection
              icon={ClipboardList}
              title="Order details"
              description="PO reference, vendor, and business date."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="PO number"
                  value={isEditing ? (purchase?.poNumber ?? '') : nextPoNumber}
                  readOnly
                  disabled
                  helperText={isEditing ? 'Auto-assigned and cannot be changed' : 'Assigned automatically on save'}
                />
                <Input
                  label="Purchase date"
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
                />
                <Select
                  label="Vendor"
                  value={form.vendorId}
                  onChange={(e) => setForm((p) => ({ ...p, vendorId: e.target.value }))}
                  error={errors.vendorId}
                  options={[
                    { value: '', label: 'Select vendor…' },
                    ...activeVendors.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as PurchaseOrderStatus,
                    }))
                  }
                  options={PURCHASE_STATUS_OPTIONS.filter(
                    (o) =>
                      o.value !== PurchaseOrderStatus.PARTIALLY_RECEIVED &&
                      o.value !== PurchaseOrderStatus.RECEIVED
                  ).map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
            </FormSection>

            <FormSection
              icon={Package}
              title="Line items"
              description="Products, quantities, purchase price, and selling price."
              headerAction={
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4" />
                  Add line
                </Button>
              }
            >
              {errors.lines ? (
                <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{errors.lines}</p>
              ) : null}
              <div className="space-y-4">
                {form.lines.map((line, index) => (
                  <div
                    key={line.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-gray-500">Line {index + 1}</span>
                      {form.lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          aria-label="Remove line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                    <Select
                      label="Product"
                      value={line.productId}
                      onChange={(e) => fillFromProduct(line.id, e.target.value)}
                      options={[
                        { value: '', label: 'Select product…' },
                        ...activeProducts.map((p) => ({
                          value: p.id,
                          label: p.sku ? `${p.name} (${p.sku})` : p.name,
                        })),
                      ]}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Input
                        label="Qty ordered"
                        type="number"
                        min={1}
                        value={line.quantityOrdered}
                        onChange={(e) => updateLine(line.id, { quantityOrdered: e.target.value })}
                      />
                      <Input
                        label="Purchase price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.purchasePrice}
                        onChange={(e) => updateLine(line.id, { purchasePrice: e.target.value })}
                      />
                      <Input
                        label="Selling price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.sellingPrice}
                        onChange={(e) => updateLine(line.id, { sellingPrice: e.target.value })}
                      />
                      <Select
                        label="Tax"
                        value={line.taxType}
                        onChange={(e) =>
                          updateLine(line.id, { taxType: e.target.value as TaxType })
                        }
                        options={taxTypeOptions}
                      />
                    </div>
                    {line.taxType !== TaxType.NONE ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Tax %"
                          type="number"
                          min={0}
                          value={line.taxPercentage}
                          onChange={(e) => updateLine(line.id, { taxPercentage: e.target.value })}
                        />
                        <Select
                          label="Tax mode"
                          value={line.taxMode}
                          onChange={(e) =>
                            updateLine(line.id, { taxMode: e.target.value as TaxMode })
                          }
                          options={taxModeOptions}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection icon={Layers} title="Summary" description="Order totals.">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="tabular-nums font-medium">{formatMoney(preview.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="tabular-nums">{formatMoney(preview.taxAmount, currency)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold">Total</span>
                  <span className="tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                    {formatMoney(preview.total, currency)}
                  </span>
                </div>
              </div>
            </FormSection>

            <FormSection icon={ClipboardList} title="Notes" description="Optional internal notes.">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Delivery instructions, vendor quote ref…"
              />
            </FormSection>

            <FormStickyActions>
              <Button type="button" variant="outline" onClick={() => navigate(cancelTo)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                {isEditing ? 'Save changes' : 'Create purchase order'}
              </Button>
            </FormStickyActions>
          </form>
        )}
      </PageShell>
    </Layout>
  );
}
