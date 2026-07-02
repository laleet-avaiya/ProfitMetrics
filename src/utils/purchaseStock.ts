import { firestoreService } from '../services/firestore';
import type { PurchaseOrder, PurchaseOrderLine } from '../types';
import { receiveStock } from './stockHelpers';

/** Apply stock receipts for newly received quantities since the previous PO state. */
export async function syncPurchaseStockReceipts(
  companyId: string,
  previous: PurchaseOrder | null,
  current: PurchaseOrder,
  userId: string
): Promise<void> {
  if (current.status === 'cancelled') {
    if (previous) {
      await reversePurchaseStockReceipts(companyId, previous, zeroReceivedLines(previous), userId);
    }
    return;
  }

  if (previous) {
    await reversePurchaseStockReceipts(companyId, previous, current, userId);
  }

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
      line.sellingPrice,
      userId
    );
  }
}

function zeroReceivedLines(purchase: PurchaseOrder): PurchaseOrder {
  return {
    ...purchase,
    lines: purchase.lines.map((l) => ({ ...l, quantityReceived: 0 })),
  };
}

/** Reverse stock when reducing received quantities (edit or delete). */
export async function reversePurchaseStockReceipts(
  companyId: string,
  previous: PurchaseOrder,
  current: PurchaseOrder,
  userId: string
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
    await firestoreService.stock.update(
      companyId,
      prevLine.productId,
      {
        quantityOnHand: newQty,
        totalValue: Math.round(newQty * stock.avgPurchasePrice * 100) / 100,
        updatedAt: new Date(),
      },
      userId
    );
  }
}

/** Reverse all received stock when deleting a purchase order. */
export async function reverseAllPurchaseStock(
  companyId: string,
  purchase: PurchaseOrder,
  userId: string
): Promise<void> {
  await reversePurchaseStockReceipts(companyId, purchase, zeroReceivedLines(purchase), userId);
}

export function lineReceivedDelta(
  previous: PurchaseOrderLine | undefined,
  current: PurchaseOrderLine
): number {
  const prevReceived = previous?.quantityReceived ?? 0;
  return Math.max(0, current.quantityReceived - prevReceived);
}
