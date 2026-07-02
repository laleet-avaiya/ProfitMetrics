import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AmountIncludesTaxField } from '../AmountIncludesTaxField/AmountIncludesTaxField';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { SectionHeading, SectionLinePreview } from '../SectionLinePreview/SectionLinePreview';
import { economicsFieldsColumnClass } from '../../constants/ui';
import type { Product } from '../../types';
import { DeliveryMode, PlatformFeeKind, TaxType } from '../../types';
import { platformFeeKindOptions, taxPercentLabel } from '../../utils/listingTax';
import {
  autoTaxPerUnit,
  economicsFromListing,
  getListingsForPlatform,
  type SaleFormEconomics,
  type SaleFormState,
  type SaleLineFormState,
} from '../../utils/saleHelpers';
import { computeLineEconomics } from '../../utils/profit';
import { formatMoney } from '../../utils/profit';

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

interface SaleLineEditorProps {
  line: SaleLineFormState;
  index: number;
  platform: string;
  deliveryMode: SaleFormState['deliveryMode'];
  products: Product[];
  currency: string;
  canRemove: boolean;
  errors?: { productId?: string; platformListingId?: string };
  onChange: (patch: Partial<SaleLineFormState>) => void;
  onEconomicsChange: (patch: Partial<SaleFormEconomics>) => void;
  onRemove: () => void;
}

