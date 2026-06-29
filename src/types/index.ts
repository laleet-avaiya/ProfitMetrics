// ─── Company (tenant) ───────────────────────────────────────────────────────

export interface Company {
  id: string;
  userId: string;
  name: string;
  /** ISO-style business country: AE (UAE) or IN (India) */
  country: string;
  /** IANA timezone for reports (e.g. Asia/Dubai, Asia/Kolkata) */
  timezone?: string;
  /** Tax registration — TRN in UAE, GSTIN in India (stored in `trn` field) */
  trn?: string;
  address?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  logo?: string;
  currency: string;
  /** Defaults applied to new product platform listings & sales */
  defaultTaxType: TaxType;
  defaultTaxMode: TaxMode;
  defaultTaxPercentage: number;
  subscriptionStart?: Date;
  subscriptionEnd?: Date;
  /** Version of T&C / usage policy accepted by the company */
  termsVersion?: string;
  /** When T&C were accepted (UTC) */
  termsAcceptedAt?: Date;
  /** When the usage policy was accepted (UTC) */
  usagePolicyAcceptedAt?: Date;
  /** Auth user id who recorded acceptance */
  legalAcceptedByUserId?: string;
  /** UTC instant when the company record was created */
  createdAt: Date;
  /** UTC instant when the company record was last updated */
  updatedAt: Date;
}

// ─── Tax ────────────────────────────────────────────────────────────────────

export const TaxType = {
  NONE: 'none',
  VAT: 'vat',
  GST: 'gst',
  SALES_TAX: 'sales_tax',
} as const;

export type TaxType = (typeof TaxType)[keyof typeof TaxType];

/** How tax applies to the selling price on a listing or order. */
export const TaxMode = {
  /** Tax is included in selling price (common in UAE/UK B2C). */
  INCLUSIVE: 'inclusive',
  /** Tax is added on top of selling price. */
  EXCLUSIVE: 'exclusive',
  /** Tax is tracked separately; does not change revenue math. */
  PASS_THROUGH: 'pass_through',
} as const;

export type TaxMode = (typeof TaxMode)[keyof typeof TaxMode];

/** How a platform fee is entered on a listing or sale line. */
export const PlatformFeeKind = {
  FIXED: 'fixed',
  PERCENT: 'percent',
} as const;

export type PlatformFeeKind = (typeof PlatformFeeKind)[keyof typeof PlatformFeeKind];

/** Per-component tax settings shared by listings and sale snapshots. */
export interface LineTaxSettings {
  purchaseTaxPercentage: number;
  purchaseTaxMode: TaxMode;
  sellingTaxPercentage: number;
  sellingTaxMode: TaxMode;
  deliveryTaxPercentage: number;
  deliveryTaxMode: TaxMode;
  platformFeeTaxPercentage: number;
  platformFeeTaxMode: TaxMode;
}

// ─── Product & platform listings ──────────────────────────────────────────────

