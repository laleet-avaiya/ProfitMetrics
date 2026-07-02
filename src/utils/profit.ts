import type { DeliveryMode, PlatformFeeKind, ProductPlatformListing, SaleLineEconomics, TaxMode } from '../types';
import { DeliveryMode as DeliveryModeEnum, PlatformFeeKind as PlatformFeeKindEnum, TaxMode as TaxModeEnum } from '../types';
import type { LineTaxSettings } from '../types';
import { resolveListingTax } from './listingTax';

export interface LineEconomicsInput {
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  shippingCost: number;
  platformFee?: number;
  platformFeePercent?: number;
  platformFeeKind?: PlatformFeeKind;
  taxType: SaleLineEconomics['taxType'];
  /** Legacy — maps to selling tax when granular fields omitted */
  taxPercentage: number;
  taxMode: TaxMode;
  purchaseTaxPercentage?: number;
  purchaseTaxMode?: TaxMode;
  sellingTaxPercentage?: number;
  sellingTaxMode?: TaxMode;
  deliveryTaxPercentage?: number;
  deliveryTaxMode?: TaxMode;
  platformFeeTaxPercentage?: number;
  platformFeeTaxMode?: TaxMode;
  /** When set, skips auto output tax calculation */
  taxAmountOverride?: number;
}

