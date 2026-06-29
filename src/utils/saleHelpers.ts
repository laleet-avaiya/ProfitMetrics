import type { Product, ProductPlatformListing, Sale, SaleLineEconomics, SaleStatus } from '../types';
import { PlatformFeeKind, SaleStatus as SaleStatusEnum, TaxMode, TaxType } from '../types';
import { normalizeSaleStatus } from '../constants/saleStatuses';
import { resolveListingTax } from './listingTax';
import {
  computeLineEconomics,
  computeTaxAmount,
  computeTaxBase,
  type LineEconomicsResult,
} from './profit';
import { createListingId } from './productDefaults';
import { localDateInputToUtc, nowUtc, utcToLocalDateInput } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface SaleFormEconomics {
  purchasePrice: number;
  sellingPrice: number;
  shippingCost: number;
  platformFee?: number;
  platformFeePercent?: number;
  platformFeeKind?: PlatformFeeKind;
  taxType: SaleLineEconomics['taxType'];
  taxPercentage: number;
  taxMode: SaleLineEconomics['taxMode'];
  purchaseTaxPercentage: number;
  purchaseTaxMode: TaxMode;
  sellingTaxPercentage: number;
  sellingTaxMode: TaxMode;
  deliveryTaxPercentage: number;
  deliveryTaxMode: TaxMode;
  platformFeeTaxPercentage: number;
  platformFeeTaxMode: TaxMode;
  /** Per-unit output tax when manually overridden */
  taxAmountPerUnit?: number;
  taxAmountManual: boolean;
}

export interface SaleFormState {
  orderId: string;
  orderDate: string;
  trackingId: string;
  productId: string;
  platformListingId: string;
  quantity: number;
  status: SaleStatus;
  returnCharges: number;
  returnTaxPercentage: number;
  returnTaxMode: TaxMode;
  returnedAt: string;
  cancellationCharges: number;
  cancellationTaxPercentage: number;
  cancellationTaxMode: TaxMode;
  cancelledAt: string;
  economics: SaleFormEconomics;
  notes: string;
}

export interface OutcomeChargeBreakdown {
  grossAmount: number;
  base: number;
  tax: number;
  total: number;
}

export interface SalePreviewResult extends LineEconomicsResult {
  returnOutcome: OutcomeChargeBreakdown;
  cancellationOutcome: OutcomeChargeBreakdown;
}

function defaultEconomics(): SaleFormEconomics {
  return {
    purchasePrice: 0,
    sellingPrice: 0,
    shippingCost: 0,
    platformFeeKind: PlatformFeeKind.FIXED,
    taxType: TaxType.NONE,
    taxPercentage: 0,
    taxMode: TaxMode.INCLUSIVE,
    purchaseTaxPercentage: 0,
    purchaseTaxMode: TaxMode.INCLUSIVE,
    sellingTaxPercentage: 0,
    sellingTaxMode: TaxMode.INCLUSIVE,
    deliveryTaxPercentage: 0,
    deliveryTaxMode: TaxMode.INCLUSIVE,
    platformFeeTaxPercentage: 0,
    platformFeeTaxMode: TaxMode.INCLUSIVE,
    taxAmountManual: false,
  };
}

function emptyOutcomeChargeBreakdown(): OutcomeChargeBreakdown {
  return { grossAmount: 0, base: 0, tax: 0, total: 0 };
}

export function computeOutcomeChargeBreakdown(
  amount: number,
  taxPercentage: number,
  taxMode: TaxMode,
  tracksTax: boolean
): OutcomeChargeBreakdown {
  const grossAmount = Math.max(0, amount);
  if (grossAmount <= 0) return emptyOutcomeChargeBreakdown();
  if (!tracksTax) {
    return { grossAmount, base: grossAmount, tax: 0, total: grossAmount };
  }
  const tax = computeTaxAmount(grossAmount, taxPercentage, taxMode);
  const base = computeTaxBase(grossAmount, taxPercentage, taxMode);
  return {
    grossAmount,
    base,
    tax,
    total: roundMoney(base + tax),
  };
}

