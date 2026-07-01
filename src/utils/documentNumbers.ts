import { firestoreService } from '../services/firestore';
import { localDateInputToUtc } from './firestoreDates';

export type DocumentPrefix = 'PO' | 'INV' | 'EXP';

const SEQUENCE_PAD = 4;

/** Calendar year from a local `<input type="date">` value. */
export function yearFromLocalDateInput(dateStr: string): number {
  return localDateInputToUtc(dateStr).getFullYear();
}

/** Format PO-2026-0001 style document numbers. */
export function formatDocumentNumber(prefix: DocumentPrefix, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_PAD, '0')}`;
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

export async function previewNextExpenseNumber(companyId: string, expenseDate: string): Promise<string> {
  const expenses = await firestoreService.expenses.getAll(companyId);
  const year = yearFromLocalDateInput(expenseDate);
  const numbers = expenses
    .filter((e) => !e.deleted && e.expenseNumber)
    .map((e) => e.expenseNumber!);
  return allocateDocumentNumber('EXP', year, numbers);
}

export async function allocateNextExpenseNumber(companyId: string, expenseDate: string): Promise<string> {
  return previewNextExpenseNumber(companyId, expenseDate);
}