export interface LineEconomicsResult {
  quantity: number;
  grossRevenue: number;
  cogs: number;
  shippingTotal: number;
  platformFees: number;
  /** Ex-tax platform fee base used in cost totals */
  platformFeesBase: number;
  /** Output tax on selling */
  taxAmount: number;
  purchaseTaxAmount: number;
  deliveryTaxAmount: number;
  platformFeeTaxAmount: number;
  inputTaxAmount: number;
  totalCosts: number;
  /** Net revenue after output tax adjustment (ex-tax when selling tax is inclusive). */
  netRevenue: number;
  /** Profit after input tax credit — costs at pre-tax base. */
  profit: number;
  profitMarginPercent: number;
  /** Profit if input tax (ITC) could not be claimed. */
  profitWithoutItc: number;
  profitMarginWithoutItcPercent: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolvedTax(input: LineEconomicsInput): LineTaxSettings {
  return {
    purchaseTaxPercentage: input.purchaseTaxPercentage ?? 0,
    purchaseTaxMode: input.purchaseTaxMode ?? TaxModeEnum.INCLUSIVE,
    sellingTaxPercentage: input.sellingTaxPercentage ?? input.taxPercentage ?? 0,
    sellingTaxMode: input.sellingTaxMode ?? input.taxMode ?? TaxModeEnum.INCLUSIVE,
    deliveryTaxPercentage: input.deliveryTaxPercentage ?? 0,
    deliveryTaxMode: input.deliveryTaxMode ?? TaxModeEnum.INCLUSIVE,
    platformFeeTaxPercentage: input.platformFeeTaxPercentage ?? 0,
    platformFeeTaxMode: input.platformFeeTaxMode ?? TaxModeEnum.INCLUSIVE,
  };
}

function platformFeePerUnit(unitSelling: number, input: LineEconomicsInput): number {
  const kind =
    input.platformFeeKind ??
    ((input.platformFeePercent ?? 0) > 0 ? PlatformFeeKindEnum.PERCENT : PlatformFeeKindEnum.FIXED);

  if (kind === PlatformFeeKindEnum.PERCENT) {
    return (input.platformFeePercent ?? 0) > 0
      ? unitSelling * ((input.platformFeePercent ?? 0) / 100)
      : 0;
  }

  return Math.max(0, input.platformFee ?? 0);
}

/** Tax amount embedded in or on top of a base amount. */
export function computeTaxAmount(
  amount: number,
  taxPercentage: number,
  taxMode: TaxMode
): number {
  if (taxPercentage <= 0 || amount <= 0) return 0;

  if (taxMode === TaxModeEnum.INCLUSIVE) {
    return roundMoney(amount - amount / (1 + taxPercentage / 100));
  }

  if (taxMode === TaxModeEnum.EXCLUSIVE) {
    return roundMoney(amount * (taxPercentage / 100));
  }

  return roundMoney(amount * (taxPercentage / 100));
}

/** Pre-tax base when tax is tracked on an amount. */
export function computeTaxBase(
  amount: number,
  taxPercentage: number,
  taxMode: TaxMode
): number {
  if (taxPercentage <= 0 || amount <= 0) return roundMoney(Math.max(0, amount));
  const tax = computeTaxAmount(amount, taxPercentage, taxMode);
  if (taxMode === TaxModeEnum.INCLUSIVE) return roundMoney(amount - tax);
  return roundMoney(amount);
}

export function computeLineEconomics(input: LineEconomicsInput): LineEconomicsResult {
  const qty = Math.max(1, input.quantity);
  const unitSelling = Math.max(0, input.sellingPrice);
  const grossRevenue = roundMoney(unitSelling * qty);
  const tax = resolvedTax(input);
  const tracksTax = input.taxType !== 'none';

  const unitPlatformFee = platformFeePerUnit(unitSelling, input);
  const platformFees = roundMoney(unitPlatformFee * qty);

  const purchasePerUnit = Math.max(0, input.purchasePrice);
  const deliveryPerUnit = Math.max(0, input.shippingCost);

  const purchaseTaxPerUnit = tracksTax
    ? computeTaxAmount(purchasePerUnit, tax.purchaseTaxPercentage, tax.purchaseTaxMode)
    : 0;
  const deliveryTaxPerUnit = tracksTax
    ? computeTaxAmount(deliveryPerUnit, tax.deliveryTaxPercentage, tax.deliveryTaxMode)
    : 0;
  const platformFeeTaxPerUnit = tracksTax
    ? computeTaxAmount(unitPlatformFee, tax.platformFeeTaxPercentage, tax.platformFeeTaxMode)
    : 0;
  const outputTaxPerUnit =
    input.taxAmountOverride != null
      ? input.taxAmountOverride
      : tracksTax
        ? computeTaxAmount(unitSelling, tax.sellingTaxPercentage, tax.sellingTaxMode)
        : 0;

  const purchaseTaxAmount = roundMoney(purchaseTaxPerUnit * qty);
  const deliveryTaxAmount = roundMoney(deliveryTaxPerUnit * qty);
  const platformFeeTaxAmount = roundMoney(platformFeeTaxPerUnit * qty);
  const taxAmount = roundMoney(outputTaxPerUnit * qty);
  const inputTaxAmount = roundMoney(
    purchaseTaxAmount + deliveryTaxAmount + platformFeeTaxAmount
  );

  const cogs = roundMoney(
    computeTaxBase(purchasePerUnit, tax.purchaseTaxPercentage, tax.purchaseTaxMode) * qty
  );
  const shippingTotal = roundMoney(
    computeTaxBase(deliveryPerUnit, tax.deliveryTaxPercentage, tax.deliveryTaxMode) * qty
  );
  const platformFeesBase = roundMoney(
    computeTaxBase(unitPlatformFee, tax.platformFeeTaxPercentage, tax.platformFeeTaxMode) * qty
  );

  let netRevenue = grossRevenue;
  if (tax.sellingTaxMode === TaxModeEnum.INCLUSIVE) {
    netRevenue = roundMoney(grossRevenue - taxAmount);
  }

  const totalCosts = roundMoney(
    cogs +
      shippingTotal +
      platformFeesBase +
      (tax.sellingTaxMode === TaxModeEnum.EXCLUSIVE ? taxAmount : 0)
  );

  const profit = roundMoney(netRevenue - totalCosts);
  const profitWithoutItc = roundMoney(profit - inputTaxAmount);
  const profitMarginPercent =
    netRevenue > 0 ? roundMoney((profit / netRevenue) * 100) : 0;
  const profitMarginWithoutItcPercent =
    netRevenue > 0 ? roundMoney((profitWithoutItc / netRevenue) * 100) : 0;

  return {
    quantity: qty,
    grossRevenue,
    cogs,
    shippingTotal,
    platformFees,
    platformFeesBase,
    taxAmount,
    purchaseTaxAmount,
    deliveryTaxAmount,
    platformFeeTaxAmount,
    inputTaxAmount,
    totalCosts,
    netRevenue,
    profit,
    profitMarginPercent,
    profitWithoutItc,
    profitMarginWithoutItcPercent,
  };
}

export function lineEconomicsInputFromListing(
  listing: ProductPlatformListing,
  quantity = 1
): LineEconomicsInput {
  const resolved = resolveListingTax(listing);
  return {
    quantity,
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
  };
}

export interface OrderEconomicsInput {
  lines: LineEconomicsInput[];
  deliveryMode: DeliveryMode;
  orderShippingCost?: number;
  orderDeliveryTaxPercentage?: number;
  orderDeliveryTaxMode?: TaxMode;
}

function emptyLineResult(): LineEconomicsResult {
  return {
    quantity: 0,
    grossRevenue: 0,
    cogs: 0,
    shippingTotal: 0,
    platformFees: 0,
    platformFeesBase: 0,
    taxAmount: 0,
    purchaseTaxAmount: 0,
    deliveryTaxAmount: 0,
    platformFeeTaxAmount: 0,
    inputTaxAmount: 0,
    totalCosts: 0,
    netRevenue: 0,
    profit: 0,
    profitMarginPercent: 0,
    profitWithoutItc: 0,
    profitMarginWithoutItcPercent: 0,
  };
}

function sumLineResults(results: LineEconomicsResult[]): LineEconomicsResult {
  if (results.length === 0) return emptyLineResult();

  const totalQty = results.reduce((sum, r) => sum + r.quantity, 0);
  const grossRevenue = roundMoney(results.reduce((sum, r) => sum + r.grossRevenue, 0));
  const cogs = roundMoney(results.reduce((sum, r) => sum + r.cogs, 0));
  const shippingTotal = roundMoney(results.reduce((sum, r) => sum + r.shippingTotal, 0));
  const platformFees = roundMoney(results.reduce((sum, r) => sum + r.platformFees, 0));
  const platformFeesBase = roundMoney(results.reduce((sum, r) => sum + r.platformFeesBase, 0));
  const taxAmount = roundMoney(results.reduce((sum, r) => sum + r.taxAmount, 0));
  const purchaseTaxAmount = roundMoney(results.reduce((sum, r) => sum + r.purchaseTaxAmount, 0));
  const deliveryTaxAmount = roundMoney(results.reduce((sum, r) => sum + r.deliveryTaxAmount, 0));
  const platformFeeTaxAmount = roundMoney(
    results.reduce((sum, r) => sum + r.platformFeeTaxAmount, 0)
  );
  const inputTaxAmount = roundMoney(results.reduce((sum, r) => sum + r.inputTaxAmount, 0));
  const totalCosts = roundMoney(results.reduce((sum, r) => sum + r.totalCosts, 0));
  const netRevenue = roundMoney(results.reduce((sum, r) => sum + r.netRevenue, 0));
  const profit = roundMoney(netRevenue - totalCosts);
  const profitWithoutItc = roundMoney(profit - inputTaxAmount);
  const profitMarginPercent =
    netRevenue > 0 ? roundMoney((profit / netRevenue) * 100) : 0;
  const profitMarginWithoutItcPercent =
    netRevenue > 0 ? roundMoney((profitWithoutItc / netRevenue) * 100) : 0;

  return {
    quantity: totalQty,
    grossRevenue,
    cogs,
    shippingTotal,
    platformFees,
    platformFeesBase,
    taxAmount,
    purchaseTaxAmount,
    deliveryTaxAmount,
    platformFeeTaxAmount,
    inputTaxAmount,
    totalCosts,
    netRevenue,
    profit,
    profitMarginPercent,
    profitWithoutItc,
    profitMarginWithoutItcPercent,
  };
}

/** Aggregate multi-line order economics with individual or group delivery. */
export function computeOrderEconomics(input: OrderEconomicsInput): LineEconomicsResult {
  const isGroup = input.deliveryMode === DeliveryModeEnum.GROUP;

  const lineResults = input.lines.map((line) =>
    computeLineEconomics({
      ...line,
      shippingCost: isGroup ? 0 : line.shippingCost,
    })
  );

  let aggregated = sumLineResults(lineResults);

  if (isGroup && (input.orderShippingCost ?? 0) > 0 && input.lines.length > 0) {
    const taxType = input.lines[0]?.taxType ?? 'none';
    const tracksTax = taxType !== 'none';
    const orderAmount = Math.max(0, input.orderShippingCost ?? 0);
    const taxPct = input.orderDeliveryTaxPercentage ?? input.lines[0]?.deliveryTaxPercentage ?? 0;
    const taxMode =
      input.orderDeliveryTaxMode ?? input.lines[0]?.deliveryTaxMode ?? TaxModeEnum.INCLUSIVE;

    const deliveryTaxAmount = tracksTax ? computeTaxAmount(orderAmount, taxPct, taxMode) : 0;
    const shippingBase = tracksTax ? computeTaxBase(orderAmount, taxPct, taxMode) : orderAmount;
    const shippingTotal = roundMoney(shippingBase);
    const nextTotalCosts = roundMoney(aggregated.totalCosts + shippingTotal);

    aggregated = {
      ...aggregated,
      shippingTotal: roundMoney(aggregated.shippingTotal + shippingTotal),
      deliveryTaxAmount: roundMoney(aggregated.deliveryTaxAmount + deliveryTaxAmount),
      inputTaxAmount: roundMoney(aggregated.inputTaxAmount + deliveryTaxAmount),
      totalCosts: nextTotalCosts,
      profit: roundMoney(aggregated.netRevenue - nextTotalCosts),
    };
    aggregated.profitWithoutItc = roundMoney(aggregated.profit - aggregated.inputTaxAmount);
    aggregated.profitMarginPercent =
      aggregated.netRevenue > 0
        ? roundMoney((aggregated.profit / aggregated.netRevenue) * 100)
        : 0;
    aggregated.profitMarginWithoutItcPercent =
      aggregated.netRevenue > 0
        ? roundMoney((aggregated.profitWithoutItc / aggregated.netRevenue) * 100)
        : 0;
  }

  return aggregated;
}

export function formatMoney(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
