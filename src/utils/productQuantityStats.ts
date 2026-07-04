import { normalizeSaleStatus } from '../constants/saleStatuses';
import type { PurchaseOrder, Sale } from '../types';
import { PurchaseOrderStatus, SaleStatus } from '../types';
import { getSaleLines } from './saleLines';

export interface ProductQuantityStats {
  purchased: number;
  sold: number;
}

function addToStats(
  map: Map<string, ProductQuantityStats>,
  productId: string,
  field: keyof ProductQuantityStats,
  qty: number
): void {
  if (!productId || qty <= 0) return;
  const prev = map.get(productId) ?? { purchased: 0, sold: 0 };
  map.set(productId, { ...prev, [field]: prev[field] + qty });
}

/** Lifetime received qty (purchases) and outbound qty (sales) rolled up per product. */
export function computeProductQuantityStats(
  purchases: PurchaseOrder[],
  sales: Sale[]
): Map<string, ProductQuantityStats> {
  const map = new Map<string, ProductQuantityStats>();

  for (const purchase of purchases) {
    if (purchase.deleted || purchase.status === PurchaseOrderStatus.CANCELLED) continue;
    for (const line of purchase.lines) {
      addToStats(map, line.productId, 'purchased', Math.max(0, line.quantityReceived));
    }
  }

  for (const sale of sales) {
    if (sale.deleted) continue;
    const status = normalizeSaleStatus(sale.status);
    if (status === SaleStatus.CANCELLED || status === SaleStatus.RETURNED) continue;
    for (const line of getSaleLines(sale)) {
      addToStats(map, line.productId, 'sold', Math.max(0, line.quantity));
    }
  }

  return map;
}
