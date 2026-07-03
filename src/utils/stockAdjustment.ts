import { firestoreService } from '../services/firestore';
import { appendAuditLog } from '../services/auditLog';
import type { StockMovement } from '../types';
import { StockMovementType } from '../types';
import { nowUtc } from './firestoreDates';
import { createListingId } from './productDefaults';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface AdjustStockParams {
  companyId: string;
  productId: string;
  productName: string;
  /** Target on-hand quantity after the adjustment */
  newQuantity: number;
  reason: string;
  note?: string;
  userId: string;
}

/**
 * Set a product's on-hand quantity to `newQuantity`, keeping weighted-average
 * cost unchanged, and record an append-only movement log + audit entry.
 * Returns the movement, or null when nothing changed.
 */
export async function adjustProductStock(
  params: AdjustStockParams
): Promise<StockMovement | null> {
  const { companyId, productId, productName, reason, note, userId } = params;
  const newQty = Math.max(0, Math.floor(params.newQuantity));

  const existing = await firestoreService.stock.getByProductId(companyId, productId);
  const previousQty = existing?.quantityOnHand ?? 0;
  const delta = newQty - previousQty;

  if (delta === 0) return null;

  const now = nowUtc();
  const avgPurchase = existing?.avgPurchasePrice ?? 0;

  if (existing) {
    await firestoreService.stock.update(
      companyId,
      productId,
      {
        companyId,
        productName,
        quantityOnHand: newQty,
        totalValue: roundMoney(newQty * avgPurchase),
        updatedAt: now,
      },
      userId
    );
  } else {
    await firestoreService.stock.create(
      companyId,
      {
        id: productId,
        companyId,
        productId,
        productName,
        quantityOnHand: newQty,
        avgPurchasePrice: 0,
        avgSellingPrice: 0,
        totalValue: 0,
        createdAt: now,
        updatedAt: now,
      },
      userId
    );
  }

  const movement: StockMovement = {
    id: createListingId(),
    companyId,
    productId,
    productName,
    type: StockMovementType.ADJUSTMENT,
    delta,
    previousQty,
    newQty,
    reason: reason.trim() || 'Manual adjustment',
    note: note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await firestoreService.stockMovements.create(companyId, movement, userId);

  appendAuditLog(companyId, userId, {
    action: 'stock.adjusted',
    entityType: 'stock',
    entityId: productId,
    summary: `Stock adjusted for ${productName}: ${previousQty} → ${newQty} (${
      delta >= 0 ? '+' : ''
    }${delta})`,
  });

  return movement;
}
