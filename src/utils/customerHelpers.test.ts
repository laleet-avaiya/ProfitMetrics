import { describe, expect, it } from 'vitest';
import type { Sale } from '../types';
import {
  customerFilterOptionsFromSales,
  customerSnapshotFromCustomer,
  getSaleCustomerName,
} from './customerHelpers';

describe('customer denormalization', () => {
  const baseCustomer = {
    id: 'c1',
    companyId: 'co1',
    name: 'Acme Corp',
    email: 'buyer@acme.com',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('builds snapshot from customer record', () => {
    expect(customerSnapshotFromCustomer(baseCustomer)).toEqual({
      id: 'c1',
      name: 'Acme Corp',
      contactName: undefined,
      email: 'buyer@acme.com',
      phone: undefined,
      address: undefined,
      taxId: undefined,
    });
  });

  it('reads display name from snapshot or legacy field', () => {
    const withSnapshot = {
      customer: { id: 'c1', name: 'From snapshot' },
    } as Sale;
    const legacy = { customerName: 'Legacy name' } as Sale;

    expect(getSaleCustomerName(withSnapshot)).toBe('From snapshot');
    expect(getSaleCustomerName(legacy)).toBe('Legacy name');
  });

  it('builds filter options from sales without extra customer fetch', () => {
    const sales = [
      { customerId: 'c2', customerName: 'Beta' },
      { customerId: 'c1', customer: { id: 'c1', name: 'Alpha' } },
      { customerId: 'c1', customerName: 'Alpha' },
      {},
    ] as Sale[];

    expect(customerFilterOptionsFromSales(sales)).toEqual([
      { id: 'c1', name: 'Alpha' },
      { id: 'c2', name: 'Beta' },
    ]);
  });
});
