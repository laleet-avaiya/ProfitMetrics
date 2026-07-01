import { normalizeSaleStatus } from '../constants/saleStatuses';
import { firestoreService } from '../services/firestore';
import type { Expense, Sale } from '../types';
import { SaleExpenseKind, SaleStatus, TaxType } from '../types';
import { allocateNextExpenseNumber } from './documentNumbers';
import { createListingId } from './productDefaults';
import { nowUtc, utcToLocalDateInput } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const ALL_SALE_EXPENSE_KINDS: SaleExpenseKind[] = [
  SaleExpenseKind.PLATFORM_FEES,
  SaleExpenseKind.DELIVERY,
  SaleExpenseKind.RETURN_CHARGES,
  SaleExpenseKind.CANCELLATION_CHARGES,
];

interface SaleExpenseSpec {
  kind: SaleExpenseKind;
  category: string;
  description: string;
  expenseDate: Date;
  amount: number;
  taxType?: Expense['taxType'];
  taxPercentage?: number;
  taxMode?: Expense['taxMode'];
  taxAmount?: number;
}

function tracksTax(sale: Sale): boolean {
  return sale.economics.taxType !== TaxType.NONE;
}

function buildPlatformFeesSpec(sale: Sale): SaleExpenseSpec | null {
  const amount = roundMoney(sale.platformFees ?? 0);
  if (amount <= 0) return null;

  const e = sale.economics;
  const spec: SaleExpenseSpec = {
    kind: SaleExpenseKind.PLATFORM_FEES,
    category: 'Platform Fees',
    description: `Platform fees — Order ${sale.orderId} (${sale.platform})`,
    expenseDate: sale.orderDate,
    amount,
  };

  if (tracksTax(sale) && (e.platformFeeTaxAmount ?? 0) > 0) {
    spec.taxType = e.taxType;
    spec.taxPercentage = e.platformFeeTaxPercentage ?? 0;
    spec.taxMode = e.platformFeeTaxMode;
    spec.taxAmount = e.platformFeeTaxAmount;
  }

  return spec;
}

function buildDeliverySpec(sale: Sale): SaleExpenseSpec | null {
  const qty = Math.max(1, sale.quantity);
  const amount = roundMoney(Math.max(0, sale.economics.shippingCost) * qty);
  if (amount <= 0) return null;

  const e = sale.economics;
  const spec: SaleExpenseSpec = {
    kind: SaleExpenseKind.DELIVERY,
    category: 'Delivery & Shipping',
    description: `Delivery cost — Order ${sale.orderId} (${sale.platform})`,
    expenseDate: sale.orderDate,
    amount,
  };

  if (tracksTax(sale) && (e.deliveryTaxAmount ?? 0) > 0) {
    spec.taxType = e.taxType;
    spec.taxPercentage = e.deliveryTaxPercentage ?? 0;
    spec.taxMode = e.deliveryTaxMode;
    spec.taxAmount = e.deliveryTaxAmount;
  }

  return spec;
}

function buildReturnChargesSpec(sale: Sale): SaleExpenseSpec | null {
  if (normalizeSaleStatus(sale.status) !== SaleStatus.RETURNED) return null;

  const amount = roundMoney(sale.returnCharges ?? 0);
  if (amount <= 0) return null;

  const spec: SaleExpenseSpec = {
    kind: SaleExpenseKind.RETURN_CHARGES,
    category: 'Returns & Refunds',
    description: `Return charges — Order ${sale.orderId}`,
    expenseDate: sale.returnedAt ?? sale.orderDate,
    amount,
  };

  if (tracksTax(sale) && (sale.returnTaxAmount ?? 0) > 0) {
    spec.taxType = sale.economics.taxType;
    spec.taxPercentage = sale.returnTaxPercentage ?? 0;
    spec.taxMode = sale.returnTaxMode;
    spec.taxAmount = sale.returnTaxAmount;
  }

  return spec;
}

