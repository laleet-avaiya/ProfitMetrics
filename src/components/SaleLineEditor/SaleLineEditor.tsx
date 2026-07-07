import { ChevronDown, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AmountIncludesTaxField } from '../AmountIncludesTaxField/AmountIncludesTaxField';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { SearchableSelect } from '../SearchableSelect/SearchableSelect';
import { SectionHeading, SectionLinePreview } from '../SectionLinePreview/SectionLinePreview';
import type { Product, TaxMode } from '../../types';
import { DeliveryMode, PlatformFeeKind, TaxMode as TaxModeEnum, TaxType } from '../../types';
import { platformFeeKindOptions, taxPercentLabel } from '../../utils/listingTax';
import {
  autoTaxPerUnit,
  economicsFromListing,
  getListingsForPlatform,
  resolveProductSaleSelection,
  syncPurchaseTaxDefaults,
  type SaleFormEconomics,
  type SaleFormState,
  type SaleLineFormState,
} from '../../utils/saleHelpers';
import { computeLineEconomics, formatMoney } from '../../utils/profit';
import { selectControlClass, spreadsheetMoneyControlClass, spreadsheetNumberControlClass, spreadsheetQtyControlClass, spreadsheetSelectControlClass, tableCellClass, tableInputControlClass } from '../../constants/ui';

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

function mergeEconomicsPatch(
  current: SaleFormEconomics,
  patch: Partial<SaleFormEconomics>
): Partial<SaleFormEconomics> {
  const touchesSellingTax =
    patch.sellingTaxPercentage !== undefined ||
    patch.sellingTaxMode !== undefined ||
    patch.taxType !== undefined ||
    patch.taxMode !== undefined;
  const userSetPurchaseTax =
    patch.purchaseTaxPercentage !== undefined || patch.purchaseTaxMode !== undefined;

  if (!touchesSellingTax || userSetPurchaseTax) return patch;

  const synced = syncPurchaseTaxDefaults({ ...current, ...patch });
  return {
    ...patch,
    purchaseTaxPercentage: synced.purchaseTaxPercentage,
    purchaseTaxMode: synced.purchaseTaxMode,
  };
}

interface SaleLineEditorProps {
  line: SaleLineFormState;
  index: number;
  platform: string;
  deliveryMode: SaleFormState['deliveryMode'];
  products: Product[];
  currency: string;
  canRemove: boolean;
  errors?: { productId?: string; platformListingId?: string; variantId?: string };
  onChange: (patch: Partial<SaleLineFormState>) => void;
  onEconomicsChange: (patch: Partial<SaleFormEconomics>) => void;
  onRemove: () => void;
  layout?: 'card' | 'table' | 'spreadsheet';
  /** Product IDs already chosen on other lines — hidden from this row's picker. */
  usedProductIds?: string[];
}