export function emptySaleForm(): SaleFormState {
  return {
    orderId: '',
    orderDate: utcToLocalDateInput(new Date()),
    trackingId: '',
    productId: '',
    platformListingId: '',
    quantity: 1,
    status: SaleStatusEnum.DELIVERED,
    returnCharges: 0,
    returnTaxPercentage: 0,
    returnTaxMode: TaxMode.INCLUSIVE,
    returnedAt: '',
    cancellationCharges: 0,
    cancellationTaxPercentage: 0,
    cancellationTaxMode: TaxMode.INCLUSIVE,
    cancelledAt: '',
    economics: defaultEconomics(),
    notes: '',
  };
}

export function economicsFromListing(listing: ProductPlatformListing): SaleFormEconomics {
  const resolved = resolveListingTax(listing);
  return {
    purchasePrice: listing.purchasePrice,
    sellingPrice: listing.sellingPrice,
    shippingCost: listing.shippingCost,
    platformFee: listing.platformFee,
    platformFeePercent: listing.platformFeePercent,
    platformFeeKind: resolved.platformFeeKind,
    taxType: resolved.taxType,
    taxPercentage: resolved.sellingTaxPercentage,
    taxMode: resolved.sellingTaxMode,
    purchaseTaxPercentage: resolved.purchaseTaxPercentage,
    purchaseTaxMode: resolved.purchaseTaxMode,
    sellingTaxPercentage: resolved.sellingTaxPercentage,
    sellingTaxMode: resolved.sellingTaxMode,
    deliveryTaxPercentage: resolved.deliveryTaxPercentage,
    deliveryTaxMode: resolved.deliveryTaxMode,
    platformFeeTaxPercentage: resolved.platformFeeTaxPercentage,
    platformFeeTaxMode: resolved.platformFeeTaxMode,
    taxAmountManual: false,
  };
}

function economicsFromSaleRecord(economics: SaleLineEconomics, qty: number): SaleFormEconomics {
  const resolved = resolveListingTax({
    id: '',
    platform: '',
    purchasePrice: economics.purchasePrice,
    sellingPrice: economics.sellingPrice,
    shippingCost: economics.shippingCost,
    platformFee: economics.platformFee,
    platformFeePercent: economics.platformFeePercent,
    platformFeeKind: economics.platformFeeKind,
    taxType: economics.taxType,
    taxPercentage: economics.taxPercentage,
    taxMode: economics.taxMode,
    purchaseTaxPercentage: economics.purchaseTaxPercentage,
    purchaseTaxMode: economics.purchaseTaxMode,
    sellingTaxPercentage: economics.sellingTaxPercentage,
    sellingTaxMode: economics.sellingTaxMode,
    deliveryTaxPercentage: economics.deliveryTaxPercentage,
    deliveryTaxMode: economics.deliveryTaxMode,
    platformFeeTaxPercentage: economics.platformFeeTaxPercentage,
    platformFeeTaxMode: economics.platformFeeTaxMode,
  });

  return {
    purchasePrice: economics.purchasePrice,
    sellingPrice: economics.sellingPrice,
    shippingCost: economics.shippingCost,
    platformFee: economics.platformFee,
    platformFeePercent: economics.platformFeePercent,
    platformFeeKind: resolved.platformFeeKind,
    taxType: resolved.taxType,
    taxPercentage: resolved.sellingTaxPercentage,
    taxMode: resolved.sellingTaxMode,
    purchaseTaxPercentage: resolved.purchaseTaxPercentage,
    purchaseTaxMode: resolved.purchaseTaxMode,
    sellingTaxPercentage: resolved.sellingTaxPercentage,
    sellingTaxMode: resolved.sellingTaxMode,
    deliveryTaxPercentage: resolved.deliveryTaxPercentage,
    deliveryTaxMode: resolved.deliveryTaxMode,
    platformFeeTaxPercentage: resolved.platformFeeTaxPercentage,
    platformFeeTaxMode: resolved.platformFeeTaxMode,
    taxAmountPerUnit: economics.taxAmount / qty,
    taxAmountManual: true,
  };
}

