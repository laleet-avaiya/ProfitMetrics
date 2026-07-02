import { normalizeSaleStatus } from '../constants/saleStatuses';
import { firestoreService } from '../services/firestore';
import type { Sale } from '../types';
import { SaleStatus } from '../types';
import { deductStock, restoreStock } from './stockHelpers';
import { getSaleLines } from './saleLines';

/** How many units should be deducted from stock for this sale state, per product. */
export function effectiveStockDeductions(sale: Sale): Map<string, number> {
  const status = normalizeSaleStatus(sale.status);
  const map = new Map<string, number>();

  if (status === SaleStatus.CANCELLED || status === SaleStatus.RETURNED) {
    return map;
  }

  for (const line of getSaleLines(sale)) {
    const qty = Math.max(0, line.quantity);
    if (qty <= 0) continue;
    map.set(line.productId, (map.get(line.productId) ?? 0) + qty);
  }

  return map;
}

function deductionDelta(
  previous?: Sale | null,
  next?: Sale | null
): Map<string, { delta: number; productName: string }> {
  const prev = previous ? effectiveStockDeductions(previous) : new Map<string, number>();
  const curr = next ? effectiveStockDeductions(next) : new Map<string, number>();
  const productNames = new Map<string, string>();

  for (const line of getSaleLines(next ?? previous!)) {
    productNames.set(line.productId, line.productName);
  }

  const ids = new Set([...prev.keys(), ...curr.keys()]);
  const result = new Map<string, { delta: number; productName: string }>();

  for (const productId of ids) {
    const delta = (curr.get(productId) ?? 0) - (prev.get(productId) ?? 0);
    if (delta !== 0) {
      result.set(productId, {
        delta,
        productName: productNames.get(productId) ?? 'Product',
      });
    }
  }

  return result;
}

/** Sync stock levels when a sale is created or updated. */
export async function syncSaleStock(
  companyId: string,
  sale: Sale,
  userId: string,
  previous?: Sale | null
): Promise<{ ok: true } | { ok: false; available: number; needed: number; productName?: string }> {
  const changes = deductionDelta(previous, sale);

  for (const [productId, { delta, productName }] of changes) {
    if (delta > 0) {
      const result = await deductStock(companyId, productId, delta, userId);
      if (!result.ok) {
        return { ok: false, available: result.available, needed: delta, productName };
      }
    } else if (delta < 0) {
      await restoreStock(companyId, productId, productName, -delta, userId);
    }
  }

  return { ok: true };
}

/** Check whether stock is sufficient without mutating inventory. */
export async function checkSaleStock(
  companyId: string,
  sale: Sale,
  previous?: Sale | null
): Promise<{ ok: true } | { ok: false; available: number; needed: number; productName?: string }> {
  const changes = deductionDelta(previous, sale);

  for (const [productId, { delta, productName }] of changes) {
    if (delta <= 0) continue;

    const existing = await firestoreService.stock.getByProductId(companyId, productId);
    const available = existing?.quantityOnHand ?? 0;
    if (available < delta) {
      return { ok: false, available, needed: delta, productName };
    }
  }

  return { ok: true };
}

/** Restore stock when a sale is deleted. */
export async function restoreSaleStock(
  companyId: string,
  sale: Sale,
  userId: string
): Promise<void> {
  for (const [productId, qty] of effectiveStockDeductions(sale)) {
    const line = getSaleLines(sale).find((l) => l.productId === productId);
    await restoreStock(companyId, productId, line?.productName ?? sale.productName, qty, userId);
  }
}