export interface ProductPlatformListing {
  id: string;
  /** e.g. Amazon, Shopify, Noon, eBay, Flipkart, Custom */
  platform: string;
  /** Optional marketplace identifiers */
  platformSku?: string;
  listingUrl?: string;
  /** Per-unit economics (company currency) */
  purchasePrice: number;
  sellingPrice: number;
  /** Delivery / shipping fee per unit */
  shippingCost: number;
  /** Fixed fee per unit (FBA, referral flat fee, etc.) */
  platformFee?: number;
  /** Percent of gross revenue (e.g. Amazon ~15%) */
  platformFeePercent?: number;
  /** Whether platform fee is a fixed amount or % of selling price */
  platformFeeKind?: PlatformFeeKind;
  /** GST/VAT type for this listing (labels all tax fields) */
  taxType: TaxType;
  /** @deprecated Use sellingTaxPercentage — kept in sync on save */
  taxPercentage: number;
  /** @deprecated Use sellingTaxMode — kept in sync on save */
  taxMode: TaxMode;
  /** Input tax % on purchase price (ITC) */
  purchaseTaxPercentage?: number;
  purchaseTaxMode?: TaxMode;
  /** Output tax % on selling price */
  sellingTaxPercentage?: number;
  sellingTaxMode?: TaxMode;
  /** Input tax % on delivery fee (ITC) */
  deliveryTaxPercentage?: number;
  deliveryTaxMode?: TaxMode;
  /** Input tax % on platform fees (ITC) */
  platformFeeTaxPercentage?: number;
  platformFeeTaxMode?: TaxMode;
  notes?: string;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  /** Base64 or URL — optional */
  imageUrl?: string;
  status: 'active' | 'archived';
  platformListings: ProductPlatformListing[];
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

// ─── Sales (orders) ─────────────────────────────────────────────────────────

/** Fulfillment / outcome status for return-rate and order tracking. */
export const SaleStatus = {
  PENDING: 'pending',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
} as const;

export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export interface SaleLineEconomics {
  purchasePrice: number;
  sellingPrice: number;
  shippingCost: number;
  platformFee?: number;
  platformFeePercent?: number;
  platformFeeKind?: PlatformFeeKind;
  taxType: TaxType;
  /** Output tax on selling — legacy field name */
  taxPercentage: number;
  taxMode: TaxMode;
  /** Stored computed output tax for this line (selling) */
  taxAmount: number;
  /** Snapshot of per-component tax settings */
  purchaseTaxPercentage?: number;
  purchaseTaxMode?: TaxMode;
  sellingTaxPercentage?: number;
  sellingTaxMode?: TaxMode;
  deliveryTaxPercentage?: number;
  deliveryTaxMode?: TaxMode;
  platformFeeTaxPercentage?: number;
  platformFeeTaxMode?: TaxMode;
  /** Input tax (ITC) components */
  purchaseTaxAmount?: number;
  deliveryTaxAmount?: number;
  platformFeeTaxAmount?: number;
  /** Sum of input tax on purchase, delivery, and platform fees */
  inputTaxAmount?: number;
}

export interface Sale {
  id: string;
  companyId: string;
  /** External order ID from the marketplace */
  orderId: string;
  /** Business order date — stored as UTC instant (local calendar day on save) */
  orderDate: Date;
  productId: string;
  productName: string;
  platform: string;
  platformListingId?: string;
  quantity: number;
  /** pending · shipped · delivered · returned · cancelled — omitted on legacy records */
  status?: SaleStatus;
  /** Reverse logistics, restocking, return shipping — reduces profit */
  returnCharges?: number;
  returnTaxPercentage?: number;
  returnTaxMode?: TaxMode;
  /** Input tax (ITC) on return charges */
  returnTaxAmount?: number;
  /** When the return was recorded (business date) */
  returnedAt?: Date;
  /** Marketplace / carrier cancellation fee — reduces profit */
  cancellationCharges?: number;
  cancellationTaxPercentage?: number;
  cancellationTaxMode?: TaxMode;
  /** Input tax (ITC) on cancellation charges */
  cancellationTaxAmount?: number;
  /** When the cancellation was recorded (business date) */
  cancelledAt?: Date;
  /** Carrier / courier tracking number for delivery */
  trackingId?: string;
  /** Snapshot of economics at time of sale (may differ from product defaults) */
  economics: SaleLineEconomics;
  /** Computed and stored for fast reporting */
  grossRevenue: number;
  totalCosts: number;
  platformFees: number;
  profit: number;
  profitMarginPercent: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

// ─── Expenses ───────────────────────────────────────────────────────────────

/** Auto-generated expense lines linked to a sale order */
export const SaleExpenseKind = {
  PLATFORM_FEES: 'platform_fees',
  DELIVERY: 'delivery',
  RETURN_CHARGES: 'return_charges',
  CANCELLATION_CHARGES: 'cancellation_charges',
} as const;

export type SaleExpenseKind = (typeof SaleExpenseKind)[keyof typeof SaleExpenseKind];

export interface Vendor {
  id: string;
  companyId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

export interface Expense {
  id: string;
  companyId: string;
  /** Business expense date — stored as UTC instant (local calendar day on save) */
  expenseDate: Date;
  category: string;
  description: string;
  amount: number;
  /** Linked vendor record */
  vendorId?: string;
  /** Denormalized vendor name at time of expense (for reports if vendor is renamed/deleted) */
  vendorName?: string;
  /** Legacy free-text vendor — prefer vendorName for display */
  vendor?: string;
  reference?: string;
  notes?: string;
  /** Optional input tax (GST/VAT) for ITC / return filing — portion of amount */
  taxType?: TaxType;
  taxPercentage?: number;
  taxMode?: TaxMode;
  /** GST/VAT amount included in or on top of `amount` */
  taxAmount?: number;
  /** When set, this expense was auto-created from a sale */
  saleId?: string;
  saleExpenseKind?: SaleExpenseKind;
  autoGenerated?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

// ─── Reporting aggregates ─────────────────────────────────────────────────────

export interface PeriodProfitSummary {
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  saleCount: number;
  grossRevenue: number;
  totalCogs: number;
  totalShipping: number;
  totalPlatformFees: number;
  totalTax: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
}
