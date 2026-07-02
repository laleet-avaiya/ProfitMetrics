import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Layers, Plus, Trash2 } from 'lucide-react';
import { Input } from '../Input/Input';
import { Textarea } from '../Textarea/Textarea';
import { Select } from '../Select/Select';
import { AmountIncludesTaxField } from '../AmountIncludesTaxField/AmountIncludesTaxField';
import { Button } from '../Button/Button';
import { useNotification } from '../../hooks/useNotification';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { formatMarketplaceSummary } from '../../constants/platforms';
import type { ProductPlatformListing } from '../../types';
import { PlatformFeeKind, TaxType } from '../../types';
import {
  createEmptyListing,
  formValuesToPlatform,
  platformToFormValues,
} from '../../utils/productDefaults';
import {
  normalizeListingTax,
  platformFeeKindOptions,
  resolveListingTax,
  taxPercentLabel,
} from '../../utils/listingTax';
import {
  computeLineEconomics,
  formatMoney,
  formatPercent,
  lineEconomicsInputFromListing,
} from '../../utils/profit';
import { LineEconomicsPreview } from '../LineEconomicsPreview/LineEconomicsPreview';
import { SectionHeading, SectionLinePreview } from '../SectionLinePreview/SectionLinePreview';
import {
  economicsFieldsColumnClass,
  economicsPreviewColumnClass,
  economicsSplitLayoutClass,
} from '../../constants/ui';
import type { Company } from '../../types';

interface ListingFormState extends ProductPlatformListing {
  platformPreset: string;
}

function listingToFormState(listing: ProductPlatformListing): ListingFormState {
  const normalized = normalizeListingTax(listing);
  const { preset } = platformToFormValues(normalized.platform);
  return {
    ...normalized,
    platformPreset: preset,
  };
}

function formStateToListing(state: ListingFormState): ProductPlatformListing {
  const { platformPreset, ...listing } = state;
  return normalizeListingTax({
    ...listing,
    platform: formValuesToPlatform(platformPreset),
  });
}

interface PlatformListingEditorProps {
  listings: ProductPlatformListing[];
  onChange: (listings: ProductPlatformListing[]) => void;
  company: Company | null | undefined;
  currency: string;
  error?: string;
  /** Hide section title when nested inside FormSection */
  embedded?: boolean;
}

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

