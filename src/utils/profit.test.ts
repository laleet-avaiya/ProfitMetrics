import { describe, expect, it } from 'vitest';
import { DeliveryMode, TaxMode } from '../types';
import {
  computeLineEconomics,
  computeOrderEconomics,
  computeTaxAmount,
  computeTaxBase,
} from './profit';

describe('computeTaxAmount', () => {
  it('returns 0 when tax rate or amount is zero', () => {
    expect(computeTaxAmount(100, 0, TaxMode.EXCLUSIVE)).toBe(0);
    expect(computeTaxAmount(0, 5, TaxMode.EXCLUSIVE)).toBe(0);
  });

  it('computes exclusive tax on top of base', () => {
    expect(computeTaxAmount(100, 5, TaxMode.EXCLUSIVE)).toBe(5);
  });

  it('extracts inclusive tax from gross amount', () => {
    expect(computeTaxAmount(105, 5, TaxMode.INCLUSIVE)).toBe(5);
  });
});

describe('computeTaxBase', () => {
  it('returns pre-tax base for inclusive amounts', () => {
    expect(computeTaxBase(105, 5, TaxMode.INCLUSIVE)).toBe(100);
  });
});

describe('computeLineEconomics', () => {
  it('computes profit for a simple exclusive-tax line', () => {
    const result = computeLineEconomics({
      quantity: 2,
      purchasePrice: 40,
      sellingPrice: 100,
      shippingCost: 0,
      taxType: 'none',
      taxPercentage: 0,
      taxMode: TaxMode.EXCLUSIVE,
    });

    expect(result.grossRevenue).toBe(200);
    expect(result.cogs).toBe(80);
    expect(result.profit).toBe(120);
    expect(result.profitMarginPercent).toBe(60);
  });

  it('deducts inclusive selling tax from net revenue', () => {
    const result = computeLineEconomics({
      quantity: 1,
      purchasePrice: 50,
      sellingPrice: 105,
      shippingCost: 0,
      taxType: 'vat',
      taxPercentage: 5,
      taxMode: TaxMode.INCLUSIVE,
      sellingTaxPercentage: 5,
      sellingTaxMode: TaxMode.INCLUSIVE,
      purchaseTaxPercentage: 0,
      purchaseTaxMode: TaxMode.EXCLUSIVE,
    });

    expect(result.grossRevenue).toBe(105);
    expect(result.taxAmount).toBe(5);
    expect(result.netRevenue).toBe(100);
    expect(result.profit).toBe(50);
  });

  it('uses ex-tax COGS when purchase price is GST-inclusive and purchase tax is unset', () => {
    const result = computeLineEconomics({
      quantity: 1,
      purchasePrice: 118,
      sellingPrice: 236,
      shippingCost: 0,
      taxType: 'gst',
      taxPercentage: 18,
      taxMode: TaxMode.INCLUSIVE,
      sellingTaxPercentage: 18,
      sellingTaxMode: TaxMode.INCLUSIVE,
      purchaseTaxPercentage: 0,
      purchaseTaxMode: TaxMode.INCLUSIVE,
    });

    expect(result.cogs).toBe(100);
    expect(result.netRevenue).toBe(200);
    expect(result.purchaseTaxAmount).toBe(18);
    expect(result.profit).toBe(100);
    expect(result.profitWithoutItc).toBe(82);
  });

  it('keeps ex-tax margin when GST is charged on top of selling price', () => {
    const result = computeLineEconomics({
      quantity: 1,
      purchasePrice: 100,
      sellingPrice: 200,
      shippingCost: 0,
      taxType: 'gst',
      taxPercentage: 18,
      taxMode: TaxMode.EXCLUSIVE,
      sellingTaxPercentage: 18,
      sellingTaxMode: TaxMode.EXCLUSIVE,
      purchaseTaxPercentage: 18,
      purchaseTaxMode: TaxMode.EXCLUSIVE,
    });

    expect(result.cogs).toBe(100);
    expect(result.grossRevenue).toBe(200);
    expect(result.netRevenue).toBe(200);
    expect(result.taxAmount).toBe(36);
    expect(result.purchaseTaxAmount).toBe(18);
    expect(result.totalCosts).toBe(100);
    expect(result.profit).toBe(100);
    expect(result.profitWithoutItc).toBe(82);
  });
});

describe('computeOrderEconomics', () => {
  it('adds group delivery shipping once to order totals', () => {
    const result = computeOrderEconomics({
      deliveryMode: DeliveryMode.GROUP,
      orderShippingCost: 20,
      lines: [
        {
          quantity: 1,
          purchasePrice: 30,
          sellingPrice: 80,
          shippingCost: 5,
          taxType: 'none',
          taxPercentage: 0,
          taxMode: TaxMode.EXCLUSIVE,
        },
      ],
    });

    expect(result.shippingTotal).toBe(20);
    expect(result.profit).toBe(30);
  });
});
