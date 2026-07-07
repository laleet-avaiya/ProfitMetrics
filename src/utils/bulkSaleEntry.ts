import { DeliveryMode, PaymentMode, PurchasePaymentStatus, SaleStatus } from '../types';
import type { Product } from '../types';
import { createListingId } from './productDefaults';
import { utcToLocalDateInput } from './firestoreDates';
import {
  economicsFromListing,
  emptySaleCustomerForm,
  emptySaleLineForm,
  getListingsForPlatform,
  resolveProductSaleSelection,
  type SaleFormEconomics,
  type SaleFormState,
  type SaleLineFormState,
} from './saleHelpers';

export interface BulkSaleRowErrors {
  platform?: string;
  productId?: string;
  platformListingId?: string;
  variantId?: string;
}

export type BulkSaleRowStatus = 'draft' | 'saving' | 'saved' | 'error';

export interface BulkSaleRow {
  id: string;
  orderDate: string;
  orderId: string;
  platform: string;
  productId: string;
  variantId: string;
  variantLabel: string;
  platformListingId: string;
  quantity: number;
  customerId: string;
  status: SaleStatus;
  paymentMode: PaymentMode | '';
  notes: string;
  economics: SaleFormEconomics;
  rowStatus: BulkSaleRowStatus;
  savedOrderNumber?: string;
  savedSaleId?: string;
  errors?: BulkSaleRowErrors;
  errorMessage?: string;
}

export function emptyBulkSaleRow(defaultPlatform = ''): BulkSaleRow {
  const line = emptySaleLineForm();
  return {
    id: createListingId(),
    orderDate: utcToLocalDateInput(new Date()),
    orderId: '',
    platform: defaultPlatform,
    productId: '',
    variantId: '',
    variantLabel: '',
    platformListingId: '',
    quantity: 1,
    customerId: '',
    status: SaleStatus.DELIVERED,
    paymentMode: '',
    notes: '',
    economics: line.economics,
    rowStatus: 'draft',
  };
}

export function bulkRowToSaleForm(row: BulkSaleRow): SaleFormState {
  const line: SaleLineFormState = {
    id: createListingId(),
    productId: row.productId,
    variantId: row.variantId,
    variantLabel: row.variantLabel,
    platformListingId: row.platformListingId,
    quantity: Math.max(1, row.quantity),
    economics: row.economics,
  };

  return {
    orderId: row.orderId,
    orderDate: row.orderDate,
    trackingId: '',
    platform: row.platform,
    customer: {
      ...emptySaleCustomerForm(),
      mode: 'existing',
      customerId: row.customerId,
    },
    deliveryMode: DeliveryMode.INDIVIDUAL,
    orderShippingCost: 0,
    orderDeliveryTaxPercentage: row.economics.deliveryTaxPercentage,
    orderDeliveryTaxMode: row.economics.deliveryTaxMode,
    lines: [line],
    status: row.status,
    paymentMode: row.paymentMode,
    paymentStatus: PurchasePaymentStatus.UNPAID,
    returnCharges: 0,
    returnTaxPercentage: 0,
    returnTaxMode: row.economics.deliveryTaxMode,
    returnedAt: '',
    cancellationCharges: 0,
    cancellationTaxPercentage: 0,
    cancellationTaxMode: row.economics.deliveryTaxMode,
    cancelledAt: '',
    notes: row.notes,
  };
}

export function validateBulkSaleRow(
  row: BulkSaleRow,
  products: Product[]
): BulkSaleRowErrors | null {
  const errors: BulkSaleRowErrors = {};

  if (!row.platform.trim()) errors.platform = 'Required';
  if (!row.productId) errors.productId = 'Required';

  const product = products.find((p) => p.id === row.productId);
  const listings =
    product && row.platform.trim()
      ? getListingsForPlatform(product, row.platform)
      : [];

  if (row.productId && listings.length > 1 && !row.platformListingId) {
    errors.platformListingId = 'Required';
  }
  if (
    row.productId &&
    product?.variants &&
    product.variants.length > 0 &&
    !row.variantId
  ) {
    errors.variantId = 'Required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function applyProductToRow(
  row: BulkSaleRow,
  productId: string,
  products: Product[]
): BulkSaleRow {
  const product = products.find((p) => p.id === productId);
  if (!product) {
    return {
      ...row,
      productId,
      platformListingId: '',
      variantId: '',
      variantLabel: '',
    };
  }

  const selection = resolveProductSaleSelection(product, row.platform);

  return {
    ...row,
    productId,
    variantId: '',
    variantLabel: '',
    platformListingId: selection.platformListingId,
    economics: selection.economics,
  };
}

export function applyListingToRow(
  row: BulkSaleRow,
  listingId: string,
  products: Product[]
): BulkSaleRow {
  const product = products.find((p) => p.id === row.productId);
  const listing = product?.platformListings.find((l) => l.id === listingId);
  if (!listing) return row;

  return {
    ...row,
    platformListingId: listing.id,
    economics: economicsFromListing(listing),
  };
}

export function applyVariantToRow(
  row: BulkSaleRow,
  variantId: string,
  products: Product[]
): BulkSaleRow {
  const product = products.find((p) => p.id === row.productId);
  const variant = product?.variants?.find((v) => v.id === variantId);
  if (!variant) {
    return { ...row, variantId: '', variantLabel: '' };
  }

  const nextEconomics = { ...row.economics };
  if (variant.purchasePrice != null) nextEconomics.purchasePrice = variant.purchasePrice;
  if (variant.sellingPrice != null) nextEconomics.sellingPrice = variant.sellingPrice;

  return {
    ...row,
    variantId: variant.id,
    variantLabel: variant.label,
    economics: nextEconomics,
  };
}

export function applyPlatformToRow(row: BulkSaleRow, platform: string): BulkSaleRow {
  return {
    ...row,
    platform,
    productId: '',
    platformListingId: '',
    variantId: '',
    variantLabel: '',
  };
}

export function rowHasData(row: BulkSaleRow): boolean {
  return Boolean(
    row.orderId.trim() ||
      row.productId ||
      row.customerId ||
      row.notes.trim() ||
      row.quantity !== 1
  );
}
