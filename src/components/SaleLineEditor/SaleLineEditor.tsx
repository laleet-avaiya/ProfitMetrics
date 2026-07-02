import { ChevronDown, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { AmountIncludesTaxField } from '../AmountIncludesTaxField/AmountIncludesTaxField';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { SectionHeading, SectionLinePreview } from '../SectionLinePreview/SectionLinePreview';
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
import { computeLineEconomics, formatMoney } from '../../utils/profit';

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
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === line.productId) ?? null,
    [products, line.productId]
  );

  const platformListings = useMemo(() => {
    if (!selectedProduct || !platform) return [];
    return getListingsForPlatform(selectedProduct, platform);
  }, [selectedProduct, platform]);

  const listingOptions = useMemo(
    () =>
      platformListings.map((l) => ({
        value: l.id,
        label: l.platformSku ? l.platformSku : l.platform,
      })),
    [platformListings]
  );

  const showListingSelect = platformListings.length > 1;

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

  const productLabel = selectedProduct
    ? selectedProduct.sku
      ? `${selectedProduct.name} (${selectedProduct.sku})`
      : selectedProduct.name
    : null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-900/30">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Item {index + 1}
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {productLabel ?? 'Choose a product'}
          </p>
          {line.productId ? (
            <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400 mt-0.5">
              {formatMoney(linePreview.grossRevenue, currency)} revenue ·{' '}
              <span className={linePreview.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                {formatMoney(linePreview.profit, currency)} profit
              </span>
            </p>
          ) : null}
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
            aria-label="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <div className="p-3 space-y-3">
        {!platform ? (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            Select a marketplace above before adding products.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem]">
          <Select
            label="Product"
            value={line.productId}
            options={[
              { value: '', label: 'Select product…' },
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

        {showListingSelect ? (
          <Select
            label="Listing"
            value={line.platformListingId}
            options={[{ value: '', label: 'Select listing…' }, ...listingOptions]}
            onChange={(e) => handleListingChange(e.target.value)}
            error={errors?.platformListingId}
            disabled={!selectedProduct}
            required
          />
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Purchase"
            type="number"
            min="0"
            step="0.01"
            value={line.economics.purchasePrice || ''}
            onChange={(e) =>
              onEconomicsChange({ purchasePrice: parseNumber(e.target.value) })
            }
          />
          <Input
            label="Selling"
            type="number"
            min="0"
            step="0.01"
            value={line.economics.sellingPrice || ''}
            onChange={(e) =>
              onEconomicsChange({ sellingPrice: parseNumber(e.target.value) })
            }
          />
        </div>

        <details className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/20">
          <summary className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">
            <span>Tax, platform fees & delivery</span>
            <ChevronDown className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180 shrink-0" />
          </summary>
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200/80 dark:border-gray-700/80">
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

            <div className="space-y-3 rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-800/40 p-3">
              <SectionHeading title="Purchase tax" />
              <div className="grid grid-cols-2 gap-2">
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
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-800/40 p-3">
              <SectionHeading title="Selling tax" />
              <div className="grid grid-cols-2 gap-2">
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
                label="Output tax / unit"
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
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-800/40 p-3">
              <SectionHeading title="Platform fee" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    label="Fee amount"
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
                    label="Fee %"
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
                amountLabel="Platform fee / unit"
                amount={linePreview.platformFees / Math.max(1, line.quantity)}
                taxDirection="credit"
                taxAmount={linePreview.platformFeeTaxAmount / Math.max(1, line.quantity)}
                currency={currency}
                tracksTax={tracksTax}
              />
            </div>

            {deliveryMode === DeliveryMode.INDIVIDUAL ? (
              <div className="space-y-3 rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-800/40 p-3">
                <SectionHeading title="Item delivery" description="Per-unit shipping for this line." />
                <Input
                  label="Delivery / unit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.economics.shippingCost || ''}
                  onChange={(e) =>
                    onEconomicsChange({ shippingCost: parseNumber(e.target.value) })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
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
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
