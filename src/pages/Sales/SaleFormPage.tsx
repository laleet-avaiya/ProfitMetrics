import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Layers,
  Package,
  Plus,
  Receipt,
  Sparkles,
  Truck,
  Wallet,
} from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { AmountIncludesTaxField } from '../../components/AmountIncludesTaxField/AmountIncludesTaxField';
import { FormSection } from '../../components/FormSection/FormSection';
import { FormStickyActions } from '../../components/FormStickyActions/FormStickyActions';
import { Button } from '../../components/Button/Button';
import { SaleLineEditor } from '../../components/SaleLineEditor/SaleLineEditor';
import { useAuth } from '../../hooks/useAuth';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Product, Sale } from '../../types';
import { DeliveryMode, PaymentMode, PurchasePaymentStatus, TaxType, SaleStatus } from '../../types';
import { DELIVERY_MODE_OPTIONS } from '../../constants/deliveryModes';
import { PAYMENT_MODE_OPTIONS } from '../../constants/paymentModes';
import { PURCHASE_PAYMENT_STATUS_OPTIONS } from '../../constants/purchaseStatuses';
import { taxPercentLabel } from '../../utils/listingTax';
import {
  buildSaleFromForm,
  computeSalePreview,
  emptySaleForm,
  emptySaleLineForm,
  getActiveProducts,
  saleToForm,
  suggestGroupDeliveryCost,
  type SaleFormState,
} from '../../utils/saleHelpers';
import { LineEconomicsPreview } from '../../components/LineEconomicsPreview/LineEconomicsPreview';
import { OutcomeChargeFields } from '../../components/OutcomeChargeFields/OutcomeChargeFields';
import { utcToLocalDateInput } from '../../utils/firestoreDates';
import { syncSaleExpenses } from '../../utils/saleExpenses';
import { syncSaleStock, checkSaleStock } from '../../utils/saleStock';
import { getSaleLines } from '../../utils/saleLines';
import { SALE_STATUS_OPTIONS, saleStatusLabel } from '../../constants/saleStatuses';
import {
  emptyStateMessageClass,
  economicsPreviewColumnClass,
  economicsSplitLayoutClass,
} from '../../constants/ui';