export function PlatformListingEditor({
  listings,
  onChange,
  company,
  currency,
  error,
  embedded = false,
}: PlatformListingEditorProps) {
  const notification = useNotification();
  const { marketplaces, getProductPlatformOptions } = useCompanyMarketplaces();
  const platformOptions = useMemo(
    () => getProductPlatformOptions(listings.map((listing) => listing.platform)),
    [getProductPlatformOptions, listings]
  );
  const [expandedId, setExpandedId] = useState<string | null>(listings[0]?.id ?? null);
  const formStates = useMemo(
    () => listings.map((listing) => listingToFormState(listing)),
    [listings]
  );

  const updateListings = (next: ListingFormState[]) => {
    onChange(next.map(formStateToListing));
  };

  const updateListing = (id: string, patch: Partial<ListingFormState>) => {
    updateListings(
      formStates.map((listing) => (listing.id === id ? { ...listing, ...patch } : listing))
    );
  };

  const addListing = () => {
    const listing = createEmptyListing(company);
    const next = [...formStates, listingToFormState(listing)];
    updateListings(next);
    setExpandedId(listing.id);
  };

  const removeListing = (id: string) => {
    const next = formStates.filter((l) => l.id !== id);
    updateListings(next);
    if (expandedId === id) {
      setExpandedId(next[0]?.id ?? null);
    }
  };

  const requestRemoveListing = (id: string) => {
    const listing = formStates.find((l) => l.id === id);
    const platformName = listing?.platformPreset.trim() || 'this platform';

    notification.confirm({
      title: 'Remove platform listing?',
      message: `Remove ${platformName}? You will need to save the product for this change to take effect.`,
      confirmLabel: 'Remove',
      onConfirm: () => removeListing(id),
    });
  };

  return (
    <div className="space-y-3">
      {embedded ? (
        formStates.length > 0 ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addListing}>
              <Plus className="w-4 h-4" />
              Add platform
            </Button>
          </div>
        ) : null
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Platform listings</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Set purchase, selling, fee, and delivery tax per marketplace — used when logging sales.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addListing}>
            <Plus className="w-4 h-4" />
            Add platform
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {formStates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 px-4 py-8 flex flex-col items-center text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
            <Layers className="w-5 h-5" aria-hidden />
          </div>
          <div className="space-y-1 max-w-sm">
            <p className="text-sm font-medium text-gray-900 dark:text-white">No platforms yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Add {formatMarketplaceSummary(marketplaces)} when you&apos;re ready — each with its own
              purchase, selling, and tax settings.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Link to="/configuration" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Manage marketplaces
              </Link>
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addListing}>
            <Plus className="w-4 h-4" />
            Add platform
          </Button>
        </div>
      ) : (
      <div className="space-y-2">
        {formStates.map((listing) => {
          const isExpanded = expandedId === listing.id;
          const displayPlatform = listing.platformPreset.trim() || 'New platform';
          const resolved = resolveListingTax(listing);
          const tracksTax = resolved.taxType !== TaxType.NONE;
          const pctLabel = taxPercentLabel(resolved.taxType);
          const preview = computeLineEconomics(lineEconomicsInputFromListing(listing, 1));

          return (
            <div
              key={listing.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100/80 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {displayPlatform}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                    Sell {formatMoney(listing.sellingPrice, currency)} · Profit{' '}
                    {formatMoney(preview.profit, currency)} ({formatPercent(preview.profitMarginPercent)})
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className={economicsSplitLayoutClass}>
                    <div className={economicsFieldsColumnClass}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Select
                          label="Platform"
                          value={listing.platformPreset}
                          options={platformOptions}
                          onChange={(e) =>
                            updateListing(listing.id, {
                              platformPreset: e.target.value as ListingFormState['platformPreset'],
                            })
                          }
                        />
                        <Input
                          label="Platform SKU"
                          value={listing.platformSku ?? ''}
                          onChange={(e) =>
                            updateListing(listing.id, { platformSku: e.target.value })
                          }
                          placeholder="Optional marketplace SKU"
                        />
                        <Input
                          label="Listing URL"
                          type="url"
                          value={listing.listingUrl ?? ''}
                          onChange={(e) =>
                            updateListing(listing.id, { listingUrl: e.target.value })
                          }
                          placeholder="https://"
                        />
                        <Select
                          label="Tax type"
                          value={listing.taxType}
                          options={taxTypeOptions}
                          onChange={(e) =>
                            updateListing(listing.id, {
                              taxType: e.target.value as ProductPlatformListing['taxType'],
                            })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
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
                              value={listing.purchasePrice || ''}
                              onChange={(e) =>
                                updateListing(listing.id, {
                                  purchasePrice: parseNumber(e.target.value),
                                })
                              }
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Input
                                label={pctLabel}
                                type="number"
                                min="0"
                                step="0.01"
                                disabled={!tracksTax}
                                value={resolved.purchaseTaxPercentage || ''}
                                onChange={(e) =>
                                  updateListing(listing.id, {
                                    purchaseTaxPercentage: parseNumber(e.target.value),
                                  })
                                }
                              />
                              <AmountIncludesTaxField
                                value={resolved.purchaseTaxMode}
                                disabled={!tracksTax}
                                onChange={(mode) =>
                                  updateListing(listing.id, { purchaseTaxMode: mode })
                                }
                              />
                            </div>
                          </div>
                          <SectionLinePreview
                            amountLabel="Cost per unit"
                            amount={preview.cogs}
                            taxDirection="credit"
                            taxAmount={preview.purchaseTaxAmount}
                            currency={currency}
                            tracksTax={tracksTax}
                          />
                        </div>

                        <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
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
                              value={listing.sellingPrice || ''}
                              onChange={(e) =>
                                updateListing(listing.id, {
                                  sellingPrice: parseNumber(e.target.value),
                                })
                              }
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Input
                                label={pctLabel}
                                type="number"
                                min="0"
                                step="0.01"
                                disabled={!tracksTax}
                                value={resolved.sellingTaxPercentage || ''}
                                onChange={(e) =>
                                  updateListing(listing.id, {
                                    sellingTaxPercentage: parseNumber(e.target.value),
                                    taxPercentage: parseNumber(e.target.value),
                                  })
                                }
                              />
                              <AmountIncludesTaxField
                                value={resolved.sellingTaxMode}
                                disabled={!tracksTax}
                                onChange={(mode) =>
                                  updateListing(listing.id, {
                                    sellingTaxMode: mode,
                                    taxMode: mode,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <SectionLinePreview
                            amountLabel="Revenue per unit"
                            amount={preview.grossRevenue}
                            taxDirection="debit"
                            taxAmount={preview.taxAmount}
                            currency={currency}
                            tracksTax={tracksTax}
                          />
                        </div>

                        <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
                          <SectionHeading
                            title="Platform fees"
                            description="Marketplace commission — fixed amount or % of selling price."
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Select
                              label="Fee type"
                              value={resolved.platformFeeKind}
                              options={platformFeeKindOptions}
                              onChange={(e) => {
                                const kind = e.target.value as PlatformFeeKind;
                                updateListing(listing.id, {
                                  platformFeeKind: kind,
                                  platformFee:
                                    kind === PlatformFeeKind.FIXED ? listing.platformFee : undefined,
                                  platformFeePercent:
                                    kind === PlatformFeeKind.PERCENT
                                      ? listing.platformFeePercent
                                      : undefined,
                                });
                              }}
                            />
                            {resolved.platformFeeKind === PlatformFeeKind.FIXED ? (
                              <Input
                                label="Platform fee (amount)"
                                type="number"
                                min="0"
                                step="0.01"
                                value={listing.platformFee ?? ''}
                                onChange={(e) =>
                                  updateListing(listing.id, {
                                    platformFee: e.target.value
                                      ? parseNumber(e.target.value)
                                      : undefined,
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
                                value={listing.platformFeePercent ?? ''}
                                onChange={(e) =>
                                  updateListing(listing.id, {
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
                              value={resolved.platformFeeTaxPercentage || ''}
                              onChange={(e) =>
                                updateListing(listing.id, {
                                  platformFeeTaxPercentage: parseNumber(e.target.value),
                                })
                              }
                            />
                            <AmountIncludesTaxField
                              value={resolved.platformFeeTaxMode}
                              disabled={!tracksTax}
                              onChange={(mode) =>
                                updateListing(listing.id, { platformFeeTaxMode: mode })
                              }
                            />
                          </div>
                          <SectionLinePreview
                            amountLabel="Platform fee per unit"
                            amount={preview.platformFees}
                            taxDirection="credit"
                            taxAmount={preview.platformFeeTaxAmount}
                            currency={currency}
                            tracksTax={tracksTax}
                          />
                        </div>

                        <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
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
                              value={listing.shippingCost || ''}
                              onChange={(e) =>
                                updateListing(listing.id, { shippingCost: parseNumber(e.target.value) })
                              }
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Input
                                label={pctLabel}
                                type="number"
                                min="0"
                                step="0.01"
                                disabled={!tracksTax}
                                value={resolved.deliveryTaxPercentage || ''}
                                onChange={(e) =>
                                  updateListing(listing.id, {
                                    deliveryTaxPercentage: parseNumber(e.target.value),
                                  })
                                }
                              />
                              <AmountIncludesTaxField
                                value={resolved.deliveryTaxMode}
                                disabled={!tracksTax}
                                onChange={(mode) =>
                                  updateListing(listing.id, { deliveryTaxMode: mode })
                                }
                              />
                            </div>
                          </div>
                          <SectionLinePreview
                            amountLabel="Delivery cost per unit"
                            amount={preview.shippingTotal}
                            taxDirection="credit"
                            taxAmount={preview.deliveryTaxAmount}
                            currency={currency}
                            tracksTax={tracksTax}
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40 p-3">
                        <Textarea
                          label="Listing notes"
                          optional
                          value={listing.notes ?? ''}
                          onChange={(e) => updateListing(listing.id, { notes: e.target.value })}
                          helperText="Platform-specific reminders — fee changes, listing quirks, etc."
                          placeholder="e.g. FBA fee updated Q2, slow-moving SKU…"
                          rows={2}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => requestRemoveListing(listing.id)}
                          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </Button>
                      </div>

                      <div className="xl:hidden">
                        <LineEconomicsPreview
                          title="Per-unit profit"
                          preview={preview}
                          currency={currency}
                          tracksTax={tracksTax}
                        />
                      </div>
                    </div>

                    <div className={`hidden xl:block ${economicsPreviewColumnClass}`}>
                      <LineEconomicsPreview
                        title="Per-unit profit"
                        preview={preview}
                        currency={currency}
                        tracksTax={tracksTax}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
