import type { Expense, Vendor } from '../types';
import { TaxMode, TaxType } from '../types';
import type { Company } from '../types';
import { getCountryProfile } from '../constants/countries';
import { computeTaxAmount } from './profit';
import { createListingId } from './productDefaults';
import { localDateInputToUtc, localDateInputToUtcEndOfDay, nowUtc, utcToLocalDateInput } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface ExpenseFormState {
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  vendorId: string;
  reference: string;
  notes: string;
  taxType: (typeof TaxType)[keyof typeof TaxType];
  taxPercentage: string;
  taxMode: (typeof TaxMode)[keyof typeof TaxMode];
  taxAmountManual: boolean;
  taxAmount: string;
}

export function expenseTaxDefaults(company?: Company | null) {
  const profile = getCountryProfile(company?.country);
  return {
    taxType: TaxType.NONE as (typeof TaxType)[keyof typeof TaxType],
    taxPercentage: String(company?.defaultTaxPercentage ?? profile.defaultTaxPercentage),
    taxMode: (company?.defaultTaxMode ?? profile.defaultTaxMode) as (typeof TaxMode)[keyof typeof TaxMode],
  };
}

export function emptyExpenseForm(company?: Company | null): ExpenseFormState {
  const taxDefaults = expenseTaxDefaults(company);
  return {
    expenseDate: utcToLocalDateInput(new Date()),
    category: '',
    description: '',
    amount: '',
    vendorId: '',
    reference: '',
    notes: '',
    taxType: taxDefaults.taxType,
    taxPercentage: taxDefaults.taxPercentage,
    taxMode: taxDefaults.taxMode,
    taxAmountManual: false,
    taxAmount: '',
  };
}

export function computeExpenseInputTax(
  amount: number,
  taxType: ExpenseFormState['taxType'],
  taxPercentage: number,
  taxMode: ExpenseFormState['taxMode'],
  manualTaxAmount?: number
): number {
  if (taxType === TaxType.NONE || taxPercentage <= 0 || amount <= 0) return 0;
  if (manualTaxAmount != null && Number.isFinite(manualTaxAmount)) {
    return roundMoney(Math.max(0, manualTaxAmount));
  }
  return computeTaxAmount(amount, taxPercentage, taxMode);
}

export function expenseToForm(expense: Expense): ExpenseFormState {
  const hasTax = expense.taxType != null && expense.taxType !== TaxType.NONE;
  return {
    expenseDate: utcToLocalDateInput(expense.expenseDate),
    category: expense.category,
    description: expense.description,
    amount: String(expense.amount),
    vendorId: expense.vendorId ?? '',
    reference: expense.reference ?? '',
    notes: expense.notes ?? '',
    taxType: expense.taxType ?? TaxType.NONE,
    taxPercentage: String(expense.taxPercentage ?? 0),
    taxMode: expense.taxMode ?? TaxMode.INCLUSIVE,
    taxAmountManual: hasTax && expense.taxAmount != null,
    taxAmount: hasTax && expense.taxAmount != null ? String(expense.taxAmount) : '',
  };
}

export function buildExpenseFromForm(
  form: ExpenseFormState,
  companyId: string,
  vendors: Vendor[],
  expenseNumber: string | undefined,
  existing?: Expense
): Expense {
  const now = nowUtc();
  const amount = Math.max(0, parseFloat(form.amount) || 0);
  const selectedVendor = form.vendorId
    ? vendors.find((v) => v.id === form.vendorId)
    : undefined;

  const taxPercentage = Math.max(0, parseFloat(form.taxPercentage) || 0);
  const tracksTax = form.taxType !== TaxType.NONE && taxPercentage > 0;
  const manualTax =
    form.taxAmountManual && form.taxAmount.trim()
      ? parseFloat(form.taxAmount)
      : undefined;
  const taxAmount = tracksTax
    ? computeExpenseInputTax(amount, form.taxType, taxPercentage, form.taxMode, manualTax)
    : undefined;

  return {
    id: existing?.id ?? createListingId(),
    companyId,
    expenseNumber: expenseNumber ?? existing?.expenseNumber,
    expenseDate: localDateInputToUtc(form.expenseDate),
    category: form.category.trim(),
    description: form.description.trim(),
    amount: roundMoney(amount),
    vendorId: selectedVendor?.id,
    vendorName: selectedVendor?.name,
    reference: form.reference.trim() || undefined,
    notes: form.notes.trim() || undefined,
    taxType: tracksTax ? form.taxType : undefined,
    taxPercentage: tracksTax ? taxPercentage : undefined,
    taxMode: tracksTax ? form.taxMode : undefined,
    taxAmount: tracksTax && taxAmount != null && taxAmount > 0 ? taxAmount : undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function getExpenseInputTax(expense: Expense): number {
  return expense.taxAmount ?? 0;
}

export function formatExpenseTaxLabel(taxType: Expense['taxType']): string {
  if (taxType === TaxType.GST) return 'GST';
  if (taxType === TaxType.VAT) return 'VAT';
  if (taxType === TaxType.SALES_TAX) return 'Sales tax';
  return 'Tax';
}

export type DateFilter = 'all' | 'today' | '7d' | '30d';

export function dateFilterRange(filter: DateFilter): { from?: Date; to?: Date } {
  if (filter === 'all') return {};

  const today = utcToLocalDateInput(new Date());
  if (filter === 'today') {
    return {
      from: localDateInputToUtc(today),
      to: localDateInputToUtcEndOfDay(today),
    };
  }

  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (filter === '7d') d.setDate(d.getDate() - 6);
  if (filter === '30d') d.setDate(d.getDate() - 29);

  return {
    from: d,
    to: localDateInputToUtcEndOfDay(today),
  };
}

export function isDateInRange(date: Date, from?: Date, to?: Date): boolean {
  const t = date.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}
