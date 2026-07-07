import type {
  Customer,
  DeliveryMode,
  Product,
  ProductPlatformListing,
  Sale,
  SaleLine,
  SaleLineEconomics,
  SaleStatus,
} from '../types';
import {
  DeliveryMode as DeliveryModeEnum,
  PaymentMode,
  PlatformFeeKind,
  PurchasePaymentStatus,
  SaleStatus as SaleStatusEnum,
  TaxMode,
  TaxType,
} from '../types';
import { normalizeDeliveryMode } from '../constants/deliveryModes';
import { normalizeSaleStatus } from '../constants/saleStatuses';
import { normalizeSalePaymentStatus } from '../constants/purchaseStatuses';
import { derivePaymentStatus } from './purchaseHelpers';
import { customerSnapshotFromCustomer } from './customerHelpers';
import { resolveListingTax, defaultPurchaseTaxFromSelling } from './listingTax';
import {
  computeLineEconomics,
  computeOrderEconomics,
  computeTaxAmount,
  computeTaxBase,
  type LineEconomicsResult,
} from './profit';
import { getSaleLines } from './saleLines';
import { createListingId } from './productDefaults';
import { localDateInputToUtc, nowUtc, utcToLocalDateInput } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Keep purchase-side tax in sync with selling tax when unset (avoids double-counting GST in COGS). */
export function syncPurchaseTaxDefaults(economics: SaleFormEconomics): SaleFormEconomics {
  const purchaseTax = defaultPurchaseTaxFromSelling(
    economics.taxType,
    economics.sellingTaxPercentage,
    economics.sellingTaxMode,
    economics.purchaseTaxPercentage,
    economics.purchaseTaxMode
  );
  if (
    purchaseTax.purchaseTaxPercentage === economics.purchaseTaxPercentage &&
    purchaseTax.purchaseTaxMode === economics.purchaseTaxMode
  ) {
    return economics;
  }
  return {
    ...economics,
    purchaseTaxPercentage: purchaseTax.purchaseTaxPercentage,
    purchaseTaxMode: purchaseTax.purchaseTaxMode,
  };
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
  taxAmountPerUnit?: number;
  taxAmountManual: boolean;
}

export interface SaleLineFormState {
  id: string;
  productId: string;
  variantId: string;
  variantLabel: string;
  platformListingId: string;
  quantity: number;
  economics: SaleFormEconomics;
}

/** Optional buyer capture on marketplace orders — mirrors invoice customers. */
export interface SaleCustomerFormState {
  mode: 'existing' | 'new';
  customerId: string;
  name: string;
  email: string;
  phone: string;
  taxId: string;
}

export function emptySaleCustomerForm(): SaleCustomerFormState {
  return {
    mode: 'existing',
    customerId: '',
    name: '',
    email: '',
    phone: '',
    taxId: '',
  };
}

