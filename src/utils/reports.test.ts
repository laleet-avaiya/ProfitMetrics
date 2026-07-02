import { describe, expect, it } from 'vitest';
import type { PeriodProfitSummary, PurchaseOrder } from '../types';
import {
  PurchaseOrderStatus,
  PurchasePaymentStatus,
} from '../types';
import {
  buildProfitLossStatement,
  computePendingPoBalance,
  computePendingPoCount,
  computePeriodSummary,
} from './reports';

function makeSummary(overrides: Partial<PeriodProfitSummary> = {}): PeriodProfitSummary {
  return {
    periodLabel: 'Test',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
    onlineSaleCount: 1,
    invoiceCount: 0,
    saleCount: 1,
    onlineRevenue: 1000,
    offlineRevenue: 0,
    grossRevenue: 1000,
    totalCogs: 400,
    totalShipping: 50,
    totalPlatformFees: 30,
    totalTax: 0,
    grossProfit: 520,
    totalExpenses: 120,
    excludedAutoExpenses: 0,
    netProfit: 400,
    netMarginPercent: 40,
    ...overrides,
  };
}

function makePurchase(balanceDue: number): PurchaseOrder {
  return {
    id: 'po-1',
    companyId: 'co-1',
    poNumber: 'PO-2026-0001',
    purchaseDate: new Date('2026-01-15'),
    status: PurchaseOrderStatus.ORDERED,
    paymentStatus: PurchasePaymentStatus.UNPAID,
    lines: [],
    subtotal: balanceDue,
    taxAmount: 0,
    total: balanceDue,
    totalPaid: 0,
    balanceDue,
    payments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('computePeriodSummary', () => {
  it('returns zero totals when there is no activity', () => {
    const summary = computePeriodSummary([], [], [], 'Jan 2026');

    expect(summary.grossRevenue).toBe(0);
    expect(summary.grossProfit).toBe(0);
    expect(summary.netProfit).toBe(0);
    expect(summary.netMarginPercent).toBe(0);
  });
});

describe('pending PO helpers', () => {
  it('sums balance due across purchase orders', () => {
    const purchases = [makePurchase(150), makePurchase(50)];
    expect(computePendingPoBalance(purchases)).toBe(200);
    expect(computePendingPoCount(purchases)).toBe(2);
  });

  it('ignores fully paid purchase orders in pending count', () => {
    const purchases = [makePurchase(0), makePurchase(75)];
    expect(computePendingPoCount(purchases)).toBe(1);
  });
});

describe('buildProfitLossStatement', () => {
  const summary = makeSummary();
  const purchases = [makePurchase(200)];

  it('uses paid expenses only for net profit', () => {
    const statement = buildProfitLossStatement(summary, purchases, 'paid');

    expect(statement.netProfit).toBe(400);
    expect(statement.lines.some((line) => line.label === 'Pending PO payments')).toBe(false);
    expect(statement.basisLabel).toBe('Paid expenses only');
  });

  it('subtracts pending PO balance in commitment view', () => {
    const statement = buildProfitLossStatement(summary, purchases, 'with-pending-po');

    expect(statement.netProfit).toBe(200);
    expect(statement.pendingPoBalance).toBe(200);
    expect(statement.lines.find((line) => line.label === 'Pending PO payments')?.value).toBe(-200);
    expect(statement.netMarginPercent).toBe(20);
  });
});
