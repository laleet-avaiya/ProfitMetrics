import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Package,
  Paperclip,
  Plus,
  Receipt,
  Truck,
  Wallet,
} from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { AmountIncludesTaxField } from '../../components/AmountIncludesTaxField/AmountIncludesTaxField';
import { Button } from '../../components/Button/Button';
import {
  FormPageBody,
  FormPageGrid,
  FormPageHeaderActions,
  FormPageLoading,
  FormPageMobileActions,
  FormPageNotFound,
  FormPanel,
  FormReadyBanner,
} from '../../components/FormPage';
import { SaleLineEditor } from '../../components/SaleLineEditor/SaleLineEditor';
import { SaleFormSummaryBar } from '../../components/SaleFormSummaryBar/SaleFormSummaryBar';
import { FormTabs } from '../../components/ui/FormTabs';
import {
  EntityAttachmentsPanel,
  type PendingFile,
} from '../../components/EntityAttachments';
import { useAuth } from '../../hooks/useAuth';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Product, Sale } from '../../types';
import type { EntityAttachment } from '../../models/attachment';
import { finalizePendingAttachments } from '../../utils/entityAttachments';
import { DeliveryMode, PaymentMode, PurchasePaymentStatus, TaxType, SaleStatus } from '../../types';
import { DELIVERY_MODE_OPTIONS, deliveryModeLabel } from '../../constants/deliveryModes';
import { PAYMENT_MODE_OPTIONS } from '../../constants/paymentModes';
import { PURCHASE_PAYMENT_STATUS_OPTIONS } from '../../constants/purchaseStatuses';
import { taxPercentLabel } from '../../utils/listingTax';
import {
  buildSaleFromForm,
  computeSalePreview,
  emptySaleForm,
  emptySaleLineForm,
  getActiveProducts,
  getListingsForPlatform,
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
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableWrapClass,
} from '../../constants/ui';

type SaleFormTab = 'order' | 'items' | 'delivery' | 'extras' | 'documents';

