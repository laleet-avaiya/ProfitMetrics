import type { Expense, Vendor } from '../types';
import { createListingId } from './productDefaults';
import { nowUtc } from './firestoreDates';

export interface VendorFormState {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  status: Vendor['status'];
}

export function emptyVendorForm(): VendorFormState {
  return {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    status: 'active',
  };
}

export function vendorToForm(vendor: Vendor): VendorFormState {
  return {
    name: vendor.name,
    contactName: vendor.contactName ?? '',
    email: vendor.email ?? '',
    phone: vendor.phone ?? '',
    website: vendor.website ?? '',
    notes: vendor.notes ?? '',
    status: vendor.status,
  };
}

export function buildVendorFromForm(
  form: VendorFormState,
  companyId: string,
  existing?: Vendor
): Vendor {
  const now = nowUtc();
  return {
    id: existing?.id ?? createListingId(),
    companyId,
    name: form.name.trim(),
    contactName: form.contactName.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    website: form.website.trim() || undefined,
    notes: form.notes.trim() || undefined,
    status: form.status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function getActiveVendors(vendors: Vendor[]): Vendor[] {
  return vendors.filter((v) => !v.deleted && v.status === 'active');
}

export function getExpenseVendorDisplay(expense: Expense): string | undefined {
  const name = expense.vendorName ?? expense.vendor;
  return name?.trim() || undefined;
}

export function sumExpensesByVendor(
  expenses: Expense[]
): Map<string, { count: number; total: number }> {
  const map = new Map<string, { count: number; total: number }>();
  for (const e of expenses) {
    if (!e.vendorId) continue;
    const prev = map.get(e.vendorId) ?? { count: 0, total: 0 };
    map.set(e.vendorId, { count: prev.count + 1, total: prev.total + e.amount });
  }
  return map;
}
