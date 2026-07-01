import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Layers,
  Package,
  Receipt,
  Sparkles,
  Truck,
} from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { AmountIncludesTaxField } from '../../components/AmountIncludesTaxField/AmountIncludesTaxField';
import { SectionHeading, SectionLinePreview } from '../../components/SectionLinePreview/SectionLinePreview';
import { FormSection } from '../../components/FormSection/FormSection';
import { FormStickyActions } from '../../components/FormStickyActions/FormStickyActions';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Product, Sale } from '../../types';
import { PlatformFeeKind, TaxType, SaleStatus } from '../../types';
import {
  platformFeeKindOptions,
  taxPercentLabel,
} from '../../utils/listingTax';
import {
  autoTaxPerUnit,
  buildSaleFromForm,
  computeSalePreview,
  economicsFromListing,
  emptySaleForm,
  getActiveProducts,
  getInitialListingForProduct,
  saleToForm,
  type SaleFormState,
} from '../../utils/saleHelpers';
import { LineEconomicsPreview } from '../../components/LineEconomicsPreview/LineEconomicsPreview';
import { OutcomeChargeFields } from '../../components/OutcomeChargeFields/OutcomeChargeFields';
import { utcToLocalDateInput } from '../../utils/firestoreDates';
import { syncSaleExpenses } from '../../utils/saleExpenses';
import { syncSaleStock, checkSaleStock } from '../../utils/saleStock';
import { SALE_STATUS_OPTIONS, saleStatusLabel } from '../../constants/saleStatuses';
import { emptyStateMessageClass, economicsFieldsColumnClass, economicsPreviewColumnClass, economicsSplitLayoutClass } from '../../constants/ui';

const taxTypeOptions = [
  { value: TaxType.NONE, label: 'None' },
  { value: TaxType.VAT, label: 'VAT' },
  { value: TaxType.GST, label: 'GST' },
  { value: TaxType.SALES_TAX, label: 'Sales tax' },
];

function parseNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function SaleFormPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
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
    productId?: string;
    platformListingId?: string;
  }>({});

  const formProducts = useMemo(() => {
    const active = getActiveProducts(products);
    if (!sale) return active;
    const saleProduct = products.find((p) => p.id === sale.productId);
    if (saleProduct && !active.some((p) => p.id === saleProduct.id)) {
      return [...active, saleProduct];
    }
    return active;
  }, [products, sale]);

  const selectedProduct = useMemo(
    () => formProducts.find((p) => p.id === form.productId) ?? null,
    [formProducts, form.productId]
  );

  const listingOptions = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.platformListings.map((l) => ({
      value: l.id,
      label: l.platform,
    }));
  }, [selectedProduct]);

  const selectedListing = useMemo(() => {
    if (!selectedProduct || !form.platformListingId) return null;
    return (
      selectedProduct.platformListings.find((l) => l.id === form.platformListingId) ?? null
    );
  }, [selectedProduct, form.platformListingId]);

  const preview = useMemo(() => computeSalePreview(form), [form]);
  const orderQty = Math.max(1, form.quantity);
  const perUnitLine = useMemo(() => {
    const scale = (value: number) => Math.round((value / orderQty) * 100) / 100;
    return {
      cogs: scale(preview.cogs),
      grossRevenue: scale(preview.grossRevenue),
      platformFees: scale(preview.platformFees),
      shippingTotal: scale(preview.shippingTotal),
      purchaseTaxAmount: scale(preview.purchaseTaxAmount),
      taxAmount: scale(preview.taxAmount),
      platformFeeTaxAmount: scale(preview.platformFeeTaxAmount),
      deliveryTaxAmount: scale(preview.deliveryTaxAmount),
    };
  }, [preview, orderQty]);

  const displayedTaxPerUnit = form.economics.taxAmountManual
    ? (form.economics.taxAmountPerUnit ?? 0)
    : autoTaxPerUnit(form.economics);

  const isReturned = form.status === SaleStatus.RETURNED;
  const isCancelled = form.status === SaleStatus.CANCELLED;

  useEffect(() => {
    if (!company) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const productList = await firestoreService.products.getAll(company.id);
        if (cancelled) return;
        const allProducts = productList.filter((p) => !p.deleted);
        setProducts(allProducts);

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

  const applyListing = (listingId: string, product: Product) => {
    const listing = product.platformListings.find((l) => l.id === listingId);
    if (!listing) return;
    setForm((f) => ({
      ...f,
      platformListingId: listing.id,
      economics: economicsFromListing(listing),
    }));
  };

  const handleProductChange = (productId: string) => {
    const product = formProducts.find((p) => p.id === productId);
    if (!product) {
      setForm((f) => ({ ...f, productId, platformListingId: '' }));
      return;
    }
    const initialListing = getInitialListingForProduct(product);
    setForm((f) => ({
      ...f,
      productId,
      platformListingId: initialListing?.id ?? '',
      economics: initialListing ? economicsFromListing(initialListing) : f.economics,
    }));
  };

  const updateEconomics = (patch: Partial<SaleFormState['economics']>) => {
    setForm((f) => {
      const next = { ...f.economics, ...patch };
      if (patch.sellingTaxPercentage != null) {
        next.taxPercentage = patch.sellingTaxPercentage;
      }
      if (patch.sellingTaxMode != null) {
        next.taxMode = patch.sellingTaxMode;
      }
      const sellingTaxChanged =
        patch.sellingTaxPercentage != null ||
        patch.sellingTaxMode != null ||
        patch.sellingPrice != null ||
        patch.taxType != null;
      return {
        ...f,
        economics: {
          ...next,
          taxAmountManual:
            patch.taxAmountManual ??
            (patch.taxAmountPerUnit != null
              ? true
              : sellingTaxChanged
                ? false
                : f.economics.taxAmountManual),
        },
      };
    });
  };

  const tracksTax = form.economics.taxType !== TaxType.NONE;
  const pctLabel = taxPercentLabel(form.economics.taxType);
  const feeKind = form.economics.platformFeeKind ?? PlatformFeeKind.FIXED;

  const applyStatusChange = (status: SaleStatus) => {
    setForm((f) => {
      const next = { ...f, status };
      const econ = f.economics;

      if (status === SaleStatus.RETURNED) {
        if (!f.returnedAt.trim()) {
          next.returnedAt = f.orderDate || utcToLocalDateInput(new Date());
        }
        if (f.returnTaxPercentage === 0 && econ.deliveryTaxPercentage > 0) {
          next.returnTaxPercentage = econ.deliveryTaxPercentage;
          next.returnTaxMode = econ.deliveryTaxMode;
        }
        next.cancellationCharges = 0;
        next.cancelledAt = '';
      } else if (status === SaleStatus.CANCELLED) {
        if (!f.cancelledAt.trim()) {
          next.cancelledAt = f.orderDate || utcToLocalDateInput(new Date());
        }
        if (f.cancellationTaxPercentage === 0 && econ.deliveryTaxPercentage > 0) {
          next.cancellationTaxPercentage = econ.deliveryTaxPercentage;
          next.cancellationTaxMode = econ.deliveryTaxMode;
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
    if (!form.orderId.trim()) next.orderId = 'Order ID is required';
    if (!form.productId) next.productId = 'Select a product';
    if (!form.platformListingId) next.platformListingId = 'Select a platform listing';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !selectedProduct || !selectedListing) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildSaleFromForm(
        form,
        company.id,
        selectedProduct.name,
        selectedListing.platform,
        sale ?? undefined
      );

      if (isEditing && sale) {
        const stockCheck = await checkSaleStock(company.id, payload, sale);
        if (!stockCheck.ok) {
          notification.error(
            `Insufficient stock. Available: ${stockCheck.available}, needed: ${stockCheck.needed}`
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
            `Insufficient stock. Available: ${stockCheck.available}, needed: ${stockCheck.needed}`
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

  const isReady =
    !isEditing &&
    form.orderId.trim() &&
    form.productId &&
    form.platformListingId &&
    selectedProduct &&
    selectedListing;

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit sale' : 'Log sale'}
          description={
            isEditing
              ? `Update order ${sale?.orderId ?? ''} economics and delivery details.`
              : 'Pick product and platform — costs auto-fill from your listing.'
          }
          actions={
            !noProducts ? (
              <div className="hidden lg:flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(cancelTo)}
                  disabled={saving}
                >
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
              description="Marketplace order ID, date, product, and platform."
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-3">
                  <Input
                    label="Order ID"
                    value={form.orderId}
                    onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
                    error={errors.orderId}
                    required
                    placeholder="Marketplace order number"
                  />
                </div>
                <div className="lg:col-span-2">
                  <Input
                    label="Order date"
                    type="date"
                    value={form.orderDate}
                    onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="lg:col-span-1">
                  <Input
                    label="Qty"
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    required
                  />
                </div>
                <div className="lg:col-span-3">
                  <Select
                    label="Product"
                    value={form.productId}
                    options={[
                      { value: '', label: 'Select product…' },
                      ...formProducts.map((p) => ({
                        value: p.id,
                        label: p.sku ? `${p.name} (${p.sku})` : p.name,
                      })),
                    ]}
                    onChange={(e) => handleProductChange(e.target.value)}
                    error={errors.productId}
                    required
                  />
                </div>
                <div className="lg:col-span-3">
                  <Select
                    label="Platform"
                    value={form.platformListingId}
                    options={[
                      {
                        value: '',
                        label: selectedProduct ? 'Select platform…' : 'Choose product first',
                      },
                      ...listingOptions,
                    ]}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (selectedProduct) applyListing(id, selectedProduct);
                    }}
                    error={errors.platformListingId}
                    disabled={!selectedProduct}
                    required
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={Layers}
              iconTone="violet"
              step={isEditing ? undefined : 2}
              title="Economics & tax"
              description="Auto-filled from the platform listing — override if this order differed."
            >
              <div className={economicsSplitLayoutClass}>
                <div className={economicsFieldsColumnClass}>
                  <Select
                    label="Tax type"
                    value={form.economics.taxType}
                    options={taxTypeOptions}
                    onChange={(e) =>
                      updateEconomics({
                        taxType: e.target.value as SaleFormState['economics']['taxType'],
                      })
                    }
                  />

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                      <SectionHeading
                        title="Purchase"
                        description="Input tax (ITC) on what you pay for the product."
                      />
                      <div className="space-y-3">
                        <Input
                          label="Purchase price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.economics.purchasePrice || ''}
                          onChange={(e) =>
                            updateEconomics({ purchasePrice: parseNumber(e.target.value) })
                          }
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label={pctLabel}
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!tracksTax}
                            value={form.economics.purchaseTaxPercentage || ''}
                            onChange={(e) =>
                              updateEconomics({ purchaseTaxPercentage: parseNumber(e.target.value) })
                            }
                          />
                          <AmountIncludesTaxField
                            value={form.economics.purchaseTaxMode}
                            disabled={!tracksTax}
                            onChange={(mode) => updateEconomics({ purchaseTaxMode: mode })}
                          />
                        </div>
                      </div>
                      <SectionLinePreview
                        amountLabel="Cost per unit"
                        amount={perUnitLine.cogs}
                        taxDirection="credit"
                        taxAmount={perUnitLine.purchaseTaxAmount}
                        currency={currency}
                        tracksTax={tracksTax}
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                      <SectionHeading
                        title="Selling"
                        description="Output tax collected on the selling price."
                      />
                      <div className="space-y-3">
                        <Input
                          label="Selling price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.economics.sellingPrice || ''}
                          onChange={(e) =>
                            updateEconomics({ sellingPrice: parseNumber(e.target.value) })
                          }
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label={pctLabel}
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!tracksTax}
                            value={form.economics.sellingTaxPercentage || ''}
                            onChange={(e) =>
                              updateEconomics({ sellingTaxPercentage: parseNumber(e.target.value) })
                            }
                          />
                          <AmountIncludesTaxField
                            value={form.economics.sellingTaxMode}
                            disabled={!tracksTax}
                            onChange={(mode) =>
                              updateEconomics({ sellingTaxMode: mode, taxMode: mode })
                            }
                          />
                        </div>
                        <Input
                          label="Output tax (per unit)"
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!tracksTax}
                          value={displayedTaxPerUnit || ''}
                          onChange={(e) =>
                            updateEconomics({
                              taxAmountPerUnit: parseNumber(e.target.value),
                              taxAmountManual: true,
                            })
                          }
                          helperText={
                            form.economics.taxAmountManual
                              ? 'Manual override'
                              : 'Auto from selling tax %'
                          }
                        />
                      </div>
                      <SectionLinePreview
                        amountLabel="Revenue per unit"
                        amount={perUnitLine.grossRevenue}
                        taxDirection="debit"
                        taxAmount={perUnitLine.taxAmount}
                        currency={currency}
                        tracksTax={tracksTax}
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                      <SectionHeading
                        title="Platform fees"
                        description="Marketplace commission — fixed amount or % of selling price."
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select
                          label="Fee type"
                          value={feeKind}
                          options={platformFeeKindOptions}
                          onChange={(e) => {
                            const kind = e.target.value as PlatformFeeKind;
                            updateEconomics({
                              platformFeeKind: kind,
                              platformFee:
                                kind === PlatformFeeKind.FIXED ? form.economics.platformFee : undefined,
                              platformFeePercent:
                                kind === PlatformFeeKind.PERCENT
                                  ? form.economics.platformFeePercent
                                  : undefined,
                            });
                          }}
                        />
                        {feeKind === PlatformFeeKind.FIXED ? (
                          <Input
                            label="Platform fee (amount)"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.economics.platformFee ?? ''}
                            onChange={(e) =>
                              updateEconomics({
                                platformFee: e.target.value ? parseNumber(e.target.value) : undefined,
                                platformFeePercent: undefined,
                              })
                            }
                            helperText="Per unit, e.g. FBA fee"
                          />
                        ) : (
                          <Input
                            label="Platform fee (%)"
                            type="number"
                            min="0"
                            step="0.1"
                            value={form.economics.platformFeePercent ?? ''}
                            onChange={(e) =>
                              updateEconomics({
                                platformFeePercent: e.target.value
                                  ? parseNumber(e.target.value)
                                  : undefined,
                                platformFee: undefined,
                              })
                            }
                            helperText="e.g. 15 for Amazon referral"
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label={`${pctLabel} on platform fee`}
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!tracksTax}
                          value={form.economics.platformFeeTaxPercentage || ''}
                          onChange={(e) =>
                            updateEconomics({ platformFeeTaxPercentage: parseNumber(e.target.value) })
                          }
                        />
                        <AmountIncludesTaxField
                          value={form.economics.platformFeeTaxMode}
                          disabled={!tracksTax}
                          onChange={(mode) => updateEconomics({ platformFeeTaxMode: mode })}
                        />
                      </div>
                      <SectionLinePreview
                        amountLabel="Platform fee per unit"
                        amount={perUnitLine.platformFees}
                        taxDirection="credit"
                        taxAmount={perUnitLine.platformFeeTaxAmount}
                        currency={currency}
                        tracksTax={tracksTax}
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                      <SectionHeading
                        title="Delivery"
                        description="Shipping / delivery cost and input tax on it."
                      />
                      <div className="space-y-3">
                        <Input
                          label="Delivery fee"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.economics.shippingCost || ''}
                          onChange={(e) =>
                            updateEconomics({ shippingCost: parseNumber(e.target.value) })
                          }
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label={pctLabel}
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!tracksTax}
                            value={form.economics.deliveryTaxPercentage || ''}
                            onChange={(e) =>
                              updateEconomics({ deliveryTaxPercentage: parseNumber(e.target.value) })
                            }
                          />
                          <AmountIncludesTaxField
                            value={form.economics.deliveryTaxMode}
                            disabled={!tracksTax}
                            onChange={(mode) => updateEconomics({ deliveryTaxMode: mode })}
                          />
                        </div>
                      </div>
                      <SectionLinePreview
                        amountLabel="Delivery cost per unit"
                        amount={perUnitLine.shippingTotal}
                        taxDirection="credit"
                        taxAmount={perUnitLine.deliveryTaxAmount}
                        currency={currency}
                        tracksTax={tracksTax}
                      />
                    </div>
                  </div>

                  <div className="xl:hidden">
                    <LineEconomicsPreview
                      title="Order profit preview"
                      preview={preview}
                      currency={currency}
                      tracksTax={tracksTax}
                    />
                  </div>
                </div>

                <div className={`hidden xl:block ${economicsPreviewColumnClass}`}>
                  <LineEconomicsPreview
                    title="Order profit preview"
                    preview={preview}
                    currency={currency}
                    tracksTax={tracksTax}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={Package}
              iconTone="amber"
              step={isEditing ? undefined : 3}
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
                      helperText="When the return was processed"
                    />
                  )}
                  {isCancelled && (
                    <Input
                      label="Cancellation date"
                      type="date"
                      value={form.cancelledAt}
                      onChange={(e) => setForm((f) => ({ ...f, cancelledAt: e.target.value }))}
                      helperText="When the order was cancelled"
                    />
                  )}
                </div>

                {isReturned && (
                  <div className="space-y-3">
                    <OutcomeChargeFields
                      title="Return charges"
                      description="Reverse shipping, restocking, and return logistics."
                      amountLabel="Return charges"
                      amount={form.returnCharges}
                      onAmountChange={(value) =>
                        setForm((f) => ({ ...f, returnCharges: value }))
                      }
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
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      Adjust purchase, selling, and fee amounts above if they changed on return.
                      Return charges and ITC are included in the profit preview.
                    </p>
                  </div>
                )}

                {isCancelled && (
                  <div className="space-y-3">
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
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      Cancellation fees and any ITC on them reduce profit in the preview table.
                    </p>
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection
              icon={Truck}
              iconTone="emerald"
              step={isEditing ? undefined : 4}
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
                    helperText="Carrier or marketplace tracking number"
                  />
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-4 sm:p-5">
                  <Textarea
                    label="Order notes"
                    optional
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    helperText="Delivery instructions, customer requests, or internal reminders."
                    placeholder="e.g. Leave at reception, gift wrap requested…"
                    rows={4}
                  />
                </div>
              </div>
            </FormSection>

            {isReady && (
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Order <span className="font-medium">{form.orderId.trim()}</span> for{' '}
                  <span className="font-medium">{selectedProduct.name}</span> on{' '}
                  <span className="font-medium">{selectedListing.platform}</span> is ready — review
                  the profit preview, then log the sale.
                </p>
              </div>
            )}

            <FormStickyActions className="lg:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(cancelTo)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
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
            </FormStickyActions>
          </form>
        )}
      </PageShell>
    </Layout>
  );
}
