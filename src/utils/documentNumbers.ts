import { firestoreService } from '../services/firestore';
import { localDateInputToUtc } from './firestoreDates';

export type DocumentPrefix = 'PO' | 'INV' | 'EXP' | 'ORD';

const DEFAULT_SEQUENCE_PAD = 4;

/** Per-prefix zero-padding width. Sales use 6 digits (ORD-2026-000001). */
const SEQUENCE_PAD: Partial<Record<DocumentPrefix, number>> = {
  ORD: 6,
};

function padForPrefix(prefix: DocumentPrefix): number {
  return SEQUENCE_PAD[prefix] ?? DEFAULT_SEQUENCE_PAD;
}

/** Calendar year from a local `<input type="date">` value. */
export function yearFromLocalDateInput(dateStr: string): number {
  return localDateInputToUtc(dateStr).getFullYear();
}

/** Format PO-2026-0001 style document numbers. */
export function formatDocumentNumber(prefix: DocumentPrefix, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(padForPrefix(prefix), '0')}`;
}

function sequencePattern(prefix: DocumentPrefix, year: number): RegExp {
  return new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
}

/** Next sequence (1-based) from existing document numbers for a given prefix and year. */
export function nextSequenceFromExisting(
  prefix: DocumentPrefix,
  year: number,
  existingNumbers: string[]
): number {
  const pattern = sequencePattern(prefix, year);
  let max = 0;
  for (const value of existingNumbers) {
    const match = value.trim().match(pattern);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return max + 1;
}

export function allocateDocumentNumber(
  prefix: DocumentPrefix,
  year: number,
  existingNumbers: string[]
): string {
  const seq = nextSequenceFromExisting(prefix, year, existingNumbers);
  return formatDocumentNumber(prefix, year, seq);
}

export async function previewNextPoNumber(companyId: string, purchaseDate: string): Promise<string> {
  const purchases = await firestoreService.purchases.getAll(companyId);
  const year = yearFromLocalDateInput(purchaseDate);
  const numbers = purchases.filter((p) => !p.deleted).map((p) => p.poNumber);
  return allocateDocumentNumber('PO', year, numbers);
}

export async function allocateNextPoNumber(companyId: string, purchaseDate: string): Promise<string> {
  return previewNextPoNumber(companyId, purchaseDate);
}

export async function previewNextInvoiceNumber(companyId: string, invoiceDate: string): Promise<string> {
  const invoices = await firestoreService.invoices.getAll(companyId);
  const year = yearFromLocalDateInput(invoiceDate);
  const numbers = invoices.filter((i) => !i.deleted).map((i) => i.invoiceNumber);
  return allocateDocumentNumber('INV', year, numbers);
}

export async function allocateNextInvoiceNumber(companyId: string, invoiceDate: string): Promise<string> {
  return previewNextInvoiceNumber(companyId, invoiceDate);
}

async function counterFloorFromExisting(
  prefix: DocumentPrefix,
  year: number,
  fetchNumbers: () => Promise<string[]>
): Promise<number> {
  const numbers = await fetchNumbers();
  return nextSequenceFromExisting(prefix, year, numbers) - 1;
}

async function allocateFromCounter(
  companyId: string,
  prefix: DocumentPrefix,
  year: number,
  counterKey: string,
  fetchNumbers: () => Promise<string[]>
): Promise<string> {
  let floor = 0;
  const current = await firestoreService.counters.peek(companyId, counterKey);
  if (current === null) {
    floor = await counterFloorFromExisting(prefix, year, fetchNumbers);
  }
  const seq = await firestoreService.counters.next(companyId, counterKey, floor);
  return formatDocumentNumber(prefix, year, seq);
}

async function previewFromCounter(
  companyId: string,
  prefix: DocumentPrefix,
  year: number,
  counterKey: string,
  fetchNumbers: () => Promise<string[]>
): Promise<string> {
  const current = await firestoreService.counters.peek(companyId, counterKey);
  if (current !== null) {
    return formatDocumentNumber(prefix, year, current + 1);
  }
  const numbers = await fetchNumbers();
  return allocateDocumentNumber(prefix, year, numbers);
}

export async function previewNextExpenseNumber(companyId: string, expenseDate: string): Promise<string> {
  const year = yearFromLocalDateInput(expenseDate);
  return previewFromCounter(companyId, 'EXP', year, `EXP_${year}`, async () => {
    const expenses = await firestoreService.expenses.getAll(companyId);
    return expenses
      .filter((e) => !e.deleted && e.expenseNumber)
      .map((e) => e.expenseNumber!);
  });
}

export async function allocateNextExpenseNumber(companyId: string, expenseDate: string): Promise<string> {
  const year = yearFromLocalDateInput(expenseDate);
  return allocateFromCounter(companyId, 'EXP', year, `EXP_${year}`, async () => {
    const expenses = await firestoreService.expenses.getAll(companyId);
    return expenses
      .filter((e) => !e.deleted && e.expenseNumber)
      .map((e) => e.expenseNumber!);
  });
}

export async function previewNextSaleNumber(companyId: string, orderDate: string): Promise<string> {
  const year = yearFromLocalDateInput(orderDate);
  return previewFromCounter(companyId, 'ORD', year, `ORD_${year}`, async () => {
    const sales = await firestoreService.sales.getAll(companyId);
    return sales
      .filter((s) => !s.deleted && s.orderNumber)
      .map((s) => s.orderNumber!);
  });
}

/**
 * Allocate the definitive order number at save time. Uses an atomic counter so
 * two concurrent sale creations can never collide on the same ORD number.
 */
export async function allocateNextSaleNumber(companyId: string, orderDate: string): Promise<string> {
  const year = yearFromLocalDateInput(orderDate);
  return allocateFromCounter(companyId, 'ORD', year, `ORD_${year}`, async () => {
    const sales = await firestoreService.sales.getAll(companyId);
    return sales
      .filter((s) => !s.deleted && s.orderNumber)
      .map((s) => s.orderNumber!);
  });
}