export function SaleFormPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const { productPlatformOptions } = useCompanyMarketplaces();
  const notification = useNotification();
  const isEditing = Boolean(saleId);
  const currency = company?.currency ?? 'AED';

  const [sale, setSale] = useState<Sale | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SaleFormState>(() => emptySaleForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SaleFormTab>('order');
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
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
            setAttachments(found?.attachments ?? []);
            setPendingFiles([]);
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
  }, [company, isEditing, notification, saleId]);

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
    setActiveTab('items');
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
      const product = formProducts.find((p) => p.id === line.productId);
      const listings = product && form.platform ? getListingsForPlatform(product, form.platform) : [];
      if (line.productId && listings.length > 1 && !line.platformListingId) {
        err.platformListingId = 'Select a listing';
      }
      if (line.productId && listings.length === 0) {
        err.platformListingId = `No ${form.platform} listing for this product`;
      }
      if (Object.keys(err).length > 0) lineErrors[line.id] = err;
    }

    if (Object.keys(lineErrors).length > 0) next.lines = lineErrors;
    setErrors(next);

    if (next.orderId || next.platform) {
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
        await firestoreService.sales.update(
          company.id,
          sale.id,
          { ...payload, attachments },
          user!.uid
        );
        try {
          await syncSaleStock(company.id, payload, user!.uid, sale);
        } catch (stockErr) {
          console.error('Failed to sync sale stock:', stockErr);
          notification.error('Sale saved but stock could not be updated.');
        }
        try {
          await syncSaleExpenses(company.id, payload, user!.uid);
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
        const created = await firestoreService.sales.create(company.id, payload, user!.uid);
        const uploaded = await finalizePendingAttachments(
          company.orgId,
          company.id,
          'sales',
          created.id,
          pendingFiles.map((item) => item.file),
          user!.uid
        );
        if (uploaded.length > 0) {
          await firestoreService.sales.update(
            company.id,
            created.id,
            { attachments: uploaded },
            user!.uid
          );
        }
        try {
          await syncSaleStock(company.id, created, user!.uid);
        } catch (stockErr) {
          console.error('Failed to sync sale stock:', stockErr);
          notification.error('Sale saved but stock could not be updated.');
        }
        try {
          await syncSaleExpenses(company.id, created, user!.uid);
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
  const validLines = form.lines.every((line) => {
    if (!line.productId) return false;
    const product = formProducts.find((p) => p.id === line.productId);
    const listings = product && form.platform ? getListingsForPlatform(product, form.platform) : [];
    if (listings.length === 0) return false;
    if (listings.length > 1 && !line.platformListingId) return false;
    return true;
  });
  const isReady = !isEditing && form.orderId.trim() && form.platform.trim() && validLines;

  const formTabs = [
    { id: 'order' as const, label: 'Order', icon: Receipt },
    { id: 'items' as const, label: 'Items', icon: Package, badge: form.lines.length },
    { id: 'delivery' as const, label: 'Delivery', icon: Truck },
    { id: 'extras' as const, label: 'Payment & notes', icon: Wallet },
    {
      id: 'documents' as const,
      label: 'Documents',
      icon: Paperclip,
      badge: attachments.length + pendingFiles.length || undefined,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <FormPageLoading message="Loading sale…" />
        </PageShell>
      </Layout>
    );
  }

  if (isEditing && !sale) {
    return (
      <Layout>
        <PageShell>
          <FormPageNotFound
            title="Sale not found"
            description="This order may have been deleted."
            backLabel="Back to sales"
            onBack={() => navigate('/sales')}
          />
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit sale' : 'Log sale'}
          description={isEditing ? `Order ${sale?.orderId ?? ''}` : 'Marketplace order'}
          actions={
            !noProducts ? (
              <FormPageHeaderActions
                formId="sale-form"
                onCancel={() => navigate(cancelTo)}
                saving={saving}
                isEditing={isEditing}
                createLabel="Log sale"
              />
            ) : null
          }
        />

        {noProducts ? (
          <div className="py-8 flex flex-col items-center space-y-3 max-w-md mx-auto text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <Package className="w-5 h-5" aria-hidden />
            </div>
            <p className={emptyStateMessageClass}>
              Add at least one active product before logging sales.
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
          <FormPageBody id="sale-form" onSubmit={handleSubmit}>
            <SaleFormSummaryBar
              preview={preview}
              currency={currency}
              itemCount={form.lines.length}
              deliveryLabel={deliveryModeLabel(form.deliveryMode).toLowerCase()}
            />

            <FormTabs
              tabs={formTabs}
              active={activeTab}
              onChange={(id) => setActiveTab(id as SaleFormTab)}
              ariaLabel="Sale form sections"
            />

            <FormPageGrid
              sidebar={
                <LineEconomicsPreview
                  title="Order totals"
                  preview={preview}
                  currency={currency}
                  tracksTax={tracksTax}
                />
              }
            >
              <FormPanel role="tabpanel">
                {activeTab === 'order' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Input
                      label="Order ID"
                      value={form.orderId}
                      onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
                      error={errors.orderId}
                      required
                      placeholder="Amazon order #"
                    />
                    <Input
                      label="Order date"
                      type="date"
                      value={form.orderDate}
                      onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
                      required
                    />
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
                ) : null}

                {activeTab === 'items' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {form.platform
                          ? `${form.lines.length} line${form.lines.length === 1 ? '' : 's'} on ${form.platform}`
                          : 'Pick a marketplace on the Order tab first'}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addLine}
                        disabled={!form.platform}
                      >
                        <Plus className="w-4 h-4" />
                        Add item
                      </Button>
                    </div>

                    {!form.platform ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                        Go to the Order tab and select a marketplace before adding products.
                      </p>
                    ) : (
                      <>
                        <div className={`${tableWrapClass} hidden md:block`}>
                          <table className={tableClass}>
                            <thead>
                              <tr className={tableHeadRowClass}>
                                <th className={`${tableHeadCellClass} w-8`}>#</th>
                                <th className={tableHeadCellClass}>Product</th>
                                <th className={`${tableHeadCellClass} w-16`}>Qty</th>
                                <th className={`${tableHeadCellClass} w-24`}>Cost</th>
                                <th className={`${tableHeadCellClass} w-24`}>Price</th>
                                <th className={`${tableHeadCellClass} w-24 text-right`}>Profit</th>
                                <th className={`${tableHeadCellClass} w-20`} />
                              </tr>
                            </thead>
                            <tbody>
                              {form.lines.map((line, index) => (
                                <SaleLineEditor
                                  key={line.id}
                                  layout="table"
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
                            </tbody>
                          </table>
                        </div>

                        <div className="md:hidden space-y-2">
                          {form.lines.map((line, index) => (
                            <SaleLineEditor
                              key={line.id}
                              layout="card"
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
                      </>
                    )}
                  </div>
                ) : null}

                {activeTab === 'delivery' ? (
                  <div className="space-y-3 max-w-xl">
                    <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900/40">
                      {DELIVERY_MODE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleDeliveryModeChange(option.value)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            form.deliveryMode === option.value
                              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isGroupDelivery
                        ? 'One combined delivery fee for the whole order.'
                        : 'Each line item uses its own delivery fee (set per item on the Items tab).'}
                    </p>

                    {isGroupDelivery ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input
                          label="Combined delivery fee"
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
                ) : null}

                {activeTab === 'extras' ? (
                  <div className="space-y-4">
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
                      <Select
                        label="Order status"
                        value={form.status}
                        options={SALE_STATUS_OPTIONS}
                        onChange={(e) => requestStatusChange(e.target.value as SaleStatus)}
                      />
                      {isReturned ? (
                        <Input
                          label="Return date"
                          type="date"
                          value={form.returnedAt}
                          onChange={(e) => setForm((f) => ({ ...f, returnedAt: e.target.value }))}
                        />
                      ) : null}
                      {isCancelled ? (
                        <Input
                          label="Cancellation date"
                          type="date"
                          value={form.cancelledAt}
                          onChange={(e) => setForm((f) => ({ ...f, cancelledAt: e.target.value }))}
                        />
                      ) : null}
                      <Input
                        label="Tracking ID"
                        value={form.trackingId}
                        onChange={(e) => setForm((f) => ({ ...f, trackingId: e.target.value }))}
                        placeholder="AWB123456789"
                      />
                    </div>

                    {isReturned ? (
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
                    ) : null}

                    {isCancelled ? (
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
                    ) : null}

                    <Textarea
                      label="Order notes"
                      optional
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                ) : null}

                {activeTab === 'documents' ? (
                  <EntityAttachmentsPanel
                    orgId={company!.orgId}
                    companyId={company!.id}
                    collection="sales"
                    entityId={sale?.id ?? null}
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
                Order <span className="font-medium">{form.orderId.trim()}</span> on{' '}
                <span className="font-medium">{form.platform}</span> — ready to log.
              </FormReadyBanner>
            ) : null}

            <FormPageMobileActions
              onCancel={() => navigate(cancelTo)}
              saving={saving}
              isEditing={isEditing}
              createLabel="Log sale"
            />
          </FormPageBody>
        )}
      </PageShell>
    </Layout>
  );
}
