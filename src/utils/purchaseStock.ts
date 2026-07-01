import { firestoreService } from '../services/firestore';
import type { PurchaseOrder, PurchaseOrderLine } from '../types';
import { receiveStock } from './stockHelpers';

/** Apply stock receipts for newly received quantities since the previous PO state. */
export async function syncPurchaseStockReceipts(
  companyId: string,
  previous: PurchaseOrder | null,
  current: PurchaseOrder
): Promise<void> {
  if (current.status === 'cancelled') return;

  for (const line of current.lines) {
    const prevLine = previous?.lines.find((l) => l.id === line.id);
    const prevReceived = prevLine?.quantityReceived ?? 0;
    const delta = line.quantityReceived - prevReceived;

    if (delta <= 0) continue;

    await receiveStock(
      companyId,
      line.productId,
      line.productName,
      delta,
      line.purchasePrice,
      line.sellingPrice
    );
  }
}

/** Reverse stock when reducing received quantities (rare edit case). */
export async function reversePurchaseStockReceipts(
  companyId: string,
  previous: PurchaseOrder,
  current: PurchaseOrder
): Promise<void> {
  for (const prevLine of previous.lines) {
    const currLine = current.lines.find((l) => l.id === prevLine.id);
    const currReceived = currLine?.quantityReceived ?? 0;
    const delta = prevLine.quantityReceived - currReceived;

    if (delta <= 0) continue;

    const stock = await firestoreService.stock.getByProductId(companyId, prevLine.productId);
    if (!stock || stock.quantityOnHand < delta) {
      throw new Error(
        `Cannot reduce received quantity for ${prevLine.productName}: insufficient stock (${stock?.quantityOnHand ?? 0} on hand)`
      );
    }

    const newQty = stock.quantityOnHand - delta;
    await firestoreService.stock.update(companyId, prevLine.productId, {
      quantityOnHand: newQty,
      totalValue: Math.round(newQty * stock.avgPurchasePrice * 100) / 100,
      updatedAt: new Date(),
    });
  }
}

export function lineReceivedDelta(
  previous: PurchaseOrderLine | undefined,
  current: PurchaseOrderLine
): number {
  const prevReceived = previous?.quantityReceived ?? 0;
  return Math.max(0, current.quantityReceived - prevReceived);
}
