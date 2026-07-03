import { describe, expect, it } from 'vitest';
import { computeStockReconciliation } from './stockReconciliation';
import { InvoiceStatus, PurchaseOrderStatus, SaleStatus } from '../types';

describe('computeStockReconciliation', () => {
  it('computes expected stock from receipts minus sales', () => {
    const summary = computeStockReconciliation({
      products: [{ id: 'p1', companyId: 'c1', name: 'Widget', status: 'active', platformListings: [], createdAt: new Date(), updatedAt: new Date() }],
      stock: [{
        id: 'p1',
        companyId: 'c1',
        productId: 'p1',
        productName: 'Widget',
        quantityOnHand: 10,
        avgPurchasePrice: 5,
        avgSellingPrice: 10,
        totalValue: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
      purchases: [{
        id: 'po1',
        companyId: 'c1',
        poNumber: 'PO-1',
        vendorId: 'v1',
        vendorName: 'Vendor',
        purchaseDate: new Date(),
        status: PurchaseOrderStatus.RECEIVED,
        paymentStatus: 'unpaid',
        lines: [{
          id: 'l1',
          productId: 'p1',
          productName: 'Widget',
          quantityOrdered: 10,
          quantityReceived: 10,
          purchasePrice: 5,
          sellingPrice: 10,
          lineTotal: 50,
        }],
        subtotal: 50,
        taxAmount: 0,
        total: 50,
        totalPaid: 0,
        balanceDue: 50,
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
      sales: [{
        id: 's1',
        companyId: 'c1',
        orderId: 'ORD-1',
        orderDate: new Date(),
        productId: 'p1',
        productName: 'Widget',
        platform: 'Amazon',
        quantity: 3,
        status: SaleStatus.DELIVERED,
        economics: {
          purchasePrice: 5,
          sellingPrice: 10,
          shippingCost: 0,
          taxType: 'none',
          taxPercentage: 0,
          taxMode: 'inclusive',
          taxAmount: 0,
        },
        grossRevenue: 30,
        totalCosts: 15,
        platformFees: 0,
        profit: 15,
        profitMarginPercent: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
      invoices: [{
        id: 'i1',
        companyId: 'c1',
        invoiceNumber: 'INV-1',
        invoiceDate: new Date(),
        status: InvoiceStatus.SENT,
        paymentStatus: 'unpaid',
        lines: [{
          id: 'il1',
          productId: 'p1',
          productName: 'Widget',
          quantity: 2,
          unitPrice: 10,
          purchasePrice: 5,
          taxType: 'none',
          taxPercentage: 0,
          taxMode: 'inclusive',
          lineSubtotal: 20,
          lineTotal: 20,
        }],
        subtotal: 20,
        taxAmount: 0,
        total: 20,
        totalPaid: 0,
        balanceDue: 20,
        totalCogs: 10,
        profit: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    });

    const row = summary.rows.find((r) => r.productId === 'p1');
    expect(row).toBeDefined();
    expect(row?.receivedQty).toBe(10);
    expect(row?.marketplaceSoldQty).toBe(3);
    expect(row?.offlineSoldQty).toBe(2);
    expect(row?.expectedOnHand).toBe(5);
    expect(row?.recordedOnHand).toBe(10);
    expect(row?.difference).toBe(5);
    expect(summary.outOfSyncCount).toBe(1);
  });
});
