import { normalizeSaleStatus } from '../constants/saleStatuses';
import { firestoreService } from '../services/firestore';
import type { Sale } from '../types';
import { SaleStatus } from '../types';
import { deductStock, restoreStock } from './stockHelpers';
import { getSaleLines } from './saleLines';
import { stockKey } from './variantHelpers';

interface StockLineInfo {
  productId: string;
  variantId?: string;
  variantLabel?: string;
  productName: string;
  qty: number;
  unitPurchasePrice: number;
  unitSellingPrice: number;
}

/** How many units should be deducted from stock for this sale state, per stock key. */
export function effectiveStockDeductions(sale: Sale): Map<string, StockLineInfo> {
  const status = normalizeSaleStatus(sale.status);
  const map = new Map<string, StockLineInfo>();

  if (status === SaleStatus.CANCELLED || status === SaleStatus.RETURNED) {
    return map;
  }

  for (const line of getSaleLines(sale)) {
    if (!line.productId) continue;
    const qty = Math.max(0, line.quantity);
    if (qty <= 0) continue;
    const key = stockKey(line.productId, line.variantId);
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      map.set(key, {
        productId: line.productId,
        variantId: line.variantId,
        variantLabel: line.variantLabel,
        productName: line.productName,
        qty,
        unitPurchasePrice: Math.max(0, line.economics.purchasePrice),
        unitSellingPrice: Math.max(0, line.economics.sellingPrice),
      });
    }
  }

  return map;
}

interface StockDelta extends Omit<StockLineInfo, 'qty'> {
  delta: number;
}

function deductionDelta(previous?: Sale | null, next?: Sale | null): Map<string, StockDelta> {
  const prev = previous ? effectiveStockDeductions(previous) : new Map<string, StockLineInfo>();
  const curr = next ? effectiveStockDeductions(next) : new Map<string, StockLineInfo>();

  const keys = new Set([...prev.keys(), ...curr.keys()]);
  const result = new Map<string, StockDelta>();

  for (const key of keys) {
    const currInfo = curr.get(key);
    const prevInfo = prev.get(key);
    const delta = (currInfo?.qty ?? 0) - (prevInfo?.qty ?? 0);
    if (delta !== 0) {
      const info = currInfo ?? prevInfo!;
      result.set(key, {
        productId: info.productId,
        variantId: info.variantId,
        variantLabel: info.variantLabel,
        productName: info.productName,
        unitPurchasePrice: info.unitPurchasePrice,
        unitSellingPrice: info.unitSellingPrice,
        delta,
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

  for (const {
    productId,
    variantId,
    variantLabel,
    productName,
    unitPurchasePrice,
    unitSellingPrice,
    delta,
  } of changes.values()) {
    const label = variantLabel ? `${productName} (${variantLabel})` : productName;
    if (delta > 0) {
      const result = await deductStock(companyId, productId, delta, userId, variantId);
      if (!result.ok) {
        return { ok: false, available: result.available, needed: delta, productName: label };
      }
    } else if (delta < 0) {
      await restoreStock(
        companyId,
        productId,
        productName,
        -delta,
        userId,
        variantId,
        variantLabel,
        unitPurchasePrice,
        unitSellingPrice
      );
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

  for (const [key, { productName, variantLabel, delta }] of changes) {
    if (delta <= 0) continue;

    const existing = await firestoreService.stock.getByProductId(companyId, key);
    const available = existing?.quantityOnHand ?? 0;
    if (available < delta) {
      const label = variantLabel ? `${productName} (${variantLabel})` : productName;
      return { ok: false, available, needed: delta, productName: label };
    }
  }

  return { ok: true };
}

export type StockSyncFailure = {
  ok: false;
  available: number;
  needed: number;
  productName?: string;
};

export function stockSyncFailureMessage(result: StockSyncFailure): string {
  const name = result.productName ?? 'product';
  return `Insufficient stock for ${name}. Available: ${result.available}, needed: ${result.needed}`;
}

/** Sync stock and throw when deduction cannot be applied (permissions, insufficient qty). */
export async function requireSyncSaleStock(
  companyId: string,
  sale: Sale,
  userId: string,
  previous?: Sale | null
): Promise<void> {
  const result = await syncSaleStock(companyId, sale, userId, previous);
  if (!result.ok) {
    throw new Error(stockSyncFailureMessage(result));
  }
}

/** Restore stock when a sale is deleted. */
export async function restoreSaleStock(
  companyId: string,
  sale: Sale,
  userId: string
): Promise<void> {
  for (const {
    productId,
    variantId,
    variantLabel,
    productName,
    qty,
    unitPurchasePrice,
    unitSellingPrice,
  } of effectiveStockDeductions(sale).values()) {
    await restoreStock(
      companyId,
      productId,
      productName,
      qty,
      userId,
      variantId,
      variantLabel,
      unitPurchasePrice,
      unitSellingPrice
    );
  }
}
