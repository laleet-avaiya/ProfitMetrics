export * from '../models';

import type { DeliveryMode, PlatformFeeKind, TaxMode, TaxType } from '../models/tax';

export {
  DeliveryMode,
  DeliveryMode as DeliveryModeEnum,
  PlatformFeeKind,
  PlatformFeeKind as PlatformFeeKindEnum,
  TaxMode,
  TaxMode as TaxModeEnum,
  TaxType,
  TaxType as TaxTypeEnum,
} from '../models/tax';

// ─── Business entities ───────────────────────────────────────────────────────

export interface ProductPlatformListing {
  id: string;
  /** e.g. Amazon, Shopify, Noon — from company Configuration */
  platform: string;
  /** Optional marketplace identifiers */
  platformSku?: string;
  listingUrl?: string;
  /** Per-unit economics (company currency) */
  purchasePrice: number;
  sellingPrice: number;
  /** Delivery / shipping fee per unit (individual delivery mode) */
  shippingCost: number;
  /** Default delivery mode for this listing — individual per unit or group shipment */
  deliveryMode?: DeliveryMode;
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

export interface SaleLine {
  id: string;
  productId: string;
  productName: string;
  platformListingId?: string;
  quantity: number;
  /** Per-line economics snapshot */
  economics: SaleLineEconomics;
}

export interface Sale {
  id: string;
  companyId: string;
  /** External order ID from the marketplace */
  orderId: string;
  /** Business order date — stored as UTC instant (local calendar day on save) */
  orderDate: Date;
  /** Order lines — multi-item marketplace orders. Legacy sales omit this. */
  lines?: SaleLine[];
  /** Individual per-line delivery vs one combined shipment fee */
  deliveryMode?: DeliveryMode;
  /** Combined delivery fee when deliveryMode is group */
  orderShippingCost?: number;
  orderDeliveryTaxPercentage?: number;
  orderDeliveryTaxMode?: TaxMode;
  /** Denormalized from first line / totals for list views and legacy reads */
  productId: string;
  productName: string;
  platform: string;
  platformListingId?: string;
  quantity: number;
  /** pending · shipped · delivered · returned · cancelled — omitted on legacy records */
  status?: SaleStatus;
  /** Tracking only — how marketplace payout was received */
  paymentMode?: PaymentMode;
  /** Tracking only — unpaid · partial · paid */
  paymentStatus?: PurchasePaymentStatus;
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
  /** Auto-generated expense number, e.g. EXP-2026-0001 */
  expenseNumber?: string;
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
  /** When set, this expense was auto-created from a purchase order payment */
  purchaseOrderId?: string;
  purchasePaymentId?: string;
  autoGenerated?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

// ─── Inventory stock (separate from Product catalog) ────────────────────────

/** Per-product inventory — one record per product per company. */
export interface ProductStock {
  id: string;
  companyId: string;
  productId: string;
  /** Denormalized for display */
  productName: string;
  quantityOnHand: number;
  /** Weighted average unit purchase cost */
  avgPurchasePrice: number;
  /** Weighted average suggested selling price from receipts */
  avgSellingPrice: number;
  /** quantityOnHand × avgPurchasePrice */
  totalValue: number;
  lastReceivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Purchase orders ─────────────────────────────────────────────────────────

export const PurchaseOrderStatus = {
  DRAFT: 'draft',
  ORDERED: 'ordered',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
} as const;

export type PurchaseOrderStatus =
  (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const PurchasePaymentStatus = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const;

export type PurchasePaymentStatus =
  (typeof PurchasePaymentStatus)[keyof typeof PurchasePaymentStatus];

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  /** Unit purchase price */
  purchasePrice: number;
  /** Unit selling price (optional, from vendor quote) */
  sellingPrice: number;
  taxType?: TaxType;
  taxPercentage?: number;
  taxMode?: TaxMode;
  /** Total input tax for this line (ordered qty) */
  taxAmount?: number;
  /** Line subtotal before tax (ordered qty × purchasePrice) */
  lineSubtotal: number;
  /** Line total including tax */
  lineTotal: number;
}

export interface PurchasePayment {
  id: string;
  paymentDate: Date;
  amount: number;
  paymentMode?: PaymentMode;
  reference?: string;
  notes?: string;
  /** Linked auto-generated expense */
  expenseId?: string;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  /** Auto-generated PO number, e.g. PO-2026-0001 */
  poNumber: string;
  /** Optional vendor quote or external reference */
  reference?: string;
  /** Business date of the purchase order */
  purchaseDate: Date;
  vendorId?: string;
  vendorName?: string;
  status: PurchaseOrderStatus;
  paymentStatus: PurchasePaymentStatus;
  lines: PurchaseOrderLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  totalPaid: number;
  balanceDue: number;
  payments: PurchasePayment[];
  notes?: string;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

// ─── Customers (offline sales) ───────────────────────────────────────────────

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** TRN / GSTIN for B2B invoicing */
  taxId?: string;
  notes?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

// ─── Invoices (offline sales) ─────────────────────────────────────────────────

export const InvoiceStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  VOID: 'void',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export interface InvoiceLine {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  /** Unit selling price */
  unitPrice: number;
  /** Unit COGS snapshot for profit */
  purchasePrice: number;
  taxType?: TaxType;
  taxPercentage?: number;
  taxMode?: TaxMode;
  taxAmount?: number;
  lineSubtotal: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  customerId?: string;
  customerName?: string;
  status: InvoiceStatus;
  paymentStatus: PurchasePaymentStatus;
  lines: InvoiceLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  totalPaid: number;
  balanceDue: number;
  totalCogs: number;
  profit: number;
  notes?: string;
  /** Whether stock has been deducted for this invoice */
  stockApplied?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

// ─── Payments (invoice-linked or direct / marketplace payouts) ────────────────

export const PaymentMode = {
  CASH: 'cash',
  BANK_ACCOUNT: 'bank_account',
} as const;

export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const PaymentKind = {
  INVOICE: 'invoice',
  DIRECT: 'direct',
  MARKETPLACE_PAYOUT: 'marketplace_payout',
} as const;

export type PaymentKind = (typeof PaymentKind)[keyof typeof PaymentKind];

export interface Payment {
  id: string;
  companyId: string;
  paymentDate: Date;
  amount: number;
  kind: PaymentKind;
  paymentMode?: PaymentMode;
  invoiceId?: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  /** e.g. Amazon, Shopify — for marketplace lump-sum payouts */
  platform?: string;
  reference?: string;
  notes?: string;
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
  /** Online marketplace orders in period */
  onlineSaleCount: number;
  /** Offline invoices in period (excludes draft & void) */
  invoiceCount: number;
  /** onlineSaleCount + invoiceCount */
  saleCount: number;
  /** Revenue from online sales */
  onlineRevenue: number;
  /** Revenue from offline invoices */
  offlineRevenue: number;
  grossRevenue: number;
  totalCogs: number;
  totalShipping: number;
  totalPlatformFees: number;
  totalTax: number;
  /** Profit from online sales + offline invoices before operating expenses */
  grossProfit: number;
  /** Operating expenses used in net profit (excludes double-counted auto expenses) */
  totalExpenses: number;
  /** Auto expenses excluded from net profit (sale fees already in order profit, inventory purchases capitalized) */
  excludedAutoExpenses: number;
  netProfit: number;
  netMarginPercent: number;
}