export function SaleLineEditor({
  line,
  index,
  platform,
  deliveryMode,
  products,
  currency,
  canRemove,
  errors,
  onChange,
  onEconomicsChange,
  onRemove,
}: SaleLineEditorProps) {
  const [expanded, setExpanded] = useState(index === 0);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === line.productId) ?? null,
    [products, line.productId]
  );

  const listingOptions = useMemo(() => {
    if (!selectedProduct || !platform) return [];
    return getListingsForPlatform(selectedProduct, platform).map((l) => ({
      value: l.id,
      label: l.platformSku ? `${l.platform} (${l.platformSku})` : l.platform,
    }));
  }, [selectedProduct, platform]);

  const linePreview = useMemo(() => {
    const e = line.economics;
    const taxOverride =
      e.taxAmountManual && e.taxAmountPerUnit != null ? e.taxAmountPerUnit : undefined;
    return computeLineEconomics({
      quantity: Math.max(1, line.quantity),
      purchasePrice: e.purchasePrice,
      sellingPrice: e.sellingPrice,
      shippingCost: deliveryMode === DeliveryMode.GROUP ? 0 : e.shippingCost,
      platformFee: e.platformFee,
      platformFeePercent: e.platformFeePercent,
      platformFeeKind: e.platformFeeKind,
      taxType: e.taxType,
      taxPercentage: e.sellingTaxPercentage,
      taxMode: e.sellingTaxMode,
      purchaseTaxPercentage: e.purchaseTaxPercentage,
      purchaseTaxMode: e.purchaseTaxMode,
      sellingTaxPercentage: e.sellingTaxPercentage,
      sellingTaxMode: e.sellingTaxMode,
      deliveryTaxPercentage: e.deliveryTaxPercentage,
      deliveryTaxMode: e.deliveryTaxMode,
      platformFeeTaxPercentage: e.platformFeeTaxPercentage,
      platformFeeTaxMode: e.platformFeeTaxMode,
      taxAmountOverride: taxOverride,
    });
  }, [line, deliveryMode]);

  const orderQty = Math.max(1, line.quantity);
  const perUnitLine = useMemo(() => {
    const scale = (value: number) => Math.round((value / orderQty) * 100) / 100;
    return {
      cogs: scale(linePreview.cogs),
      grossRevenue: scale(linePreview.grossRevenue),
      platformFees: scale(linePreview.platformFees),
      shippingTotal: scale(linePreview.shippingTotal),
      purchaseTaxAmount: scale(linePreview.purchaseTaxAmount),
      taxAmount: scale(linePreview.taxAmount),
      platformFeeTaxAmount: scale(linePreview.platformFeeTaxAmount),
      deliveryTaxAmount: scale(linePreview.deliveryTaxAmount),
    };
  }, [linePreview, orderQty]);

  const tracksTax = line.economics.taxType !== TaxType.NONE;
  const pctLabel = taxPercentLabel(line.economics.taxType);
  const feeKind = line.economics.platformFeeKind ?? PlatformFeeKind.FIXED;
  const displayedTaxPerUnit = line.economics.taxAmountManual
    ? (line.economics.taxAmountPerUnit ?? 0)
    : autoTaxPerUnit(line.economics);

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      onChange({ productId, platformListingId: '' });
      return;
    }
    const listings = getListingsForPlatform(product, platform);
    const listing = listings.length === 1 ? listings[0] : null;
    onChange({
      productId,
      platformListingId: listing?.id ?? '',
      economics: listing ? economicsFromListing(listing) : line.economics,
    });
  };

  const handleListingChange = (listingId: string) => {
    if (!selectedProduct) return;
    const listing = selectedProduct.platformListings.find((l) => l.id === listingId);
    if (!listing) return;
    onChange({
      platformListingId: listing.id,
      economics: economicsFromListing(listing),
    });
  };

  const productLabel =
    selectedProduct?.sku ? `${selectedProduct.name} (${selectedProduct.sku})` : selectedProduct?.name;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-gray-50/80 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Item {index + 1}
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
          {productLabel ?? 'Select product'}
        </span>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {formatMoney(linePreview.grossRevenue, currency)} ·{' '}
          {formatMoney(linePreview.profit, currency)} profit
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label={expanded ? 'Collapse item' : 'Expand item'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            aria-label="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="p-3 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5">
              <Select
                label="Product"
                value={line.productId}
                options={[
                  { value: '', label: platform ? 'Select product…' : 'Choose platform first' },
                  ...products.map((p) => ({
                    value: p.id,
                    label: p.sku ? `${p.name} (${p.sku})` : p.name,
                  })),
                ]}
                onChange={(e) => handleProductChange(e.target.value)}
                error={errors?.productId}
                disabled={!platform}
                required
              />
            </div>
            <div className="lg:col-span-4">
              <Select
                label="Listing"
                value={line.platformListingId}
                options={[
                  {
                    value: '',
                    label: selectedProduct ? 'Select listing…' : 'Choose product first',
                  },
                  ...listingOptions,
                ]}
                onChange={(e) => handleListingChange(e.target.value)}
                error={errors?.platformListingId}
                disabled={!selectedProduct || !platform}
                required
              />
            </div>
            <div className="lg:col-span-3">
              <Input
                label="Qty"
                type="number"
                min="1"
                step="1"
                value={line.quantity || ''}
                onChange={(e) =>
                  onChange({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                required
              />
            </div>
          </div>

          <div className={economicsFieldsColumnClass}>
            <Select
              label="Tax type"
              value={line.economics.taxType}
              options={taxTypeOptions}
              onChange={(e) =>
                onEconomicsChange({
                  taxType: e.target.value as SaleFormEconomics['taxType'],
                })
              }
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                <SectionHeading title="Purchase" description="Input tax (ITC) on product cost." />
                <Input
                  label="Purchase price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.economics.purchasePrice || ''}
                  onChange={(e) =>
                    onEconomicsChange({ purchasePrice: parseNumber(e.target.value) })
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={pctLabel}
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!tracksTax}
                    value={line.economics.purchaseTaxPercentage || ''}
                    onChange={(e) =>
                      onEconomicsChange({ purchaseTaxPercentage: parseNumber(e.target.value) })
                    }
                  />
                  <AmountIncludesTaxField
                    value={line.economics.purchaseTaxMode}
                    disabled={!tracksTax}
                    onChange={(mode) => onEconomicsChange({ purchaseTaxMode: mode })}
                  />
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
                <SectionHeading title="Selling" description="Output tax on selling price." />
                <Input
                  label="Selling price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.economics.sellingPrice || ''}
                  onChange={(e) =>
                    onEconomicsChange({ sellingPrice: parseNumber(e.target.value) })
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={pctLabel}
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!tracksTax}
                    value={line.economics.sellingTaxPercentage || ''}
                    onChange={(e) =>
                      onEconomicsChange({ sellingTaxPercentage: parseNumber(e.target.value) })
                    }
                  />
                  <AmountIncludesTaxField
                    value={line.economics.sellingTaxMode}
                    disabled={!tracksTax}
                    onChange={(mode) =>
                      onEconomicsChange({ sellingTaxMode: mode, taxMode: mode })
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
                    onEconomicsChange({
                      taxAmountPerUnit: parseNumber(e.target.value),
                      taxAmountManual: true,
                    })
                  }
                />
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
                <SectionHeading title="Platform fees" description="Marketplace commission." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Fee type"
                    value={feeKind}
                    options={platformFeeKindOptions}
                    onChange={(e) => {
                      const kind = e.target.value as PlatformFeeKind;
                      onEconomicsChange({
                        platformFeeKind: kind,
                        platformFee:
                          kind === PlatformFeeKind.FIXED ? line.economics.platformFee : undefined,
                        platformFeePercent:
                          kind === PlatformFeeKind.PERCENT
                            ? line.economics.platformFeePercent
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
                      value={line.economics.platformFee ?? ''}
                      onChange={(e) =>
                        onEconomicsChange({
                          platformFee: e.target.value ? parseNumber(e.target.value) : undefined,
                          platformFeePercent: undefined,
                        })
                      }
                    />
                  ) : (
                    <Input
                      label="Platform fee (%)"
                      type="number"
                      min="0"
                      step="0.1"
                      value={line.economics.platformFeePercent ?? ''}
                      onChange={(e) =>
                        onEconomicsChange({
                          platformFeePercent: e.target.value
                            ? parseNumber(e.target.value)
                            : undefined,
                          platformFee: undefined,
                        })
                      }
                    />
                  )}
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

              {deliveryMode === DeliveryMode.INDIVIDUAL ? (
                <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                  <SectionHeading
                    title="Delivery"
                    description="Per-unit delivery fee for this item."
                  />
                  <Input
                    label="Delivery fee (per unit)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.economics.shippingCost || ''}
                    onChange={(e) =>
                      onEconomicsChange({ shippingCost: parseNumber(e.target.value) })
                    }
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label={pctLabel}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!tracksTax}
                      value={line.economics.deliveryTaxPercentage || ''}
                      onChange={(e) =>
                        onEconomicsChange({ deliveryTaxPercentage: parseNumber(e.target.value) })
                      }
                    />
                    <AmountIncludesTaxField
                      value={line.economics.deliveryTaxMode}
                      disabled={!tracksTax}
                      onChange={(mode) => onEconomicsChange({ deliveryTaxMode: mode })}
                    />
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
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