export function SaleFormPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const { productPlatformOptions } = useCompanyMarketplaces();
  const notification = useNotification();
  const isEditing = Boolean(saleId);
  const currency = company?.currency ?? 'AED';

  const [sale, setSale] = useState<Sale | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SaleFormState>(() => emptySaleForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    orderId?: string;
    platform?: string;
    lines?: Record<string, { productId?: string; platformListingId?: string }>;
  }>({});

  const formProducts = useMemo(() => {
    const active = getActiveProducts(products);
    if (!sale) return active;
    const saleProductIds = new Set(getSaleLines(sale).map((l) => l.productId));
    const extras = products.filter((p) => saleProductIds.has(p.id) && !active.some((a) => a.id === p.id));
    return [...active, ...extras];
  }, [products, sale]);

  const preview = useMemo(() => computeSalePreview(form), [form]);
  const firstLineEconomics = form.lines[0]?.economics;
  const tracksTax = (firstLineEconomics?.taxType ?? TaxType.NONE) !== TaxType.NONE;
  const pctLabel = taxPercentLabel(firstLineEconomics?.taxType ?? TaxType.NONE);
  const isReturned = form.status === SaleStatus.RETURNED;
  const isCancelled = form.status === SaleStatus.CANCELLED;
  const isGroupDelivery = form.deliveryMode === DeliveryMode.GROUP;

  useEffect(() => {
    if (!company) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const productList = await firestoreService.products.getAll(company.id);
        if (cancelled) return;
        setProducts(productList.filter((p) => !p.deleted));

        if (isEditing && saleId) {
          const found = await firestoreService.sales.get(company.id, saleId);
          if (cancelled) return;
          if (found?.deleted) {
            setSale(null);
            setForm(emptySaleForm());
          } else {
            setSale(found);
            setForm(found ? saleToForm(found) : emptySaleForm());
          }
        } else {
          setSale(null);
          setForm(emptySaleForm());
        }
      } catch (err) {
        console.error('Failed to load sale form:', err);
        if (!cancelled) notification.error('Failed to load sale');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [company, isEditing, saleId]);

  const updateLine = (lineId: string, patch: Partial<(typeof form.lines)[0]>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    }));
  };

  const updateLineEconomics = (
    lineId: string,
    patch: Partial<(typeof form.lines)[0]['economics']>
  ) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line.economics, ...patch };
        if (patch.sellingTaxPercentage != null) next.taxPercentage = patch.sellingTaxPercentage;
        if (patch.sellingTaxMode != null) next.taxMode = patch.sellingTaxMode;
        const sellingTaxChanged =
          patch.sellingTaxPercentage != null ||
          patch.sellingTaxMode != null ||
          patch.sellingPrice != null ||
          patch.taxType != null;
        return {
          ...line,
          economics: {
            ...next,
            taxAmountManual:
              patch.taxAmountManual ??
              (patch.taxAmountPerUnit != null
                ? true
                : sellingTaxChanged
                  ? false
                  : line.economics.taxAmountManual),
          },
        };
      }),
    }));
  };

  const addLine = () => {
    setForm((f) => ({ ...f, lines: [...f.lines, emptySaleLineForm()] }));
  };

  const removeLine = (lineId: string) => {
    setForm((f) => {
      if (f.lines.length <= 1) return f;
      return { ...f, lines: f.lines.filter((line) => line.id !== lineId) };
    });
  };

  const handlePlatformChange = (platform: string) => {
    setForm((f) => ({
      ...f,
      platform,
      lines: f.lines.map((line) => ({
        ...line,
        productId: '',
        platformListingId: '',
      })),
    }));
  };

  const handleDeliveryModeChange = (mode: DeliveryMode) => {
    setForm((f) => {
      const next = { ...f, deliveryMode: mode };
      if (mode === DeliveryMode.GROUP) {
        next.orderShippingCost = suggestGroupDeliveryCost(f.lines);
        const first = f.lines[0]?.economics;
        if (first) {
          next.orderDeliveryTaxPercentage = first.deliveryTaxPercentage;
          next.orderDeliveryTaxMode = first.deliveryTaxMode;
        }
      }
      return next;
    });
  };

  const applyStatusChange = (status: SaleStatus) => {
    setForm((f) => {
      const next = { ...f, status };
      const econ = f.lines[0]?.economics;

      if (status === SaleStatus.RETURNED) {
        if (!f.returnedAt.trim()) {
          next.returnedAt = f.orderDate || utcToLocalDateInput(new Date());
        }
        if (f.returnTaxPercentage === 0 && (econ?.deliveryTaxPercentage ?? 0) > 0) {
          next.returnTaxPercentage = econ!.deliveryTaxPercentage;
          next.returnTaxMode = econ!.deliveryTaxMode;
        }
        next.cancellationCharges = 0;
        next.cancelledAt = '';
      } else if (status === SaleStatus.CANCELLED) {
        if (!f.cancelledAt.trim()) {
          next.cancelledAt = f.orderDate || utcToLocalDateInput(new Date());
        }
        if (f.cancellationTaxPercentage === 0 && (econ?.deliveryTaxPercentage ?? 0) > 0) {
          next.cancellationTaxPercentage = econ!.deliveryTaxPercentage;
          next.cancellationTaxMode = econ!.deliveryTaxMode;
        }
        next.returnCharges = 0;
        next.returnedAt = '';
      } else {
        next.returnCharges = 0;
        next.returnedAt = '';
        next.cancellationCharges = 0;
        next.cancelledAt = '';
      }

      return next;
    });
  };

  const requestStatusChange = (status: SaleStatus) => {
    if (status === form.status) return;

    const fromLabel = saleStatusLabel(form.status);
    const toLabel = saleStatusLabel(status);
    let message = `Change order status from ${fromLabel} to ${toLabel}?`;

    if (status === SaleStatus.RETURNED) {
      message += ' You can enter return charges and tax after confirming.';
    } else if (status === SaleStatus.CANCELLED) {
      message += ' You can enter cancellation charges and tax after confirming.';
    } else if (
      form.status === SaleStatus.RETURNED ||
      form.status === SaleStatus.CANCELLED
    ) {
      message += ' Return and cancellation fields will be cleared.';
    }

    notification.confirm({
      title: 'Update order status?',
      message,
      confirmLabel: 'Update status',
      variant: 'primary',
      onConfirm: () => applyStatusChange(status),
    });
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    const lineErrors: Record<string, { productId?: string; platformListingId?: string }> = {};

    if (!form.orderId.trim()) next.orderId = 'Order ID is required';
    if (!form.platform.trim()) next.platform = 'Select a marketplace';

    for (const line of form.lines) {
      const err: { productId?: string; platformListingId?: string } = {};
      if (!line.productId) err.productId = 'Select a product';
      if (!line.platformListingId) err.platformListingId = 'Select a listing';
      if (Object.keys(err).length > 0) lineErrors[line.id] = err;
    }

    if (Object.keys(lineErrors).length > 0) next.lines = lineErrors;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const productNames = new Map(formProducts.map((p) => [p.id, p.name]));
      const payload = buildSaleFromForm(form, company.id, productNames, sale ?? undefined);

      if (isEditing && sale) {
        const stockCheck = await checkSaleStock(company.id, payload, sale);
        if (!stockCheck.ok) {
          notification.error(
            `Insufficient stock for ${stockCheck.productName ?? 'product'}. Available: ${stockCheck.available}, needed: ${stockCheck.needed}`
          );
          setSaving(false);
          return;
        }
        await firestoreService.sales.update(company.id, sale.id, payload);
        try {
          await syncSaleStock(company.id, payload, sale);
        } catch (stockErr) {
          console.error('Failed to sync sale stock:', stockErr);
          notification.error('Sale saved but stock could not be updated.');
        }
        try {
          await syncSaleExpenses(company.id, payload);
        } catch (syncErr) {
          console.error('Failed to sync sale expenses:', syncErr);
          notification.error('Sale saved but linked expenses could not be updated.');
        }
        notification.success('Sale updated');
        navigate(`/sales/${sale.id}`);
      } else {
        const stockCheck = await checkSaleStock(company.id, payload);
        if (!stockCheck.ok) {
          notification.error(
            `Insufficient stock for ${stockCheck.productName ?? 'product'}. Available: ${stockCheck.available}, needed: ${stockCheck.needed}`
          );
          setSaving(false);
          return;
        }
        const created = await firestoreService.sales.create(company.id, payload);
        try {
          await syncSaleStock(company.id, created);
        } catch (stockErr) {
          console.error('Failed to sync sale stock:', stockErr);
          notification.error('Sale saved but stock could not be updated.');
        }
        try {
          await syncSaleExpenses(company.id, created);
        } catch (syncErr) {
          console.error('Failed to sync sale expenses:', syncErr);
          notification.error('Sale saved but linked expenses could not be created.');
        }
        notification.success('Sale logged');
        navigate(`/sales/${created.id}`);
      }
    } catch (err) {
      console.error('Failed to save sale:', err);
      notification.error('Failed to save sale. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancelTo = isEditing && sale ? `/sales/${sale.id}` : '/sales';
  const noProducts = formProducts.length === 0;
  const validLines = form.lines.every((l) => l.productId && l.platformListingId);
  const isReady = !isEditing && form.orderId.trim() && form.platform.trim() && validLines;

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading sale…</p>
          </div>
        </PageShell>
      </Layout>
    );
  }

  if (isEditing && !sale) {
    return (
      <Layout>
        <PageShell>
          <PageHeader title="Sale not found" description="This order may have been deleted." />
          <Button type="button" variant="outline" onClick={() => navigate('/sales')}>
            Back to sales
          </Button>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit sale' : 'Log sale'}
          description={
            isEditing
              ? `Update order ${sale?.orderId ?? ''} — add multiple items like an Amazon order.`
              : 'Log a marketplace order with one or more products and individual or group delivery.'
          }
          actions={
            !noProducts ? (
              <div className="hidden lg:flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(cancelTo)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" form="sale-form" variant="primary" loading={saving}>
                  {!isEditing && !saving ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Log sale
                    </>
                  ) : isEditing ? (
                    'Save changes'
                  ) : (
                    'Log sale'
                  )}
                </Button>
              </div>
            ) : null
          }
        />

        {noProducts ? (
          <div className="py-8 flex flex-col items-center space-y-3 max-w-md mx-auto text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <Package className="w-5 h-5" aria-hidden />
            </div>
            <p className={emptyStateMessageClass}>
              Add at least one active product with platform listings before logging sales.
            </p>
            <Link to="/products/new">
              <Button type="button" variant="primary">
                Add product
              </Button>
            </Link>
            <Button type="button" variant="outline" onClick={() => navigate('/sales')}>
              Back to sales
            </Button>
          </div>
        ) : (
          <form id="sale-form" onSubmit={handleSubmit} className="w-full space-y-5 pb-2">
            <FormSection
              icon={Receipt}
              iconTone="indigo"
              step={isEditing ? undefined : 1}
              title="Order details"
              description="Marketplace order ID, date, and channel."
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4">
                  <Input
                    label="Order ID"
                    value={form.orderId}
                    onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
                    error={errors.orderId}
                    required
                    placeholder="Marketplace order number"
                  />
                </div>
                <div className="lg:col-span-3">
                  <Input
                    label="Order date"
                    type="date"
                    value={form.orderDate}
                    onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="lg:col-span-5">
                  <Select
                    label="Marketplace"
                    value={form.platform}
                    options={[
                      { value: '', label: 'Select marketplace…' },
                      ...productPlatformOptions,
                    ]}
                    onChange={(e) => handlePlatformChange(e.target.value)}
                    error={errors.platform}
                    required
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={Package}
              iconTone="violet"
              step={isEditing ? undefined : 2}
              title="Order items"
              description="Add every product in this marketplace order."
              headerAction={
                <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={!form.platform}>
                  <Plus className="w-4 h-4" />
                  Add item
                </Button>
              }
            >
              <div className="space-y-3">
                {form.lines.map((line, index) => (
                  <SaleLineEditor
                    key={line.id}
                    line={line}
                    index={index}
                    platform={form.platform}
                    deliveryMode={form.deliveryMode}
                    products={formProducts}
                    currency={currency}
                    canRemove={form.lines.length > 1}
                    errors={errors.lines?.[line.id]}
                    onChange={(patch) => updateLine(line.id, patch)}
                    onEconomicsChange={(patch) => updateLineEconomics(line.id, patch)}
                    onRemove={() => removeLine(line.id)}
                  />
                ))}
              </div>
            </FormSection>

            <FormSection
              icon={Truck}
              iconTone="emerald"
              step={isEditing ? undefined : 3}
              title="Delivery"
              description="Individual per-item fees from product listings, or one combined shipment fee."
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleDeliveryModeChange(option.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.deliveryMode === option.value
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {DELIVERY_MODE_OPTIONS.find((o) => o.value === form.deliveryMode)?.description}
                </p>

                {isGroupDelivery ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
                    <Input
                      label="Order delivery fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.orderShippingCost || ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          orderShippingCost: parseFloat(e.target.value) || 0,
                        }))
                      }
                      helperText="One combined shipping charge for the whole order"
                    />
                    <Input
                      label={pctLabel}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!tracksTax}
                      value={form.orderDeliveryTaxPercentage || ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          orderDeliveryTaxPercentage: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <AmountIncludesTaxField
                      value={form.orderDeliveryTaxMode}
                      disabled={!tracksTax}
                      onChange={(mode) => setForm((f) => ({ ...f, orderDeliveryTaxMode: mode }))}
                    />
                  </div>
                ) : null}
              </div>
            </FormSection>

            <FormSection
              icon={Layers}
              iconTone="violet"
              step={isEditing ? undefined : 4}
              title="Order profit preview"
              description="Combined economics for all items and delivery."
            >
              <div className={economicsSplitLayoutClass}>
                <div className="xl:col-span-7">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {form.lines.length} item{form.lines.length === 1 ? '' : 's'} ·{' '}
                    {preview.quantity} unit{preview.quantity === 1 ? '' : 's'} ·{' '}
                    {isGroupDelivery ? 'group delivery' : 'individual delivery'}
                  </p>
                </div>
                <div className={`xl:col-span-5 ${economicsPreviewColumnClass}`}>
                  <LineEconomicsPreview
                    title="Order totals"
                    preview={preview}
                    currency={currency}
                    tracksTax={tracksTax}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={Wallet}
              iconTone="emerald"
              step={isEditing ? undefined : 5}
              title="Payment tracking"
              description="Optional — track how and when marketplace payout was received."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select
                  label="Payment mode"
                  value={form.paymentMode}
                  options={PAYMENT_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentMode: e.target.value as PaymentMode }))
                  }
                />
                <Select
                  label="Payment status"
                  value={form.paymentStatus}
                  options={PURCHASE_PAYMENT_STATUS_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentStatus: e.target.value as PurchasePaymentStatus,
                    }))
                  }
                />
              </div>
            </FormSection>

            <FormSection
              icon={Package}
              iconTone="amber"
              step={isEditing ? undefined : 6}
              title="Fulfillment"
              description="Order status, returns, and cancellations with fee + tax."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select
                    label="Status"
                    value={form.status}
                    options={SALE_STATUS_OPTIONS}
                    onChange={(e) => requestStatusChange(e.target.value as SaleStatus)}
                  />
                  {isReturned && (
                    <Input
                      label="Return date"
                      type="date"
                      value={form.returnedAt}
                      onChange={(e) => setForm((f) => ({ ...f, returnedAt: e.target.value }))}
                    />
                  )}
                  {isCancelled && (
                    <Input
                      label="Cancellation date"
                      type="date"
                      value={form.cancelledAt}
                      onChange={(e) => setForm((f) => ({ ...f, cancelledAt: e.target.value }))}
                    />
                  )}
                </div>

                {isReturned && (
                  <OutcomeChargeFields
                    title="Return charges"
                    description="Reverse shipping, restocking, and return logistics."
                    amountLabel="Return charges"
                    amount={form.returnCharges}
                    onAmountChange={(value) => setForm((f) => ({ ...f, returnCharges: value }))}
                    taxPercentage={form.returnTaxPercentage}
                    onTaxPercentageChange={(value) =>
                      setForm((f) => ({ ...f, returnTaxPercentage: value }))
                    }
                    taxMode={form.returnTaxMode}
                    onTaxModeChange={(mode) => setForm((f) => ({ ...f, returnTaxMode: mode }))}
                    tracksTax={tracksTax}
                    pctLabel={pctLabel}
                    currency={currency}
                    previewBase={preview.returnOutcome.base}
                    previewTax={preview.returnOutcome.tax}
                    perUnit={false}
                  />
                )}

                {isCancelled && (
                  <OutcomeChargeFields
                    title="Cancellation charges"
                    description="Marketplace or carrier fees when the order is cancelled."
                    amountLabel="Cancellation charges"
                    amount={form.cancellationCharges}
                    onAmountChange={(value) =>
                      setForm((f) => ({ ...f, cancellationCharges: value }))
                    }
                    taxPercentage={form.cancellationTaxPercentage}
                    onTaxPercentageChange={(value) =>
                      setForm((f) => ({ ...f, cancellationTaxPercentage: value }))
                    }
                    taxMode={form.cancellationTaxMode}
                    onTaxModeChange={(mode) =>
                      setForm((f) => ({ ...f, cancellationTaxMode: mode }))
                    }
                    tracksTax={tracksTax}
                    pctLabel={pctLabel}
                    currency={currency}
                    previewBase={preview.cancellationOutcome.base}
                    previewTax={preview.cancellationOutcome.tax}
                    perUnit={false}
                  />
                )}
              </div>
            </FormSection>

            <FormSection
              icon={Truck}
              iconTone="emerald"
              step={isEditing ? undefined : 7}
              title="Shipment & notes"
              description="Tracking and any extra context for this order."
            >
              <div className="space-y-5">
                <div className="max-w-md">
                  <Input
                    label="Tracking ID"
                    value={form.trackingId}
                    onChange={(e) => setForm((f) => ({ ...f, trackingId: e.target.value }))}
                    placeholder="e.g. AWB123456789"
                  />
                </div>
                <Textarea
                  label="Order notes"
                  optional
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={4}
                />
              </div>
            </FormSection>

            {isReady && (
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Order <span className="font-medium">{form.orderId.trim()}</span> on{' '}
                  <span className="font-medium">{form.platform}</span> with{' '}
                  <span className="font-medium">{form.lines.length}</span> item
                  {form.lines.length === 1 ? '' : 's'} is ready to log.
                </p>
              </div>
            )}

            <FormStickyActions className="lg:hidden">
              <Button type="button" variant="outline" onClick={() => navigate(cancelTo)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                {isEditing ? 'Save changes' : 'Log sale'}
              </Button>
            </FormStickyActions>
          </form>
        )}
      </PageShell>
    </Layout>
  );
}
