import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  Package,
  Plus,
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
import { PurchaseFormSummaryBar } from '../../components/PurchaseFormSummaryBar/PurchaseFormSummaryBar';
import { PurchaseLineEditor } from '../../components/PurchaseLineEditor/PurchaseLineEditor';
import { FormTabs } from '../../components/ui/FormTabs';
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
import { syncPurchaseExpenses } from '../../utils/purchaseExpenses';
import { getActiveVendors } from '../../utils/vendorHelpers';
import { formatMoney } from '../../utils/profit';
import {
  emptyStateMessageClass,
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableWrapClass,
} from '../../constants/ui';

type PurchaseFormTab = 'order' | 'items' | 'notes';

export function PurchaseFormPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(purchaseId);
  const currency = company?.currency ?? 'AED';

  const [purchase, setPurchase] = useState<PurchaseOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PurchaseFormState>(() => emptyPurchaseForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<PurchaseFormTab>('order');
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
          if (vendorFromUrl) {
            initial.vendorId = vendorFromUrl;
            setActiveTab('items');
          }
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
    setActiveTab('items');
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

    if (next.vendorId) {
      setActiveTab('order');
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
        if (payload.payments.length > 0) {
          await syncPurchaseExpenses(company.id, { ...purchase, ...payload }, user!.uid);
        }
        notification.success('Purchase order updated');
        navigate(`/purchases/${purchase.id}`);
      } else {
        const created = await firestoreService.purchases.create(company.id, payload);
        try {
          await syncPurchaseStockReceipts(company.id, null, created);
        } catch (stockErr) {
          console.error('Stock sync after create:', stockErr);
          notification.error(
            stockErr instanceof Error
              ? stockErr.message
              : 'Purchase created but stock could not be updated'
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
  const filledLines = form.lines.filter((l) => l.productId).length;
  const isReady = !isEditing && form.vendorId && filledLines > 0;

  const statusOptions = PURCHASE_STATUS_OPTIONS.filter(
    (o) =>
      o.value !== PurchaseOrderStatus.PARTIALLY_RECEIVED &&
      o.value !== PurchaseOrderStatus.RECEIVED
  ).map((o) => ({ value: o.value, label: o.label }));

  const formTabs = [
    { id: 'order' as const, label: 'Order', icon: ClipboardList },
    { id: 'items' as const, label: 'Items', icon: Package, badge: form.lines.length },
    { id: 'notes' as const, label: 'Notes', icon: Building2 },
  ];

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <FormPageLoading message="Loading purchase order…" />
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
          actions={
            activeProducts.length > 0 && activeVendors.length > 0 ? (
              <FormPageHeaderActions
                formId="purchase-form"
                onCancel={() => navigate(cancelTo)}
                saving={saving}
                isEditing={isEditing}
                createLabel="Create PO"
              />
            ) : null
          }
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
          <FormPageBody id="purchase-form" onSubmit={handleSubmit}>
            <PurchaseFormSummaryBar
              subtotal={preview.subtotal}
              taxAmount={preview.taxAmount}
              total={preview.total}
              lineCount={preview.lineCount}
              currency={currency}
            />

            <FormTabs
              tabs={formTabs}
              active={activeTab}
              onChange={(id) => setActiveTab(id as PurchaseFormTab)}
              ariaLabel="Purchase order form sections"
            />

            <FormPageGrid
              sidebar={
                <FormSidebarSection title="Breakdown">
                  <FormSidebarRow
                    label="Subtotal"
                    value={formatMoney(preview.subtotal, currency)}
                  />
                  <FormSidebarRow
                    label="Tax"
                    value={formatMoney(preview.taxAmount, currency)}
                  />
                  <FormSidebarRow
                    label="Total"
                    value={formatMoney(preview.total, currency)}
                    emphasize
                  />
                  {form.vendorId ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                      Vendor:{' '}
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {activeVendors.find((v) => v.id === form.vendorId)?.name ?? '—'}
                      </span>
                    </p>
                  ) : null}
                </FormSidebarSection>
              }
            >
              <FormPanel role="tabpanel">
                {activeTab === 'order' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Input
                      label="PO number"
                      value={isEditing ? (purchase?.poNumber ?? '') : nextPoNumber}
                      readOnly
                      disabled
                      helperText={isEditing ? 'Cannot change' : 'Assigned on save'}
                    />
                    <Input
                      label="Reference"
                      value={form.reference}
                      onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                      placeholder="Vendor quote #"
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
                      options={statusOptions}
                    />
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
                            <th className={`${tableHeadCellClass} w-24`}>Cost</th>
                            <th className={`${tableHeadCellClass} w-24`}>Sell</th>
                            <th className={`${tableHeadCellClass} w-24 text-right`}>Line</th>
                            <th className={`${tableHeadCellClass} w-20`} />
                          </tr>
                        </thead>
                        <tbody>
                          {form.lines.map((line, i) => (
                            <PurchaseLineEditor
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
                        <PurchaseLineEditor
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
                    label="Order notes"
                    optional
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="Delivery instructions, vendor quote ref…"
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
              createLabel="Create PO"
            />
          </FormPageBody>
        )}
      </PageShell>
    </Layout>
  );
}
