import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Package, Plus } from 'lucide-react';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Textarea } from '../../components/Textarea/Textarea';
import { AmountIncludesTaxField } from '../../components/AmountIncludesTaxField/AmountIncludesTaxField';
import { Button } from '../../components/Button/Button';
import { SaleLineEditor } from '../../components/SaleLineEditor/SaleLineEditor';
import { SaleFormSummaryBar } from '../../components/SaleFormSummaryBar/SaleFormSummaryBar';
import { LineEconomicsPreview } from '../../components/LineEconomicsPreview/LineEconomicsPreview';
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { useAuth } from '../../hooks/useAuth';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Customer, Product } from '../../types';
import { DeliveryMode, PaymentMode, SaleStatus, TaxType } from '../../types';
import { DELIVERY_MODE_OPTIONS, deliveryModeLabel } from '../../constants/deliveryModes';
import { SALE_PAYMENT_MODE_OPTIONS } from '../../constants/paymentModes';
import { SALE_STATUS_OPTIONS } from '../../constants/saleStatuses';
import {
  cardClass,
  cardPaddingClass,
  emptyStateMessageClass,
  tableCellClass,
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableWrapClass,
} from '../../constants/ui';
import { getActiveCustomers } from '../../utils/customerHelpers';
import { previewNextSaleNumber } from '../../utils/documentNumbers';
import { taxPercentLabel } from '../../utils/listingTax';
import { createSaleRecord } from '../../utils/createSaleRecord';
import { formatMoney } from '../../utils/profit';
import {
  computeSalePreview,
  emptySaleForm,
  emptySaleLineForm,
  getActiveProducts,
  getListingsForPlatform,
  suggestGroupDeliveryCost,
  type SaleFormState,
} from '../../utils/saleHelpers';

const INITIAL_LINE_COUNT = 3;
const stickyHeadClass =
  'sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-700';

function formWithActiveLines(form: SaleFormState): SaleFormState {
  const lines = form.lines.filter((line) => line.productId.trim());
  return { ...form, lines: lines.length > 0 ? lines : form.lines };
}