export interface SaleFormState {
  orderId: string;
  orderDate: string;
  trackingId: string;
  platform: string;
  customer: SaleCustomerFormState;
  deliveryMode: DeliveryMode;
  orderShippingCost: number;
  orderDeliveryTaxPercentage: number;
  orderDeliveryTaxMode: TaxMode;
  lines: SaleLineFormState[];
  status: SaleStatus;
  paymentMode: PaymentMode | '';
  paymentStatus: PurchasePaymentStatus;
  returnCharges: number;
  returnTaxPercentage: number;
  returnTaxMode: TaxMode;
  returnedAt: string;
  cancellationCharges: number;
  cancellationTaxPercentage: number;
  cancellationTaxMode: TaxMode;
  cancelledAt: string;
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

export function emptySaleLineForm(): SaleLineFormState {
  return {
    id: createListingId(),
    productId: '',
    variantId: '',
    variantLabel: '',
    platformListingId: '',
    quantity: 1,
    economics: defaultEconomics(),
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
    platform: '',
    customer: emptySaleCustomerForm(),
    deliveryMode: DeliveryModeEnum.INDIVIDUAL,
    orderShippingCost: 0,
    orderDeliveryTaxPercentage: 0,
    orderDeliveryTaxMode: TaxMode.INCLUSIVE,
    lines: [emptySaleLineForm()],
    status: SaleStatusEnum.DELIVERED,
    paymentMode: '',
    paymentStatus: PurchasePaymentStatus.UNPAID,
    returnCharges: 0,
    returnTaxPercentage: 0,
    returnTaxMode: TaxMode.INCLUSIVE,
    returnedAt: '',
    cancellationCharges: 0,
    cancellationTaxPercentage: 0,
    cancellationTaxMode: TaxMode.INCLUSIVE,
    cancelledAt: '',
    notes: '',
  };
}

export function economicsFromListing(listing: ProductPlatformListing): SaleFormEconomics {
  const resolved = resolveListingTax(listing);
  return syncPurchaseTaxDefaults({
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
  });
}

/** Pick listing + economics when a product is added to a sale line. */
export function resolveProductSaleSelection(
  product: Product,
  platform: string
): Pick<SaleLineFormState, 'platformListingId' | 'economics'> {
  if (platform.trim()) {
    const exact = getListingsForPlatform(product, platform);
    if (exact.length === 1) {
      return {
        platformListingId: exact[0].id,
        economics: economicsFromListing(exact[0]),
      };
    }
    if (exact.length > 1) {
      return {
        platformListingId: '',
        economics: defaultEconomics(),
      };
    }
  }

  const configured = (product.platformListings ?? []).filter((listing) => listing.platform.trim());
  if (configured.length > 0) {
    return {
      platformListingId: '',
      economics: economicsFromListing(configured[0]),
    };
  }

  return {
    platformListingId: '',
    economics: defaultEconomics(),
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

  return syncPurchaseTaxDefaults({
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
  });
}

function lineFormFromSaleLine(line: SaleLine): SaleLineFormState {
  const qty = Math.max(1, line.quantity);
  return {
    id: line.id,
    productId: line.productId,
    variantId: line.variantId ?? '',
    variantLabel: line.variantLabel ?? '',
    platformListingId: line.platformListingId ?? '',
    quantity: line.quantity,
    economics: economicsFromSaleRecord(line.economics, qty),
  };
}

export function saleToForm(sale: Sale): SaleFormState {
  const lines = getSaleLines(sale);
  const status = normalizeSaleStatus(sale.status);
  const firstLine = lines[0];
  const firstEconomics = firstLine?.economics ?? sale.economics;

  const snapshot = sale.customer;

  return {
    orderId: sale.orderId ?? '',
    orderDate: utcToLocalDateInput(sale.orderDate),
    trackingId: sale.trackingId ?? '',
    platform: sale.platform,
    customer: {
      ...emptySaleCustomerForm(),
      mode: 'existing',
      customerId: sale.customerId ?? snapshot?.id ?? '',
      name: snapshot?.name ?? sale.customerName ?? '',
      email: snapshot?.email ?? '',
      phone: snapshot?.phone ?? '',
      taxId: snapshot?.taxId ?? '',
    },
    deliveryMode: normalizeDeliveryMode(sale.deliveryMode),
    orderShippingCost: sale.orderShippingCost ?? 0,
    orderDeliveryTaxPercentage:
      sale.orderDeliveryTaxPercentage ?? firstEconomics.deliveryTaxPercentage ?? 0,
    orderDeliveryTaxMode:
      sale.orderDeliveryTaxMode ?? firstEconomics.deliveryTaxMode ?? TaxMode.INCLUSIVE,
    lines: lines.map(lineFormFromSaleLine),
    status,
    paymentMode: sale.paymentMode ?? '',
    paymentStatus: normalizeSalePaymentStatus(sale.paymentStatus),
    returnCharges: sale.returnCharges ?? 0,
    returnTaxPercentage: sale.returnTaxPercentage ?? firstEconomics.deliveryTaxPercentage ?? 0,
    returnTaxMode: sale.returnTaxMode ?? firstEconomics.deliveryTaxMode ?? TaxMode.INCLUSIVE,
    returnedAt: sale.returnedAt ? utcToLocalDateInput(sale.returnedAt) : '',
    cancellationCharges: sale.cancellationCharges ?? 0,
    cancellationTaxPercentage:
      sale.cancellationTaxPercentage ?? firstEconomics.deliveryTaxPercentage ?? 0,
    cancellationTaxMode:
      sale.cancellationTaxMode ?? firstEconomics.deliveryTaxMode ?? TaxMode.INCLUSIVE,
    cancelledAt: sale.cancelledAt ? utcToLocalDateInput(sale.cancelledAt) : '',
    notes: sale.notes ?? '',
  };
}

export function getInitialListingForProduct(
  product: Product,
  platform?: string
): ProductPlatformListing | null {
  const listings = getSaleListingsForPlatform(product, platform ?? '');
  return listings.length === 1 ? listings[0] : null;
}

export function getListingsForPlatform(product: Product, platform: string): ProductPlatformListing[] {
  return (product.platformListings ?? []).filter((l) => l.platform === platform);
}

/** Platform listings for a sale row — falls back to the product's only listing when needed. */
export function getSaleListingsForPlatform(
  product: Product,
  platform: string
): ProductPlatformListing[] {
  const platformListings = getListingsForPlatform(product, platform);
  if (platformListings.length > 0) return platformListings;

  const configured = (product.platformListings ?? []).filter((l) => l.platform.trim());
  if (configured.length === 1) return configured;

  return [];
}

export function getActiveProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.deleted && p.status === 'active');
}

