import type {
  Product,
  ProductVariant,
  ProductVariantOption,
  ProductVariantOptionValue,
} from '../types';
import { createListingId } from './productDefaults';

/**
 * The stock key uniquely identifies an inventory bucket. Single-SKU products
 * use their productId (unchanged, backward compatible). Variant products use a
 * composite productId + variantId key so each variant tracks stock separately.
 */
export function stockKey(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}__${variantId}` : productId;
}

/** Whether a product tracks variants (has at least one generated variant). */
export function productHasVariants(product: Product | null | undefined): boolean {
  return Boolean(product?.variants && product.variants.length > 0);
}

/** Find a variant on a product by id. */
export function findVariant(
  product: Product | null | undefined,
  variantId: string | null | undefined
): ProductVariant | undefined {
  if (!product?.variants || !variantId) return undefined;
  return product.variants.find((v) => v.id === variantId);
}

/** Stable signature for a combination of option values, order-independent. */
export function variantSignature(optionValues: ProductVariantOptionValue[]): string {
  return [...optionValues]
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map((ov) => `${ov.optionId}:${ov.value}`)
    .join('|');
}

/** Build a human label like "Red / M" from a combination in option order. */
export function variantLabelFromOptions(
  options: ProductVariantOption[],
  optionValues: ProductVariantOptionValue[]
): string {
  return options
    .map((opt) => optionValues.find((ov) => ov.optionId === opt.id)?.value)
    .filter((v): v is string => Boolean(v))
    .join(' / ');
}

/** Options with a name and at least one non-empty value, cleaned up. */
export function sanitizeVariantOptions(
  options: ProductVariantOption[]
): ProductVariantOption[] {
  return options
    .map((opt) => ({
      ...opt,
      name: opt.name.trim(),
      values: opt.values.map((v) => v.trim()).filter((v, i, arr) => v && arr.indexOf(v) === i),
    }))
    .filter((opt) => opt.name.length > 0 && opt.values.length > 0);
}

/**
 * Generate the cartesian product of all option values into concrete variants.
 * Existing variants are matched by signature to preserve their id, sku, and
 * pricing (and therefore their stock, which is keyed by variant id).
 */
export function generateVariants(
  options: ProductVariantOption[],
  existing: ProductVariant[] = []
): ProductVariant[] {
  const clean = sanitizeVariantOptions(options);
  if (clean.length === 0) return [];

  const existingBySignature = new Map(
    existing.map((v) => [variantSignature(v.optionValues), v])
  );

  // Cartesian product across option axes.
  let combos: ProductVariantOptionValue[][] = [[]];
  for (const opt of clean) {
    const next: ProductVariantOptionValue[][] = [];
    for (const combo of combos) {
      for (const value of opt.values) {
        next.push([...combo, { optionId: opt.id, value }]);
      }
    }
    combos = next;
  }

  return combos.map((optionValues) => {
    const signature = variantSignature(optionValues);
    const prev = existingBySignature.get(signature);
    const label = variantLabelFromOptions(clean, optionValues);
    return {
      id: prev?.id ?? createListingId(),
      label,
      optionValues,
      sku: prev?.sku,
      purchasePrice: prev?.purchasePrice,
      sellingPrice: prev?.sellingPrice,
      status: prev?.status ?? 'active',
    };
  });
}

export function createEmptyVariantOption(): ProductVariantOption {
  return { id: createListingId(), name: '', values: [] };
}