function CompactTaxModeSelect({
  value,
  disabled,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: TaxMode;
  disabled?: boolean;
  onChange: (mode: TaxMode) => void;
  'aria-label'?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as TaxMode)}
      className={`${spreadsheetSelectControlClass} min-w-[6.5rem]`}
      aria-label={ariaLabel ?? 'Tax mode'}
    >
      <option value={TaxModeEnum.INCLUSIVE}>Inclusive</option>
      <option value={TaxModeEnum.EXCLUSIVE}>Exclusive</option>
    </select>
  );
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
  layout = 'card',
  usedProductIds = [],
}: SaleLineEditorProps) {
  const [expanded, setExpanded] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === line.productId) ?? null,
    [products, line.productId]
  );

  const platformListings = useMemo(() => {
    if (!selectedProduct || !platform.trim()) return [];
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

  const variantOptions = useMemo(() => {
    const variants = selectedProduct?.variants ?? [];
    if (variants.length === 0) return [];
    return [
      { value: '', label: 'Select variant…' },
      ...variants.map((v) => ({ value: v.id, label: v.label })),
    ];
  }, [selectedProduct]);
  const hasVariants = variantOptions.length > 0;

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
  const patchEconomics = (patch: Partial<SaleFormEconomics>) => {
    onEconomicsChange(mergeEconomicsPatch(line.economics, patch));
  };
  const feeKind = line.economics.platformFeeKind ?? PlatformFeeKind.FIXED;
  const displayedTaxPerUnit = line.economics.taxAmountManual
    ? (line.economics.taxAmountPerUnit ?? 0)
    : autoTaxPerUnit(line.economics);

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      onChange({ productId, platformListingId: '', variantId: '', variantLabel: '' });
      return;
    }
    const selection = resolveProductSaleSelection(product, platform);
    onChange({
      productId,
      variantId: '',
      variantLabel: '',
      platformListingId: selection.platformListingId,
      economics: selection.economics,
    });
  };

  const handleVariantChange = (variantId: string) => {
    const variant = selectedProduct?.variants?.find((v) => v.id === variantId);
    if (!variant) {
      onChange({ variantId: '', variantLabel: '' });
      return;
    }
    const nextEconomics = { ...line.economics };
    if (variant.purchasePrice != null) nextEconomics.purchasePrice = variant.purchasePrice;
    if (variant.sellingPrice != null) nextEconomics.sellingPrice = variant.sellingPrice;
    onChange({ variantId: variant.id, variantLabel: variant.label, economics: nextEconomics });
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

  const productOptions = useMemo(() => {
    const used = new Set(usedProductIds.filter((id) => id && id !== line.productId));
    return [
      { value: '', label: 'Select product…' },
      ...products
        .filter((p) => !used.has(p.id))
        .map((p) => ({
          value: p.id,
          label: p.sku ? `${p.name} (${p.sku})` : p.name,
        })),
    ];
  }, [products, usedProductIds, line.productId]);

  const advancedFields = (
    <div className="space-y-3">
      <Select
        label="Tax type"
        value={line.economics.taxType}
        options={taxTypeOptions}
        onChange={(e) =>
          patchEconomics({
            taxType: e.target.value as SaleFormEconomics['taxType'],
          })
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-2 rounded-md border border-gray-200/80 dark:border-gray-700/80 p-2.5">
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
                patchEconomics({ purchaseTaxPercentage: parseNumber(e.target.value) })
              }
            />
            <AmountIncludesTaxField
              value={line.economics.purchaseTaxMode}
              disabled={!tracksTax}
              onChange={(mode) => patchEconomics({ purchaseTaxMode: mode })}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-gray-200/80 dark:border-gray-700/80 p-2.5">
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
                patchEconomics({ sellingTaxPercentage: parseNumber(e.target.value) })
              }
            />
            <AmountIncludesTaxField
              value={line.economics.sellingTaxMode}
              disabled={!tracksTax}
              onChange={(mode) =>
                patchEconomics({ sellingTaxMode: mode, taxMode: mode })
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
              patchEconomics({
                taxAmountPerUnit: parseNumber(e.target.value),
                taxAmountManual: true,
              })
            }
          />
        </div>

        <div className="space-y-2 rounded-md border border-gray-200/80 dark:border-gray-700/80 p-2.5">
          <SectionHeading title="Platform fee" />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Fee type"
              value={feeKind}
              options={platformFeeKindOptions}
              onChange={(e) => {
                const kind = e.target.value as PlatformFeeKind;
                patchEconomics({
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
                  patchEconomics({
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
                  patchEconomics({
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
      </div>

      {deliveryMode === DeliveryMode.INDIVIDUAL ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border border-gray-200/80 dark:border-gray-700/80 p-2.5">
          <SectionHeading title="Item delivery" description="Per-unit shipping." />
          <Input
            label="Delivery / unit"
            type="number"
            min="0"
            step="0.01"
            value={line.economics.shippingCost || ''}
            onChange={(e) => patchEconomics({ shippingCost: parseNumber(e.target.value) })}
          />
          <Input
            label={pctLabel}
            type="number"
            min="0"
            step="0.01"
            disabled={!tracksTax}
            value={line.economics.deliveryTaxPercentage || ''}
            onChange={(e) =>
              patchEconomics({ deliveryTaxPercentage: parseNumber(e.target.value) })
            }
          />
          <AmountIncludesTaxField
            value={line.economics.deliveryTaxMode}
            disabled={!tracksTax}
            onChange={(mode) => patchEconomics({ deliveryTaxMode: mode })}
          />
        </div>
      ) : null}
    </div>
  );

  if (layout === 'spreadsheet') {
    const profitClass =
      linePreview.profit >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';
    const isIndividualDelivery = deliveryMode === DeliveryMode.INDIVIDUAL;

    return (
      <tr className="border-t border-gray-100 dark:border-gray-700/80 hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
        <td className={`${tableCellClass} w-10 text-xs text-gray-500 tabular-nums text-center`}>
          {index + 1}
        </td>
        <td className={`${tableCellClass} min-w-[18rem]`}>
          <SearchableSelect
            options={productOptions}
            value={line.productId}
            onChange={(e) => handleProductChange(e.target.value)}
            disabled={!platform}
            placeholder="Product…"
            menuMinWidth={320}
            controlClassName={`${spreadsheetSelectControlClass} min-w-[17rem] ${errors?.productId ? 'border-red-500' : ''}`}
          />
        </td>
        <td className={`${tableCellClass} min-w-[12rem]`}>
          {hasVariants ? (
            <SearchableSelect
              options={variantOptions}
              value={line.variantId}
              onChange={(e) => handleVariantChange(e.target.value)}
              disabled={!selectedProduct}
              placeholder="Variant…"
              menuMinWidth={260}
              controlClassName={`${spreadsheetSelectControlClass} min-w-[11rem] ${errors?.variantId ? 'border-red-500' : ''}`}
            />
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
        <td className={`${tableCellClass} min-w-[12rem]`}>
          {showListingSelect ? (
            <SearchableSelect
              options={[{ value: '', label: 'Listing…' }, ...listingOptions]}
              value={line.platformListingId}
              onChange={(e) => handleListingChange(e.target.value)}
              disabled={!selectedProduct}
              placeholder="Listing…"
              menuMinWidth={260}
              controlClassName={`${spreadsheetSelectControlClass} min-w-[11rem] ${errors?.platformListingId ? 'border-red-500' : ''}`}
            />
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
        <td className={`${tableCellClass} min-w-[5rem]`}>
          <input
            type="number"
            min="1"
            step="1"
            value={line.quantity || ''}
            onChange={(e) =>
              onChange({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
            }
            className={spreadsheetQtyControlClass}
            aria-label="Quantity"
          />
        </td>
        <td className={`${tableCellClass} min-w-[7.5rem]`}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.economics.purchasePrice || ''}
            onChange={(e) =>
              patchEconomics({ purchasePrice: parseNumber(e.target.value) })
            }
            className={spreadsheetMoneyControlClass}
            aria-label="Cost"
          />
        </td>
        <td className={`${tableCellClass} min-w-[7.5rem]`}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.economics.sellingPrice || ''}
            onChange={(e) =>
              patchEconomics({ sellingPrice: parseNumber(e.target.value) })
            }
            className={spreadsheetMoneyControlClass}
            aria-label="Selling price"
          />
        </td>
        <td className={`${tableCellClass} min-w-[7.5rem]`}>
          <select
            value={line.economics.taxType}
            onChange={(e) =>
              patchEconomics({
                taxType: e.target.value as SaleFormEconomics['taxType'],
              })
            }
            className={spreadsheetSelectControlClass}
            aria-label="Tax type"
          >
            {taxTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </td>
        <td className={`${tableCellClass} min-w-[6rem]`}>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!tracksTax}
            value={line.economics.purchaseTaxPercentage || ''}
            onChange={(e) =>
              patchEconomics({ purchaseTaxPercentage: parseNumber(e.target.value) })
            }
            className={spreadsheetNumberControlClass}
            aria-label="Input tax percent"
          />
        </td>
        <td className={`${tableCellClass} min-w-[6.5rem]`}>
          <CompactTaxModeSelect
            value={line.economics.purchaseTaxMode}
            disabled={!tracksTax}
            onChange={(mode) => patchEconomics({ purchaseTaxMode: mode })}
            aria-label="Input tax mode"
          />
        </td>
        <td className={`${tableCellClass} min-w-[6rem]`}>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!tracksTax}
            value={line.economics.sellingTaxPercentage || ''}
            onChange={(e) =>
              patchEconomics({ sellingTaxPercentage: parseNumber(e.target.value) })
            }
            className={spreadsheetNumberControlClass}
            aria-label="Output tax percent"
          />
        </td>
        <td className={`${tableCellClass} min-w-[6.5rem]`}>
          <CompactTaxModeSelect
            value={line.economics.sellingTaxMode}
            disabled={!tracksTax}
            onChange={(mode) =>
              patchEconomics({ sellingTaxMode: mode, taxMode: mode })
            }
            aria-label="Output tax mode"
          />
        </td>
        <td className={`${tableCellClass} min-w-[7.5rem]`}>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!tracksTax}
            value={displayedTaxPerUnit || ''}
            onChange={(e) =>
              patchEconomics({
                taxAmountPerUnit: parseNumber(e.target.value),
                taxAmountManual: true,
              })
            }
            className={spreadsheetMoneyControlClass}
            aria-label="Output tax per unit"
          />
        </td>
        <td className={`${tableCellClass} min-w-[8.5rem]`}>
          <select
            value={feeKind}
            onChange={(e) => {
              const kind = e.target.value as PlatformFeeKind;
              patchEconomics({
                platformFeeKind: kind,
                platformFee:
                  kind === PlatformFeeKind.FIXED ? line.economics.platformFee : undefined,
                platformFeePercent:
                  kind === PlatformFeeKind.PERCENT
                    ? line.economics.platformFeePercent
                    : undefined,
              });
            }}
            className={spreadsheetSelectControlClass}
            aria-label="Platform fee type"
          >
            {platformFeeKindOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </td>
        <td className={`${tableCellClass} min-w-[7.5rem]`}>
          {feeKind === PlatformFeeKind.FIXED ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.economics.platformFee ?? ''}
              onChange={(e) =>
                patchEconomics({
                  platformFee: e.target.value ? parseNumber(e.target.value) : undefined,
                  platformFeePercent: undefined,
                })
              }
              className={spreadsheetMoneyControlClass}
              aria-label="Platform fee amount"
            />
          ) : (
            <input
              type="number"
              min="0"
              step="0.1"
              value={line.economics.platformFeePercent ?? ''}
              onChange={(e) =>
                patchEconomics({
                  platformFeePercent: e.target.value
                    ? parseNumber(e.target.value)
                    : undefined,
                  platformFee: undefined,
                })
              }
              className={spreadsheetNumberControlClass}
              aria-label="Platform fee percent"
            />
          )}
        </td>
        <td className={`${tableCellClass} min-w-[7.5rem]`}>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!isIndividualDelivery}
            value={line.economics.shippingCost || ''}
            onChange={(e) => patchEconomics({ shippingCost: parseNumber(e.target.value) })}
            className={spreadsheetMoneyControlClass}
            aria-label="Delivery per unit"
          />
        </td>
        <td className={`${tableCellClass} min-w-[6rem]`}>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!tracksTax || !isIndividualDelivery}
            value={line.economics.deliveryTaxPercentage || ''}
            onChange={(e) =>
              patchEconomics({ deliveryTaxPercentage: parseNumber(e.target.value) })
            }
            className={spreadsheetNumberControlClass}
            aria-label="Delivery tax percent"
          />
        </td>
        <td className={`${tableCellClass} min-w-[6.5rem]`}>
          <CompactTaxModeSelect
            value={line.economics.deliveryTaxMode}
            disabled={!tracksTax || !isIndividualDelivery}
            onChange={(mode) => patchEconomics({ deliveryTaxMode: mode })}
            aria-label="Delivery tax mode"
          />
        </td>
        <td
          className={`${tableCellClass} w-24 text-right text-xs font-semibold tabular-nums ${profitClass}`}
        >
          {line.productId ? formatMoney(linePreview.profit, currency) : '—'}
        </td>
        <td className={`${tableCellClass} w-12 text-center`}>
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
        </td>
      </tr>
    );
  }

  if (layout === 'table') {
    const profitClass =
      linePreview.profit >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';

    return (
      <>
        <tr className="border-t border-gray-100 dark:border-gray-700/80 hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
          <td className={`${tableCellClass} w-8 text-xs text-gray-500 tabular-nums`}>{index + 1}</td>
          <td className={`${tableCellClass} min-w-[10rem] max-w-[14rem]`}>
            <SearchableSelect
              options={productOptions}
              value={line.productId}
              onChange={(e) => handleProductChange(e.target.value)}
              disabled={!platform}
              placeholder="Product…"
              controlClassName={`${selectControlClass} h-8 px-2 ${errors?.productId ? 'border-red-500' : ''}`}
            />
            {errors?.productId ? (
              <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{errors.productId}</p>
            ) : null}
            {showListingSelect ? (
              <div className="mt-1">
                <SearchableSelect
                  options={[{ value: '', label: 'Listing…' }, ...listingOptions]}
                  value={line.platformListingId}
                  onChange={(e) => handleListingChange(e.target.value)}
                  disabled={!selectedProduct}
                  placeholder="Listing…"
                  controlClassName={`${selectControlClass} h-8 px-2 ${errors?.platformListingId ? 'border-red-500' : ''}`}
                />
              </div>
            ) : null}
            {hasVariants ? (
              <div className="mt-1">
                <SearchableSelect
                  options={variantOptions}
                  value={line.variantId}
                  onChange={(e) => handleVariantChange(e.target.value)}
                  disabled={!selectedProduct}
                  placeholder="Variant…"
                  controlClassName={`${selectControlClass} h-8 px-2 ${errors?.variantId ? 'border-red-500' : ''}`}
                />
                {errors?.variantId ? (
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{errors.variantId}</p>
                ) : null}
              </div>
            ) : null}
          </td>
          <td className={`${tableCellClass} w-16`}>
            <input
              type="number"
              min="1"
              step="1"
              value={line.quantity || ''}
              onChange={(e) =>
                onChange({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
              className={tableInputControlClass}
            />
          </td>
          <td className={`${tableCellClass} w-24`}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.economics.purchasePrice || ''}
              onChange={(e) =>
                patchEconomics({ purchasePrice: parseNumber(e.target.value) })
              }
              className={tableInputControlClass}
            />
          </td>
          <td className={`${tableCellClass} w-24`}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.economics.sellingPrice || ''}
              onChange={(e) =>
                patchEconomics({ sellingPrice: parseNumber(e.target.value) })
              }
              className={tableInputControlClass}
            />
          </td>
          <td className={`${tableCellClass} w-24 text-right text-xs font-semibold tabular-nums ${profitClass}`}>
            {line.productId ? formatMoney(linePreview.profit, currency) : '—'}
          </td>
          <td className={`${tableCellClass} w-20`}>
            <div className="flex items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={expanded ? 'Hide tax and fees' : 'Show tax and fees'}
                title="Tax & fees"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
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
          </td>
        </tr>
        {expanded ? (
          <tr className="bg-gray-50/80 dark:bg-gray-900/30">
            <td colSpan={7} className="px-3 py-3">
              {advancedFields}
            </td>
          </tr>
        ) : null}
      </>
    );
  }

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
              <span
                className={
                  linePreview.profit >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
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
            Select a marketplace in the Order tab first.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem]">
          <Select
            label="Product"
            value={line.productId}
            options={productOptions}
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

        {hasVariants ? (
          <Select
            label="Variant"
            value={line.variantId}
            options={variantOptions}
            onChange={(e) => handleVariantChange(e.target.value)}
            error={errors?.variantId}
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
              patchEconomics({ purchasePrice: parseNumber(e.target.value) })
            }
          />
          <Input
            label="Selling"
            type="number"
            min="0"
            step="0.01"
            value={line.economics.sellingPrice || ''}
            onChange={(e) =>
              patchEconomics({ sellingPrice: parseNumber(e.target.value) })
            }
          />
        </div>

        <details className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/20">
          <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">
            <span>Tax, platform fees & delivery</span>
            <ChevronDown className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180 shrink-0" />
          </summary>
          <div className="px-3 pb-3 pt-1 border-t border-gray-200/80 dark:border-gray-700/80">
            {advancedFields}
          </div>
        </details>
      </div>
    </div>
  );
}
