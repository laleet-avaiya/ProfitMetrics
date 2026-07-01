import { normalizeSaleStatus } from '../constants/saleStatuses';
import { firestoreService } from '../services/firestore';
import type { Sale } from '../types';
import { SaleStatus } from '../types';
import { deductStock, restoreStock } from './stockHelpers';

/** How many units should be deducted from stock for this sale state. */
export function effectiveStockDeduction(sale: Sale): number {
  const status = normalizeSaleStatus(sale.status);
  if (status === SaleStatus.CANCELLED || status === SaleStatus.RETURNED) {
    return 0;
  }
  return Math.max(0, sale.quantity);
}

/** Sync stock levels when a sale is created or updated. */
export async function syncSaleStock(
  companyId: string,
  sale: Sale,
  previous?: Sale | null
): Promise<{ ok: true } | { ok: false; available: number; needed: number }> {
  const prevDeduction = previous ? effectiveStockDeduction(previous) : 0;
  const newDeduction = effectiveStockDeduction(sale);
  const delta = newDeduction - prevDeduction;

  if (delta === 0) return { ok: true };

  if (delta > 0) {
    const result = await deductStock(companyId, sale.productId, delta);
    if (!result.ok) {
      return { ok: false, available: result.available, needed: delta };
    }
    return { ok: true };
  }

  await restoreStock(companyId, sale.productId, sale.productName, -delta);
  return { ok: true };
}

/** Check whether stock is sufficient without mutating inventory. */
export async function checkSaleStock(
  companyId: string,
  sale: Sale,
  previous?: Sale | null
): Promise<{ ok: true } | { ok: false; available: number; needed: number }> {
  const prevDeduction = previous ? effectiveStockDeduction(previous) : 0;
  const newDeduction = effectiveStockDeduction(sale);
  const delta = newDeduction - prevDeduction;

  if (delta <= 0) return { ok: true };

  const existing = await firestoreService.stock.getByProductId(companyId, sale.productId);
  const available = existing?.quantityOnHand ?? 0;
  if (available < delta) {
    return { ok: false, available, needed: delta };
  }
  return { ok: true };
}

/** Restore stock when a sale is deleted. */
export async function restoreSaleStock(companyId: string, sale: Sale): Promise<void> {
  const qty = effectiveStockDeduction(sale);
  if (qty <= 0) return;
  await restoreStock(companyId, sale.productId, sale.productName, qty);
}
