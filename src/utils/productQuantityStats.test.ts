import { describe, expect, it } from 'vitest';
import { PurchaseOrderStatus, SaleStatus } from '../types';
import { computeProductQuantityStats } from './productQuantityStats';

describe('computeProductQuantityStats', () => {
  it('sums received purchase qty and active sale qty per product', () => {
    const stats = computeProductQuantityStats(
      [
        {
          id: 'po1',
          status: PurchaseOrderStatus.RECEIVED,
          lines: [
            { id: 'l1', productId: 'p1', productName: 'A', quantityOrdered: 10, quantityReceived: 8, purchasePrice: 1, sellingPrice: 2, lineSubtotal: 8, lineTotal: 8 },
            { id: 'l2', productId: 'p2', productName: 'B', quantityOrdered: 5, quantityReceived: 5, purchasePrice: 1, sellingPrice: 2, lineSubtotal: 5, lineTotal: 5 },
          ],
        } as never,
      ],
      [
        {
          id: 's1',
          status: SaleStatus.DELIVERED,
          productId: 'p1',
          productName: 'A',
          quantity: 3,
          lines: [{ id: 'sl1', productId: 'p1', productName: 'A', quantity: 3, economics: {} as never }],
        } as never,
        {
          id: 's2',
          status: SaleStatus.CANCELLED,
          productId: 'p1',
          productName: 'A',
          quantity: 99,
        } as never,
      ]
    );

    expect(stats.get('p1')).toEqual({ purchased: 8, sold: 3 });
    expect(stats.get('p2')).toEqual({ purchased: 5, sold: 0 });
  });
});