export function saleToForm(sale: Sale): SaleFormState {
  const qty = Math.max(1, sale.quantity);
  const status = normalizeSaleStatus(sale.status);
  const economics = economicsFromSaleRecord(sale.economics, qty);

  return {
    orderId: sale.orderId,
    orderDate: utcToLocalDateInput(sale.orderDate),
    trackingId: sale.trackingId ?? '',
    productId: sale.productId,
    platformListingId: sale.platformListingId ?? '',
    quantity: sale.quantity,
    status,
    returnCharges: sale.returnCharges ?? 0,
    returnTaxPercentage: sale.returnTaxPercentage ?? economics.deliveryTaxPercentage,
    returnTaxMode: sale.returnTaxMode ?? economics.deliveryTaxMode,
    returnedAt: sale.returnedAt ? utcToLocalDateInput(sale.returnedAt) : '',
    cancellationCharges: sale.cancellationCharges ?? 0,
    cancellationTaxPercentage:
      sale.cancellationTaxPercentage ?? economics.deliveryTaxPercentage,
    cancellationTaxMode: sale.cancellationTaxMode ?? economics.deliveryTaxMode,
    cancelledAt: sale.cancelledAt ? utcToLocalDateInput(sale.cancelledAt) : '',
    economics,
    notes: sale.notes ?? '',
  };
}

/** Auto-select only when the product has a single platform listing. */
export function getInitialListingForProduct(product: Product): ProductPlatformListing | null {
  const listings = product.platformListings ?? [];
  return listings.length === 1 ? listings[0] : null;
}

export function getActiveProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.deleted && p.status === 'active');
}

function economicsToLineInput(form: SaleFormState) {
  const qty = Math.max(1, form.quantity);
  const taxOverride =
    form.economics.taxAmountManual && form.economics.taxAmountPerUnit != null
      ? form.economics.taxAmountPerUnit
      : undefined;

  return {
    quantity: qty,
    purchasePrice: form.economics.purchasePrice,
    sellingPrice: form.economics.sellingPrice,
    shippingCost: form.economics.shippingCost,
    platformFee: form.economics.platformFee,
    platformFeePercent: form.economics.platformFeePercent,
    platformFeeKind: form.economics.platformFeeKind,
    taxType: form.economics.taxType,
    taxPercentage: form.economics.sellingTaxPercentage,
    taxMode: form.economics.sellingTaxMode,
    purchaseTaxPercentage: form.economics.purchaseTaxPercentage,
    purchaseTaxMode: form.economics.purchaseTaxMode,
    sellingTaxPercentage: form.economics.sellingTaxPercentage,
    sellingTaxMode: form.economics.sellingTaxMode,
    deliveryTaxPercentage: form.economics.deliveryTaxPercentage,
    deliveryTaxMode: form.economics.deliveryTaxMode,
    platformFeeTaxPercentage: form.economics.platformFeeTaxPercentage,
    platformFeeTaxMode: form.economics.platformFeeTaxMode,
    taxAmountOverride: taxOverride,
  };
}

function baseLinePreview(form: SaleFormState): LineEconomicsResult {
  return computeLineEconomics(economicsToLineInput(form));
}

export function computeSalePreview(form: SaleFormState): SalePreviewResult {
  const base = baseLinePreview(form);
  const tracksTax = form.economics.taxType !== TaxType.NONE;
  const status = normalizeSaleStatus(form.status);

  const returnOutcome =
    status === SaleStatusEnum.RETURNED
      ? computeOutcomeChargeBreakdown(
          form.returnCharges,
          form.returnTaxPercentage,
          form.returnTaxMode,
          tracksTax
        )
      : emptyOutcomeChargeBreakdown();

  const cancellationOutcome =
    status === SaleStatusEnum.CANCELLED
      ? computeOutcomeChargeBreakdown(
          form.cancellationCharges,
          form.cancellationTaxPercentage,
          form.cancellationTaxMode,
          tracksTax
        )
      : emptyOutcomeChargeBreakdown();

  const extraCostBase = roundMoney(returnOutcome.base + cancellationOutcome.base);
  const extraInputTax = roundMoney(returnOutcome.tax + cancellationOutcome.tax);
  const netRevenue = base.netRevenue;
  const totalCosts = roundMoney(base.totalCosts + extraCostBase);
  const inputTaxAmount = roundMoney(base.inputTaxAmount + extraInputTax);
  const profit = roundMoney(netRevenue - totalCosts);
  const profitWithoutItc = roundMoney(profit - inputTaxAmount);
  const profitMarginPercent =
    netRevenue > 0 ? roundMoney((profit / netRevenue) * 100) : 0;
  const profitMarginWithoutItcPercent =
    netRevenue > 0 ? roundMoney((profitWithoutItc / netRevenue) * 100) : 0;

  return {
    ...base,
    totalCosts,
    inputTaxAmount,
    profit,
    profitMarginPercent,
    profitWithoutItc,
    profitMarginWithoutItcPercent,
    returnOutcome,
    cancellationOutcome,
  };
}

