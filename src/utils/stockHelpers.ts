import { firestoreService } from '../services/firestore';
import type { ProductStock } from '../types';
import { nowUtc } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type StockPatch = Partial<
  Pick<
    ProductStock,
    | 'productName'
    | 'quantityOnHand'
    | 'avgPurchasePrice'
    | 'avgSellingPrice'
    | 'totalValue'
    | 'lastReceivedAt'
    | 'updatedAt'
  >
>;

/** Always include companyId so Firestore rules and legacy docs stay valid. */
async function patchStock(
  companyId: string,
  productId: string,
  userId: string,
  patch: StockPatch
): Promise<void> {
  await firestoreService.stock.update(
    companyId,
    productId,
    {
      companyId,
      ...patch,
      updatedAt: patch.updatedAt ?? nowUtc(),
    },
    userId
  );
}

/** Weighted average: (currentQty × currentAvg + incomingQty × incomingPrice) / totalQty */
export function computeWeightedAverage(
  currentQty: number,
  currentAvg: number,
  incomingQty: number,
  incomingPrice: number
): number {
  if (incomingQty <= 0) return roundMoney(currentAvg);
  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) return roundMoney(incomingPrice);
  return roundMoney((currentQty * currentAvg + incomingQty * incomingPrice) / totalQty);
}

function buildStockRecord(
  companyId: string,
  productId: string,
  productName: string,
  quantityOnHand: number,
  avgPurchasePrice: number,
  avgSellingPrice: number,
  existing?: ProductStock
): ProductStock {
  const now = nowUtc();
  const qty = Math.max(0, quantityOnHand);
  const avgPurchase = roundMoney(Math.max(0, avgPurchasePrice));
  const avgSelling = roundMoney(Math.max(0, avgSellingPrice));
  return {
    id: productId,
    companyId,
    productId,
    productName,
    quantityOnHand: qty,
    avgPurchasePrice: avgPurchase,
    avgSellingPrice: avgSelling,
    totalValue: roundMoney(qty * avgPurchase),
    lastReceivedAt: existing?.lastReceivedAt,
    createdBy: existing?.createdBy,
    updatedBy: existing?.updatedBy,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Add received units to stock with weighted average pricing. */
export async function receiveStock(
  companyId: string,
  productId: string,
  productName: string,
  quantity: number,
  purchasePrice: number,
  sellingPrice: number,
  userId: string
): Promise<ProductStock> {
  if (quantity <= 0) {
    const existing = await firestoreService.stock.getByProductId(companyId, productId);
    if (existing) return existing;
    const empty = buildStockRecord(companyId, productId, productName, 0, 0, 0);
    await firestoreService.stock.create(companyId, empty, userId);
    return empty;
  }

  const existing = await firestoreService.stock.getByProductId(companyId, productId);
  const now = nowUtc();

  if (!existing) {
    const created = buildStockRecord(
      companyId,
      productId,
      productName,
      quantity,
      purchasePrice,
      sellingPrice
    );
    created.lastReceivedAt = now;
    await firestoreService.stock.create(companyId, created, userId);
    return created;
  }

  const newQty = existing.quantityOnHand + quantity;
  const newAvgPurchase = computeWeightedAverage(
    existing.quantityOnHand,
    existing.avgPurchasePrice,
    quantity,
    purchasePrice
  );
  const newAvgSelling = computeWeightedAverage(
    existing.quantityOnHand,
    existing.avgSellingPrice,
    quantity,
    sellingPrice
  );

  await patchStock(companyId, productId, userId, {
    productName,
    quantityOnHand: newQty,
    avgPurchasePrice: newAvgPurchase,
    avgSellingPrice: newAvgSelling,
    totalValue: roundMoney(newQty * newAvgPurchase),
    lastReceivedAt: now,
    updatedAt: now,
  });

  return {
    ...existing,
    companyId,
    productName,
    quantityOnHand: newQty,
    avgPurchasePrice: newAvgPurchase,
    avgSellingPrice: newAvgSelling,
    totalValue: roundMoney(newQty * newAvgPurchase),
    lastReceivedAt: now,
    updatedAt: now,
  };
}

/** Remove units from stock (e.g. on sale). Returns false if insufficient stock. */
export async function deductStock(
  companyId: string,
  productId: string,
  quantity: number,
  userId: string
): Promise<{ ok: true; stock: ProductStock } | { ok: false; available: number }> {
  if (quantity <= 0) {
    const existing = await firestoreService.stock.getByProductId(companyId, productId);
    if (!existing) {
      return { ok: true, stock: buildStockRecord(companyId, productId, '', 0, 0, 0) };
    }
    return { ok: true, stock: existing };
  }

  const existing = await firestoreService.stock.getByProductId(companyId, productId);
  const available = existing?.quantityOnHand ?? 0;

  if (available < quantity) {
    return { ok: false, available };
  }

  const newQty = available - quantity;
  const avgPurchase = existing!.avgPurchasePrice;
  const updatedAt = nowUtc();

  await patchStock(companyId, productId, userId, {
    productName: existing!.productName,
    quantityOnHand: newQty,
    totalValue: roundMoney(newQty * avgPurchase),
    updatedAt,
  });

  return {
    ok: true,
    stock: {
      ...existing!,
      companyId,
      quantityOnHand: newQty,
      totalValue: roundMoney(newQty * avgPurchase),
      updatedAt,
    },
  };
}

/** Return units to stock (e.g. sale return/cancel). Averages unchanged. */
export async function restoreStock(
  companyId: string,
  productId: string,
  productName: string,
  quantity: number,
  userId: string
): Promise<ProductStock> {
  if (quantity <= 0) {
    const existing = await firestoreService.stock.getByProductId(companyId, productId);
    if (existing) return existing;
    const empty = buildStockRecord(companyId, productId, productName, 0, 0, 0);
    await firestoreService.stock.create(companyId, empty, userId);
    return empty;
  }

  const existing = await firestoreService.stock.getByProductId(companyId, productId);
  if (!existing) {
    const created = buildStockRecord(companyId, productId, productName, quantity, 0, 0);
    await firestoreService.stock.create(companyId, created, userId);
    return created;
  }

  const newQty = existing.quantityOnHand + quantity;
  const updatedAt = nowUtc();

  await patchStock(companyId, productId, userId, {
    productName,
    quantityOnHand: newQty,
    totalValue: roundMoney(newQty * existing.avgPurchasePrice),
    updatedAt,
  });

  return {
    ...existing,
    companyId,
    productName,
    quantityOnHand: newQty,
    totalValue: roundMoney(newQty * existing.avgPurchasePrice),
    updatedAt,
  };
}

export function getStockMap(stockList: ProductStock[]): Map<string, ProductStock> {
  return new Map(stockList.map((s) => [s.productId, s]));
}
