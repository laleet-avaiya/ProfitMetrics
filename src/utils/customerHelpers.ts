import type { Customer, Invoice, Payment } from '../types';
import { isReportableInvoice } from './reports';
import { createListingId } from './productDefaults';
import { nowUtc } from './firestoreDates';

export interface CustomerFormState {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
  status: Customer['status'];
}

export function emptyCustomerForm(): CustomerFormState {
  return {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    notes: '',
    status: 'active',
  };
}

export function customerToForm(customer: Customer): CustomerFormState {
  return {
    name: customer.name,
    contactName: customer.contactName ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    address: customer.address ?? '',
    taxId: customer.taxId ?? '',
    notes: customer.notes ?? '',
    status: customer.status,
  };
}

export function buildCustomerFromForm(
  form: CustomerFormState,
  companyId: string,
  existing?: Customer
): Customer {
  const now = nowUtc();
  return {
    id: existing?.id ?? createListingId(),
    companyId,
    name: form.name.trim(),
    contactName: form.contactName.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    address: form.address.trim() || undefined,
    taxId: form.taxId.trim() || undefined,
    notes: form.notes.trim() || undefined,
    status: form.status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function getActiveCustomers(customers: Customer[]): Customer[] {
  return customers.filter((c) => !c.deleted && c.status === 'active');
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface CustomerLedgerSummary {
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
  openInvoices: number;
}

export interface CustomerLedgerEntry {
  id: string;
  date: Date;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  invoiceId?: string;
  paymentId?: string;
}

export interface CustomerLedgerResult extends CustomerLedgerSummary {
  entries: CustomerLedgerEntry[];
}

export function buildCustomerLedger(
  customerId: string,
  invoices: Invoice[],
  payments: Payment[]
): CustomerLedgerResult {
  const customerInvoices = invoices.filter(
    (i) => !i.deleted && i.customerId === customerId && isReportableInvoice(i)
  );
  const customerPayments = payments.filter(
    (p) => !p.deleted && p.customerId === customerId
  );

  const entries: CustomerLedgerEntry[] = [];

  for (const inv of customerInvoices) {
    entries.push({
      id: `inv-${inv.id}`,
      date: inv.invoiceDate,
      type: 'invoice',
      reference: inv.invoiceNumber,
      description: `Invoice — ${inv.lines.length} line${inv.lines.length === 1 ? '' : 's'}`,
      debit: inv.total,
      credit: 0,
      invoiceId: inv.id,
    });
  }

  for (const payment of customerPayments) {
    let description = 'Payment received';
    if (payment.kind === 'invoice' && payment.invoiceNumber) {
      description = `Payment for invoice ${payment.invoiceNumber}`;
    } else if (payment.kind === 'marketplace_payout' && payment.platform) {
      description = `${payment.platform} payout`;
    } else if (payment.kind === 'direct') {
      description = 'Direct payment';
    }

    entries.push({
      id: `pay-${payment.id}`,
      date: payment.paymentDate,
      type: 'payment',
      reference: payment.reference ?? payment.invoiceNumber ?? '—',
      description,
      debit: 0,
      credit: payment.amount,
      invoiceId: payment.invoiceId,
      paymentId: payment.id,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  const totalInvoiced = roundMoney(customerInvoices.reduce((s, i) => s + i.total, 0));
  const totalPaid = roundMoney(customerPayments.reduce((s, p) => s + p.amount, 0));
  const balanceDue = roundMoney(customerInvoices.reduce((s, i) => s + i.balanceDue, 0));
  const openInvoices = customerInvoices.filter((i) => i.balanceDue > 0).length;

  return {
    totalInvoiced,
    totalPaid,
    balanceDue,
    openInvoices,
    entries,
  };
}

export function buildCustomerSummary(
  customerId: string,
  invoices: Invoice[],
  payments: Payment[]
): CustomerLedgerSummary {
  const { totalInvoiced, totalPaid, balanceDue, openInvoices } = buildCustomerLedger(
    customerId,
    invoices,
    payments
  );
  return { totalInvoiced, totalPaid, balanceDue, openInvoices };
}