export function autoTaxPerUnit(economics: SaleFormEconomics): number {
  if (economics.taxType === TaxType.NONE) return 0;
  return computeTaxAmount(
    economics.sellingPrice,
    economics.sellingTaxPercentage,
    economics.sellingTaxMode
  );
}

function outcomeFieldsForSave(
  form: SaleFormState,
  preview: SalePreviewResult
): Pick<
  Sale,
  | 'returnCharges'
  | 'returnTaxPercentage'
  | 'returnTaxMode'
  | 'returnTaxAmount'
  | 'returnedAt'
  | 'cancellationCharges'
  | 'cancellationTaxPercentage'
  | 'cancellationTaxMode'
  | 'cancellationTaxAmount'
  | 'cancelledAt'
> {
  const status = normalizeSaleStatus(form.status);

  if (status === SaleStatusEnum.RETURNED) {
    return {
      returnCharges: preview.returnOutcome.grossAmount > 0 ? preview.returnOutcome.grossAmount : undefined,
      returnTaxPercentage: form.returnTaxPercentage,
      returnTaxMode: form.returnTaxMode,
      returnTaxAmount: preview.returnOutcome.tax > 0 ? preview.returnOutcome.tax : undefined,
      returnedAt: form.returnedAt.trim()
        ? localDateInputToUtc(form.returnedAt)
        : nowUtc(),
    };
  }

  if (status === SaleStatusEnum.CANCELLED) {
    return {
      cancellationCharges:
        preview.cancellationOutcome.grossAmount > 0
          ? preview.cancellationOutcome.grossAmount
          : undefined,
      cancellationTaxPercentage: form.cancellationTaxPercentage,
      cancellationTaxMode: form.cancellationTaxMode,
      cancellationTaxAmount:
        preview.cancellationOutcome.tax > 0 ? preview.cancellationOutcome.tax : undefined,
      cancelledAt: form.cancelledAt.trim()
        ? localDateInputToUtc(form.cancelledAt)
        : nowUtc(),
    };
  }

  return {};
}

export function buildSaleFromForm(
  form: SaleFormState,
  companyId: string,
  productName: string,
  platform: string,
  existing?: Sale
): Sale {
  const preview = computeSalePreview(form);
  const qty = Math.max(1, form.quantity);
  const linePreview = baseLinePreview(form);
  const outcomeFields = outcomeFieldsForSave(form, preview);
  const now = nowUtc();
  const e = form.economics;

  return {
    id: existing?.id ?? createListingId(),
    companyId,
    orderId: form.orderId.trim(),
    orderDate: localDateInputToUtc(form.orderDate),
    trackingId: form.trackingId.trim() || undefined,
    productId: form.productId,
    productName,
    platform,
    platformListingId: form.platformListingId || undefined,
    quantity: qty,
    status: normalizeSaleStatus(form.status),
    ...outcomeFields,
    economics: {
      purchasePrice: e.purchasePrice,
      sellingPrice: e.sellingPrice,
      shippingCost: e.shippingCost,
      platformFee: e.platformFee,
      platformFeePercent: e.platformFeePercent,
      platformFeeKind: e.platformFeeKind,
      taxType: e.taxType,
      taxPercentage: e.sellingTaxPercentage,
      taxMode: e.sellingTaxMode,
      taxAmount: linePreview.taxAmount,
      purchaseTaxPercentage: e.purchaseTaxPercentage,
      purchaseTaxMode: e.purchaseTaxMode,
      sellingTaxPercentage: e.sellingTaxPercentage,
      sellingTaxMode: e.sellingTaxMode,
      deliveryTaxPercentage: e.deliveryTaxPercentage,
      deliveryTaxMode: e.deliveryTaxMode,
      platformFeeTaxPercentage: e.platformFeeTaxPercentage,
      platformFeeTaxMode: e.platformFeeTaxMode,
      purchaseTaxAmount: linePreview.purchaseTaxAmount,
      deliveryTaxAmount: linePreview.deliveryTaxAmount,
      platformFeeTaxAmount: linePreview.platformFeeTaxAmount,
      inputTaxAmount: preview.inputTaxAmount,
    },
    grossRevenue: preview.grossRevenue,
    totalCosts: preview.totalCosts,
    platformFees: preview.platformFees,
    profit: preview.profit,
    profitMarginPercent: preview.profitMarginPercent,
    notes: form.notes.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
