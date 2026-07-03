import type { Customer, Payment, Sale } from '../types';
import { SaleStatus } from '../types';
import { getSaleDisplayProductName } from './saleLines';
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
  type: 'sale' | 'payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  saleId?: string;
  paymentId?: string;
}

export interface CustomerLedgerResult extends CustomerLedgerSummary {
  entries: CustomerLedgerEntry[];
}

function saleTotal(sale: Sale): number {
  return sale.total ?? sale.grossRevenue;
}

function saleBalance(sale: Sale): number {
  if (sale.balanceDue != null) return sale.balanceDue;
  return Math.max(0, saleTotal(sale) - (sale.totalPaid ?? 0));
}

function isReceivableSale(sale: Sale): boolean {
  return !sale.deleted && sale.status !== SaleStatus.CANCELLED;
}

export function buildCustomerLedger(
  customerId: string,
  payments: Payment[],
  sales: Sale[] = []
): CustomerLedgerResult {
  const customerSales = sales.filter(
    (s) => isReceivableSale(s) && s.customerId === customerId
  );
  const customerPayments = payments.filter(
    (p) => !p.deleted && p.customerId === customerId
  );

  const entries: CustomerLedgerEntry[] = [];

  for (const sale of customerSales) {
    entries.push({
      id: `sale-${sale.id}`,
      date: sale.orderDate,
      type: 'sale',
      reference: sale.orderNumber ?? sale.orderId ?? getSaleDisplayProductName(sale),
      description: `Order — ${getSaleDisplayProductName(sale)}`,
      debit: saleTotal(sale),
      credit: 0,
      saleId: sale.id,
    });
  }

  for (const payment of customerPayments) {
    let description = 'Payment received';
    if (payment.kind === 'sale' && payment.saleOrderNumber) {
      description = `Payment for order ${payment.saleOrderNumber}`;
    } else if (payment.kind === 'marketplace_payout' && payment.platform) {
      description = `${payment.platform} payout`;
    } else if (payment.kind === 'direct') {
      description = 'Direct payment';
    }

    entries.push({
      id: `pay-${payment.id}`,
      date: payment.paymentDate,
      type: 'payment',
      reference: payment.reference ?? payment.saleOrderNumber ?? '—',
      description,
      debit: 0,
      credit: payment.amount,
      saleId: payment.saleId,
      paymentId: payment.id,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  const totalInvoiced = roundMoney(
    customerSales.reduce((s, sale) => s + saleTotal(sale), 0)
  );
  const totalPaid = roundMoney(customerPayments.reduce((s, p) => s + p.amount, 0));
  const balanceDue = roundMoney(
    customerSales.reduce((s, sale) => s + saleBalance(sale), 0)
  );
  const openInvoices = customerSales.filter((sale) => saleBalance(sale) > 0).length;

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
  payments: Payment[],
  sales: Sale[] = []
): CustomerLedgerSummary {
  const { totalInvoiced, totalPaid, balanceDue, openInvoices } = buildCustomerLedger(
    customerId,
    payments,
    sales
  );
  return { totalInvoiced, totalPaid, balanceDue, openInvoices };
}