function buildCancellationChargesSpec(sale: Sale): SaleExpenseSpec | null {
  if (normalizeSaleStatus(sale.status) !== SaleStatus.CANCELLED) return null;

  const amount = roundMoney(sale.cancellationCharges ?? 0);
  if (amount <= 0) return null;

  const spec: SaleExpenseSpec = {
    kind: SaleExpenseKind.CANCELLATION_CHARGES,
    category: 'Cancellation Fees',
    description: `Cancellation charges — Order ${sale.orderId}`,
    expenseDate: sale.cancelledAt ?? sale.orderDate,
    amount,
  };

  if (tracksTax(sale) && (sale.cancellationTaxAmount ?? 0) > 0) {
    spec.taxType = sale.economics.taxType;
    spec.taxPercentage = sale.cancellationTaxPercentage ?? 0;
    spec.taxMode = sale.cancellationTaxMode;
    spec.taxAmount = sale.cancellationTaxAmount;
  }

  return spec;
}

function specForKind(sale: Sale, kind: SaleExpenseKind): SaleExpenseSpec | null {
  switch (kind) {
    case SaleExpenseKind.PLATFORM_FEES:
      return buildPlatformFeesSpec(sale);
    case SaleExpenseKind.DELIVERY:
      return buildDeliverySpec(sale);
    case SaleExpenseKind.RETURN_CHARGES:
      return buildReturnChargesSpec(sale);
    case SaleExpenseKind.CANCELLATION_CHARGES:
      return buildCancellationChargesSpec(sale);
    default:
      return null;
  }
}

function expenseFromSpec(
  sale: Sale,
  spec: SaleExpenseSpec,
  expenseNumber: string,
  existing?: Expense
): Expense {
  const now = nowUtc();
  return {
    id: existing?.id ?? createListingId(),
    companyId: sale.companyId,
    expenseNumber,
    expenseDate: spec.expenseDate,
    category: spec.category,
    description: spec.description,
    amount: spec.amount,
    vendorName: sale.platform,
    reference: sale.orderId,
    notes: 'Auto-generated from sale',
    taxType: spec.taxType,
    taxPercentage: spec.taxPercentage,
    taxMode: spec.taxMode,
    taxAmount: spec.taxAmount,
    saleId: sale.id,
    saleExpenseKind: spec.kind,
    autoGenerated: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Create or update linked expenses for a sale; remove stale auto-generated lines. */
export async function syncSaleExpenses(companyId: string, sale: Sale): Promise<void> {
  const allExpenses = await firestoreService.expenses.getAll(companyId);
  const linked = allExpenses.filter(
    (e) => e.saleId === sale.id && e.autoGenerated && !e.deleted
  );

  for (const kind of ALL_SALE_EXPENSE_KINDS) {
    const existing = linked.find((e) => e.saleExpenseKind === kind);
    const spec = specForKind(sale, kind);

    if (!spec) {
      if (existing) {
        await firestoreService.expenses.delete(companyId, existing.id);
      }
      continue;
    }

    const expenseNumber =
      existing?.expenseNumber ??
      (await allocateNextExpenseNumber(companyId, utcToLocalDateInput(spec.expenseDate)));
    const expense = expenseFromSpec(sale, spec, expenseNumber, existing);

    if (existing) {
      await firestoreService.expenses.update(companyId, existing.id, expense);
    } else {
      await firestoreService.expenses.create(companyId, expense);
    }
  }
}

/** Soft-delete all auto-generated expenses linked to a sale. */
export async function deleteSaleLinkedExpenses(
  companyId: string,
  saleId: string
): Promise<void> {
  const allExpenses = await firestoreService.expenses.getAll(companyId);
  const linked = allExpenses.filter(
    (e) => e.saleId === saleId && e.autoGenerated && !e.deleted
  );

  await Promise.all(
    linked.map((expense) => firestoreService.expenses.delete(companyId, expense.id))
  );
}
