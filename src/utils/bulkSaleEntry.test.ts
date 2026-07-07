import { describe, expect, it } from 'vitest';
import { TaxType, TaxMode, PlatformFeeKind } from '../types';
import {
  buildSaleFromForm,
  economicsFromListing,
  emptySaleForm,
  emptySaleLineForm,
  computeSalePreview,
} from './saleHelpers';
import { bulkRowToSaleForm, emptyBulkSaleRow, validateBulkSaleRow } from './bulkSaleEntry';
import type { Product, ProductPlatformListing } from '../types';

const noneTaxListing: ProductPlatformListing = {
  id: 'listing-1',
  platform: 'Amazon',
  purchasePrice: 50,
  sellingPrice: 100,
  shippingCost: 5,
  platformFeeKind: PlatformFeeKind.FIXED,
  platformFee: 10,
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
};

const product: Product = {
  id: 'product-1',
  companyId: 'co-1',
  name: 'No-tax widget',
  status: 'active',
  platformListings: [noneTaxListing],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('sales with tax type none', () => {
  it('builds sale payload from form', () => {
    const form = emptySaleForm();
    form.platform = 'Amazon';
    form.lines = [
      {
        ...emptySaleLineForm(),
        productId: 'product-1',
        platformListingId: 'listing-1',
        quantity: 1,
        economics: economicsFromListing(noneTaxListing),
      },
    ];

    const preview = computeSalePreview(form);
    expect(preview.profit).toBeGreaterThan(0);
    expect(Number.isNaN(preview.profit)).toBe(false);

    const sale = buildSaleFromForm(
      form,
      'co-1',
      new Map([['product-1', 'No-tax widget']]),
      undefined,
      undefined,
      undefined,
      'ORD-2026-000001'
    );

    expect(sale.economics.taxType).toBe(TaxType.NONE);
    expect(sale.economics.taxAmount).toBe(0);
    expect(Number.isNaN(sale.profit)).toBe(false);
    expect(Number.isNaN(sale.total)).toBe(false);
  });

  it('bulk row validates and converts', () => {
    const row = {
      ...emptyBulkSaleRow('Amazon'),
      productId: 'product-1',
      platformListingId: 'listing-1',
      economics: economicsFromListing(noneTaxListing),
    };

    expect(validateBulkSaleRow(row, [product])).toBeNull();

    const form = bulkRowToSaleForm(row);
    const preview = computeSalePreview(form);
    expect(preview.grossRevenue).toBe(100);
    expect(preview.profit).toBeGreaterThan(0);
  });

  it('ignores legacy tax percentages when tax type is none', () => {
    const legacyNoneListing: ProductPlatformListing = {
      ...noneTaxListing,
      purchaseTaxPercentage: 18,
      sellingTaxPercentage: 18,
      deliveryTaxPercentage: 18,
      platformFeeTaxPercentage: 18,
    };

    const economics = economicsFromListing(legacyNoneListing);
    expect(economics.taxType).toBe(TaxType.NONE);
    expect(economics.purchaseTaxPercentage).toBe(0);
    expect(economics.sellingTaxPercentage).toBe(0);

    const form = emptySaleForm();
    form.platform = 'Amazon';
    form.lines = [
      {
        ...emptySaleLineForm(),
        productId: 'product-1',
        platformListingId: 'listing-1',
        economics,
      },
    ];

    const preview = computeSalePreview(form);
    expect(preview.cogs).toBe(50);
    expect(preview.profit).toBe(35);
  });

  it('allows sale when marketplace has no product listing', () => {
    const row = {
      ...emptyBulkSaleRow('Amazon'),
      productId: 'product-1',
      platformListingId: '',
      economics: economicsFromListing(noneTaxListing),
    };

    expect(validateBulkSaleRow(row, [product])).toBeNull();
  });

  it('uses sole listing when marketplace does not match', () => {
    const walkInListing: ProductPlatformListing = {
      ...noneTaxListing,
      id: 'listing-walkin',
      platform: 'Walk in',
    };
    const walkInProduct: Product = {
      ...product,
      platformListings: [walkInListing],
    };

    const row = {
      ...emptyBulkSaleRow('Amazon'),
      productId: 'product-1',
      platformListingId: 'listing-walkin',
      economics: economicsFromListing(walkInListing),
    };

    expect(validateBulkSaleRow(row, [walkInProduct])).toBeNull();
  });
});