function economicsToLineInput(line: SaleLineFormState) {
  const qty = Math.max(1, line.quantity);
  const e = line.economics;
  const taxOverride =
    e.taxAmountManual && e.taxAmountPerUnit != null ? e.taxAmountPerUnit : undefined;

  return {
    quantity: qty,
    purchasePrice: e.purchasePrice,
    sellingPrice: e.sellingPrice,
    shippingCost: e.shippingCost,
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
  };
}

function baseOrderPreview(form: SaleFormState): LineEconomicsResult {
  return computeOrderEconomics({
    lines: form.lines.map(economicsToLineInput),
    deliveryMode: form.deliveryMode,
    orderShippingCost: form.orderShippingCost,
    orderDeliveryTaxPercentage: form.orderDeliveryTaxPercentage,
    orderDeliveryTaxMode: form.orderDeliveryTaxMode,
  });
}

export function computeSalePreview(form: SaleFormState): SalePreviewResult {
  const base = baseOrderPreview(form);
  const firstLine = form.lines[0];
  const tracksTax = (firstLine?.economics.taxType ?? TaxType.NONE) !== TaxType.NONE;
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

/** Recompute order economics from a saved sale (fixes legacy purchase-tax defaults on read). */
export function computeStoredSaleEconomics(sale: Sale): SalePreviewResult {
  return computeSalePreview(saleToForm(sale));
}

export function getSaleProfit(sale: Sale): number {
  return computeStoredSaleEconomics(sale).profit;
}

export function getSaleProfitMarginPercent(sale: Sale): number {
  return computeStoredSaleEconomics(sale).profitMarginPercent;
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

function buildLineEconomics(
  line: SaleLineFormState,
  linePreview: LineEconomicsResult
): SaleLineEconomics {
  const e = syncPurchaseTaxDefaults(line.economics);
  return {
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
    inputTaxAmount: linePreview.inputTaxAmount,
  };
}

function buildOrderEconomicsSnapshot(
  form: SaleFormState,
  preview: SalePreviewResult
): SaleLineEconomics {
  const first = syncPurchaseTaxDefaults(form.lines[0]?.economics ?? defaultEconomics());
  return {
    purchasePrice: first.purchasePrice,
    sellingPrice: first.sellingPrice,
    shippingCost:
      form.deliveryMode === DeliveryModeEnum.GROUP ? 0 : first.shippingCost,
    platformFee: first.platformFee,
    platformFeePercent: first.platformFeePercent,
    platformFeeKind: first.platformFeeKind,
    taxType: first.taxType,
    taxPercentage: first.sellingTaxPercentage,
    taxMode: first.sellingTaxMode,
    taxAmount: preview.taxAmount,
    purchaseTaxPercentage: first.purchaseTaxPercentage,
    purchaseTaxMode: first.purchaseTaxMode,
    sellingTaxPercentage: first.sellingTaxPercentage,
    sellingTaxMode: first.sellingTaxMode,
    deliveryTaxPercentage:
      form.deliveryMode === DeliveryModeEnum.GROUP
        ? form.orderDeliveryTaxPercentage
        : first.deliveryTaxPercentage,
    deliveryTaxMode:
      form.deliveryMode === DeliveryModeEnum.GROUP
        ? form.orderDeliveryTaxMode
        : first.deliveryTaxMode,
    platformFeeTaxPercentage: first.platformFeeTaxPercentage,
    platformFeeTaxMode: first.platformFeeTaxMode,
    purchaseTaxAmount: preview.purchaseTaxAmount,
    deliveryTaxAmount: preview.deliveryTaxAmount,
    platformFeeTaxAmount: preview.platformFeeTaxAmount,
    inputTaxAmount: preview.inputTaxAmount,
  };
}

export function buildSaleFromForm(
  form: SaleFormState,
  companyId: string,
  productNames: Map<string, string>,
  existing?: Sale,
  productHsnCodes?: Map<string, string>,
  customer?: Customer,
  orderNumber?: string
): Sale {
  const preview = computeSalePreview(form);
  const outcomeFields = outcomeFieldsForSave(form, preview);
  const now = nowUtc();
  const isGroup = form.deliveryMode === DeliveryModeEnum.GROUP;

  const lineInputs = form.lines.map(economicsToLineInput);
  const linePreviews = lineInputs.map((input) =>
    computeLineEconomics({
      ...input,
      shippingCost: isGroup ? 0 : input.shippingCost,
    })
  );

  const saleLines: SaleLine[] = form.lines.map((line, index) => {
    const hsnCode = productHsnCodes?.get(line.productId)?.trim();
    return {
      id: line.id,
      productId: line.productId,
      productName: productNames.get(line.productId) ?? 'Unknown product',
      variantId: line.variantId || undefined,
      variantLabel: line.variantLabel || undefined,
      hsnCode: hsnCode || undefined,
      platformListingId: line.platformListingId || undefined,
      quantity: Math.max(1, line.quantity),
      economics: buildLineEconomics(line, linePreviews[index]),
    };
  });

  const firstLine = saleLines[0];
  const totalQty = saleLines.reduce((sum, line) => sum + line.quantity, 0);
  const displayName =
    saleLines.length === 1
      ? firstLine.productName
      : `${firstLine.productName} + ${saleLines.length - 1} more`;

  // grossRevenue already contains tax for inclusive-tax lines. For exclusive
  // (e.g. GST-on-top) lines the output tax must be added so the invoice total
  // and the amount owed by the customer include the tax charged.
  const exclusiveOutputTax = roundMoney(
    form.lines.reduce(
      (sum, line, index) =>
        sum +
        (line.economics.sellingTaxMode === TaxMode.EXCLUSIVE
          ? linePreviews[index].taxAmount
          : 0),
      0
    )
  );
  const total = roundMoney(preview.grossRevenue + exclusiveOutputTax);
  const totalPaid = roundMoney(existing?.totalPaid ?? 0);
  const balanceDue = roundMoney(Math.max(0, total - totalPaid));
  const paymentStatus = derivePaymentStatus(total, totalPaid);
  let customerSnapshot = customer ? customerSnapshotFromCustomer(customer) : undefined;
  if (
    !customerSnapshot &&
    form.customer.customerId &&
    existing?.customerId === form.customer.customerId
  ) {
    customerSnapshot =
      existing.customer ??
      (existing.customerName
        ? { id: existing.customerId, name: existing.customerName }
        : undefined);
  }

  return {
    id: existing?.id ?? createListingId(),
    companyId,
    orderNumber: orderNumber ?? existing?.orderNumber,
    orderId: form.orderId.trim() || undefined,
    orderDate: localDateInputToUtc(form.orderDate),
    trackingId: form.trackingId.trim() || undefined,
    lines: saleLines,
    deliveryMode: form.deliveryMode,
    orderShippingCost: isGroup ? form.orderShippingCost : undefined,
    orderDeliveryTaxPercentage: isGroup ? form.orderDeliveryTaxPercentage : undefined,
    orderDeliveryTaxMode: isGroup ? form.orderDeliveryTaxMode : undefined,
    productId: firstLine.productId,
    productName: displayName,
    platform: form.platform.trim(),
    platformListingId: firstLine.platformListingId,
    quantity: totalQty,
    customerId: customerSnapshot?.id,
    customerName: customerSnapshot?.name,
    customer: customerSnapshot,
    status: normalizeSaleStatus(form.status),
    paymentMode: form.paymentMode || undefined,
    paymentStatus,
    ...outcomeFields,
    economics: buildOrderEconomicsSnapshot(form, preview),
    grossRevenue: preview.grossRevenue,
    totalCosts: preview.totalCosts,
    platformFees: preview.platformFees,
    profit: preview.profit,
    profitMarginPercent: preview.profitMarginPercent,
    total,
    totalPaid,
    balanceDue,
    notes: form.notes.trim() || undefined,
    stockApplied: existing?.stockApplied,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Sum suggested group delivery from line listing defaults. */
export function suggestGroupDeliveryCost(lines: SaleLineFormState[]): number {
  return roundMoney(
    lines.reduce(
      (sum, line) =>
        sum + Math.max(0, line.economics.shippingCost) * Math.max(1, line.quantity),
      0
    )
  );
}
