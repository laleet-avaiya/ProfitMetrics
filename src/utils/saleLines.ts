import { normalizeDeliveryMode } from '../constants/deliveryModes';
import type { DeliveryMode, Sale, SaleLine } from '../types';
import { DeliveryMode as DeliveryModeEnum } from '../types';
import { computeLineEconomics, computeTaxAmount, computeTaxBase } from './profit';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Normalize legacy single-product sales into line items. */
export function getSaleLines(sale: Sale): SaleLine[] {
  if (sale.lines && sale.lines.length > 0) return sale.lines;

  return [
    {
      id: sale.id,
      productId: sale.productId,
      productName: sale.productName,
      platformListingId: sale.platformListingId,
      quantity: sale.quantity,
      economics: sale.economics,
    },
  ];
}

export function getSaleDeliveryMode(sale: Sale): DeliveryMode {
  return normalizeDeliveryMode(sale.deliveryMode);
}

export function getSaleLineCount(sale: Sale): number {
  return getSaleLines(sale).length;
}

export function getSaleTotalQuantity(sale: Sale): number {
  return getSaleLines(sale).reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}

export function getSaleDisplayProductName(sale: Sale): string {
  const lines = getSaleLines(sale);
  if (lines.length === 1) return lines[0].productName;
  return `${lines[0].productName} + ${lines.length - 1} more`;
}

export function getSalePrimaryProductId(sale: Sale): string {
  return getSaleLines(sale)[0]?.productId ?? sale.productId;
}

/** Total delivery cost recorded on this sale (individual lines + group fee). */
export function getSaleDeliveryTotal(sale: Sale): number {
  const mode = getSaleDeliveryMode(sale);

  if (mode === DeliveryModeEnum.GROUP) {
    return roundMoney(Math.max(0, sale.orderShippingCost ?? 0));
  }

  return roundMoney(
    getSaleLines(sale).reduce(
      (sum, line) =>
        sum + roundMoney(Math.max(0, line.economics.shippingCost) * Math.max(1, line.quantity)),
      0
    )
  );
}

/** Total delivery input tax (ITC) on this sale. */
export function getSaleDeliveryTaxAmount(sale: Sale): number {
  const mode = getSaleDeliveryMode(sale);
  const tracksTax = sale.economics.taxType !== 'none';

  if (!tracksTax) return 0;

  if (mode === DeliveryModeEnum.GROUP) {
    const amount = Math.max(0, sale.orderShippingCost ?? 0);
    if (amount <= 0) return 0;
    return computeTaxAmount(
      amount,
      sale.orderDeliveryTaxPercentage ?? sale.economics.deliveryTaxPercentage ?? 0,
      sale.orderDeliveryTaxMode ?? sale.economics.deliveryTaxMode ?? 'inclusive'
    );
  }

  return roundMoney(
    getSaleLines(sale).reduce((sum, line) => sum + (line.economics.deliveryTaxAmount ?? 0), 0)
  );
}

/** Ex-tax delivery cost base used in profit totals. */
export function getSaleDeliveryCostBase(sale: Sale): number {
  const mode = getSaleDeliveryMode(sale);
  const tracksTax = sale.economics.taxType !== 'none';

  if (mode === DeliveryModeEnum.GROUP) {
    const amount = Math.max(0, sale.orderShippingCost ?? 0);
    if (amount <= 0) return 0;
    if (!tracksTax) return roundMoney(amount);
    return computeTaxBase(
      amount,
      sale.orderDeliveryTaxPercentage ?? sale.economics.deliveryTaxPercentage ?? 0,
      sale.orderDeliveryTaxMode ?? sale.economics.deliveryTaxMode ?? 'inclusive'
    );
  }

  return roundMoney(
    getSaleLines(sale).reduce((sum, line) => {
      const qty = Math.max(1, line.quantity);
      const perUnit = Math.max(0, line.economics.shippingCost);
      if (perUnit <= 0) return sum;
      if (!tracksTax) return sum + roundMoney(perUnit * qty);
      return (
        sum +
        roundMoney(
          computeTaxBase(
            perUnit,
            line.economics.deliveryTaxPercentage ?? 0,
            line.economics.deliveryTaxMode ?? 'inclusive'
          ) * qty
        )
      );
    }, 0)
  );
}

export function saleCogs(sale: Sale): number {
  return roundMoney(
    getSaleLines(sale).reduce(
      (sum, line) =>
        sum +
        roundMoney(Math.max(0, line.economics.purchasePrice) * Math.max(1, line.quantity)),
      0
    )
  );
}

export function saleShipping(sale: Sale): number {
  return getSaleDeliveryCostBase(sale);
}

/** Per-line revenue and profit for product reports (group delivery allocated by revenue share). */
export function getSaleLineMetrics(
  sale: Sale
): Array<{
  productId: string;
  productName: string;
  quantity: number;
  cogs: number;
  revenue: number;
  profit: number;
}> {
  const lines = getSaleLines(sale);
  const orderProfit = sale.profit;
  const orderRevenue = sale.grossRevenue;
  const isGroup = getSaleDeliveryMode(sale) === DeliveryModeEnum.GROUP;

  const lineResults = lines.map((line) => {
    const qty = Math.max(1, line.quantity);
    const e = line.economics;
    return computeLineEconomics({
      quantity: qty,
      purchasePrice: e.purchasePrice,
      sellingPrice: e.sellingPrice,
      shippingCost: isGroup ? 0 : e.shippingCost,
      platformFee: e.platformFee,
      platformFeePercent: e.platformFeePercent,
      platformFeeKind: e.platformFeeKind,
      taxType: e.taxType,
      taxPercentage: e.taxPercentage,
      taxMode: e.taxMode,
      purchaseTaxPercentage: e.purchaseTaxPercentage,
      purchaseTaxMode: e.purchaseTaxMode,
      sellingTaxPercentage: e.sellingTaxPercentage,
      sellingTaxMode: e.sellingTaxMode,
      deliveryTaxPercentage: e.deliveryTaxPercentage,
      deliveryTaxMode: e.deliveryTaxMode,
      platformFeeTaxPercentage: e.platformFeeTaxPercentage,
      platformFeeTaxMode: e.platformFeeTaxMode,
    });
  });

  return lines.map((line, index) => {
    const result = lineResults[index];
    let profit = result.profit;

    if (isGroup && lines.length > 1 && orderRevenue > 0) {
      profit = roundMoney((result.grossRevenue / orderRevenue) * orderProfit);
    } else if (isGroup && lines.length === 1) {
      profit = orderProfit;
    }

    const qty = Math.max(1, line.quantity);
    const cogs = roundMoney(Math.max(0, line.economics.purchasePrice) * qty);

    return {
      productId: line.productId,
      productName: line.productName,
      quantity: qty,
      cogs,
      revenue: result.grossRevenue,
      profit,
    };
  });
}