export function BulkSaleEntryPage() {
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const { getProductPlatformOptions } = useCompanyMarketplaces();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderNumberPreview, setOrderNumberPreview] = useState('');
  const [form, setForm] = useState<SaleFormState>(() => ({
    ...emptySaleForm(),
    lines: Array.from({ length: INITIAL_LINE_COUNT }, () => emptySaleLineForm()),
  }));
  const [errors, setErrors] = useState<{
    platform?: string;
    lines?: Record<
      string,
      { productId?: string; platformListingId?: string; variantId?: string }
    >;
  }>({});

  const formProducts = useMemo(() => getActiveProducts(products), [products]);
  const activeCustomers = useMemo(() => getActiveCustomers(customers), [customers]);

  const preview = useMemo(() => computeSalePreview(formWithActiveLines(form)), [form]);
  const firstLineEconomics = form.lines.find((l) => l.productId)?.economics ?? form.lines[0]?.economics;
  const tracksTax = (firstLineEconomics?.taxType ?? TaxType.NONE) !== TaxType.NONE;
  const pctLabel = taxPercentLabel(firstLineEconomics?.taxType ?? TaxType.NONE);
  const isGroupDelivery = form.deliveryMode === DeliveryMode.GROUP;

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
      } catch (err) {
        console.error('Failed to load sale entry:', err);
        notification.error('Failed to load products and customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [company, notification]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    previewNextSaleNumber(company.id, form.orderDate)
      .then((next) => {
        if (!cancelled) setOrderNumberPreview(next);
      })
      .catch(() => {
        /* preview is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [company, form.orderDate]);

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
        variantId: '',
        variantLabel: '',
      })),
    }));
    setErrors((e) => ({ ...e, platform: undefined }));
  };

  const handleDeliveryModeChange = (mode: DeliveryMode) => {
    setForm((f) => {
      const next = { ...f, deliveryMode: mode };
      if (mode === DeliveryMode.GROUP) {
        next.orderShippingCost = suggestGroupDeliveryCost(f.lines);
        const first = f.lines.find((l) => l.productId)?.economics ?? f.lines[0]?.economics;
        if (first) {
          next.orderDeliveryTaxPercentage = first.deliveryTaxPercentage;
          next.orderDeliveryTaxMode = first.deliveryTaxMode;
        }
      }
      return next;
    });
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    const lineErrors: Record<
      string,
      { productId?: string; platformListingId?: string; variantId?: string }
    > = {};

    if (!form.platform.trim()) next.platform = 'Select a marketplace';

    const linesToValidate = form.lines.filter((line) => line.productId.trim());
    if (linesToValidate.length === 0) {
      const firstLine = form.lines[0];
      if (firstLine) {
        lineErrors[firstLine.id] = { productId: 'Add at least one product' };
        next.lines = lineErrors;
      }
      setErrors(next);
      return false;
    }

    for (const line of linesToValidate) {
      const err: {
        productId?: string;
        platformListingId?: string;
        variantId?: string;
      } = {};
      const product = formProducts.find((p) => p.id === line.productId);
      const listings =
        product && form.platform
          ? getListingsForPlatform(product, form.platform)
          : [];

      if (listings.length > 1 && !line.platformListingId) {
        err.platformListingId = 'Select a listing';
      }
      if (
        product?.variants &&
        product.variants.length > 0 &&
        !line.variantId
      ) {
        err.variantId = 'Select a variant';
      }
      if (Object.keys(err).length > 0) lineErrors[line.id] = err;
    }

    const seenProductIds = new Map<string, string>();
    for (const line of linesToValidate) {
      const existingLineId = seenProductIds.get(line.productId);
      if (existingLineId) {
        const message = 'Product already added on another row';
        lineErrors[line.id] = { ...lineErrors[line.id], productId: message };
        lineErrors[existingLineId] = { ...lineErrors[existingLineId], productId: message };
      } else {
        seenProductIds.set(line.productId, line.id);
      }
    }

    if (Object.keys(lineErrors).length > 0) next.lines = lineErrors;
    setErrors(next);
    return !next.platform && !next.lines;
  };

  const handleSubmit = async () => {
    if (!company || !user) return;
    if (!validate()) return;

    const payload = formWithActiveLines(form);
    setSaving(true);
    try {
      const customer = payload.customer.customerId
        ? activeCustomers.find((c) => c.id === payload.customer.customerId)
        : undefined;

      const { sale, warnings } = await createSaleRecord(
        company,
        user.uid,
        payload,
        formProducts,
        customer
      );

      warnings.forEach((msg) => notification.error(msg));
      notification.success('Sale logged');
      navigate(`/sales/${sale.id}`);
    } catch (err) {
      console.error('Failed to save sale:', err);
      notification.error(
        err instanceof Error ? err.message : 'Failed to save sale. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const noProducts = formProducts.length === 0;
  const filledLineCount = form.lines.filter((l) => l.productId).length;

  if (loading) {
    return (
      <PageShell>
        <LoadingView message="Loading…" size="lg" className="py-16" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Log sale"
        description="Spreadsheet-style entry — multiple rows are line items in one order."
        actions={
          !noProducts ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/sales')}>
                Cancel
              </Button>
              <Link to="/sales/new/full">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Tabbed form
                </Button>
              </Link>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
                Log sale
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
            Add at least one active product before logging sales.
          </p>
          <Link to="/products/new">
            <Button type="button" variant="primary">
              Add product
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <SaleFormSummaryBar
            preview={preview}
            currency={currency}
            itemCount={filledLineCount || form.lines.length}
            deliveryLabel={deliveryModeLabel(form.deliveryMode).toLowerCase()}
          />

          {/* Order details */}
          <div className={`${cardClass} ${cardPaddingClass} space-y-3`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Order</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  <Input
                    label="Order number"
                    value={orderNumberPreview || 'Auto-generated on save'}
                    readOnly
                    disabled
                  />
                  <Input
                    label="Marketplace order ID"
                    value={form.orderId}
                    onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
                    placeholder="Optional"
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
                    menuMinWidth={280}
                    options={getProductPlatformOptions(undefined, {
                      emptyLabel: 'Select marketplace…',
                    })}
                    onChange={(e) => handlePlatformChange(e.target.value)}
                    error={errors.platform}
                    required
                  />
                  <Select
                    label="Customer"
                    value={form.customer.customerId}
                    menuMinWidth={280}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customer: { ...f.customer, mode: 'existing', customerId: e.target.value },
                      }))
                    }
                    options={[
                      { value: '', label: 'No customer' },
                      ...activeCustomers.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  <Select
                    label="Payment mode"
                    value={form.paymentMode}
                    options={SALE_PAYMENT_MODE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        paymentMode: e.target.value as PaymentMode | '',
                      }))
                    }
                  />
                  <Select
                    label="Order status"
                    value={form.status}
                    options={SALE_STATUS_OPTIONS}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as SaleStatus }))
                    }
                  />
                  <Input
                    label="Tracking ID"
                    value={form.trackingId}
                    onChange={(e) => setForm((f) => ({ ...f, trackingId: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <Textarea
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Optional order notes"
                />
              </div>

              {/* Delivery */}
              <div className={`${cardClass} ${cardPaddingClass} space-y-3`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Delivery</p>
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
                    ? 'One combined delivery fee for the whole order. Per-item delivery columns are disabled.'
                    : 'Each line uses its own delivery fee — set delivery per unit in the item rows below.'}
                </p>
                {isGroupDelivery ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
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
                      onChange={(mode) =>
                        setForm((f) => ({ ...f, orderDeliveryTaxMode: mode }))
                      }
                    />
                  </div>
                ) : null}
              </div>

              {/* Line items spreadsheet */}
              <div className={`${cardClass} ${cardPaddingClass} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Line items
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {form.platform
                        ? `${filledLineCount || 0} item${filledLineCount === 1 ? '' : 's'} · scroll horizontally for tax & fees`
                        : 'Select a marketplace above first'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    disabled={!form.platform}
                  >
                    <Plus className="w-4 h-4" />
                    Add row
                  </Button>
                </div>

                {!form.platform ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                    Select a marketplace in the Order section before adding products.
                  </p>
                ) : (
                  <div className={`${tableWrapClass} overflow-x-auto max-h-[min(70vh,640px)] overflow-y-auto`}>
                    <table className={`${tableClass} min-w-[2600px] border-collapse`}>
                      <thead>
                        <tr className={tableHeadRowClass}>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} w-10 text-center`}>#</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[18rem]`}>Product</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[12rem]`}>Variant</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[12rem]`}>Listing</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[5rem] text-center`}>Qty</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[7.5rem]`}>Cost</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[7.5rem]`}>Sell</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[7.5rem]`}>Tax type</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[6rem]`}>Input %</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[6.5rem]`}>Input mode</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[6rem]`}>Output %</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[6.5rem]`}>Output mode</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[7.5rem]`}>Output tax/unit</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[8.5rem]`}>Fee type</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[7.5rem]`}>Fee</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[7.5rem]`}>Delivery/unit</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[6rem]`}>Del. tax %</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} min-w-[6.5rem]`}>Del. mode</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} w-24 text-right`}>Profit</th>
                          <th className={`${tableHeadCellClass} ${stickyHeadClass} w-12`} />
                        </tr>
                      </thead>
                      <tbody>
                        {form.lines.map((line, index) => (
                          <SaleLineEditor
                            key={line.id}
                            layout="spreadsheet"
                            line={line}
                            index={index}
                            platform={form.platform}
                            deliveryMode={form.deliveryMode}
                            products={formProducts}
                            currency={currency}
                            canRemove={form.lines.length > 1}
                            usedProductIds={form.lines
                              .filter((l) => l.id !== line.id && l.productId)
                              .map((l) => l.productId)}
                            errors={errors.lines?.[line.id]}
                            onChange={(patch) => updateLine(line.id, patch)}
                            onEconomicsChange={(patch) => updateLineEconomics(line.id, patch)}
                            onRemove={() => removeLine(line.id)}
                          />
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 dark:bg-gray-900/60 font-medium text-sm">
                          <td colSpan={18} className={`${tableCellClass} text-right text-gray-600 dark:text-gray-400`}>
                            Order profit ({filledLineCount || 0} item{filledLineCount === 1 ? '' : 's'})
                          </td>
                          <td className={`${tableCellClass} text-right tabular-nums ${
                            preview.profit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatMoney(preview.profit, currency)}
                          </td>
                          <td className={tableCellClass} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

          <LineEconomicsPreview
            title="Order totals"
            preview={preview}
            currency={currency}
            tracksTax={tracksTax}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/sales')}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              Log sale
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
