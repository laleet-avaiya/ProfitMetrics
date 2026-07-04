import { appendAuditLog, type AuditAction, type AuditEntityType } from './auditLog';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  runTransaction,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Customer,
  Expense,
  Invoice,
  Payment,
  Product,
  ProductStock,
  PurchaseOrder,
  Sale,
  StockMovement,
  Vendor,
} from '../types';
import { isNotDeleted } from '../models/softDelete';
import { convertTimestamps, nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';
import {
  getCachedList,
  invalidateCollectionCache,
  setCachedList,
} from '../utils/companyDataCache';

const COLLECTION_PRODUCTS = 'products';
const COLLECTION_SALES = 'sales';
const COLLECTION_EXPENSES = 'expenses';
const COLLECTION_VENDORS = 'vendors';
const COLLECTION_PURCHASES = 'purchases';
const COLLECTION_STOCK = 'stock';
const COLLECTION_STOCK_MOVEMENTS = 'stockMovements';
const COLLECTION_CUSTOMERS = 'customers';
const COLLECTION_INVOICES = 'invoices';
const COLLECTION_PAYMENTS = 'payments';
const COLLECTION_COUNTERS = 'counters';

const COLLECTION_AUDIT: Record<string, { entityType: AuditEntityType; action: AuditAction; summary: string }> = {
  [COLLECTION_PRODUCTS]: { entityType: 'product', action: 'product.deleted', summary: 'Product deleted' },
  [COLLECTION_SALES]: { entityType: 'sale', action: 'sale.deleted', summary: 'Sale deleted' },
  [COLLECTION_EXPENSES]: { entityType: 'expense', action: 'expense.deleted', summary: 'Expense deleted' },
  [COLLECTION_VENDORS]: { entityType: 'vendor', action: 'vendor.deleted', summary: 'Vendor deleted' },
  [COLLECTION_PURCHASES]: { entityType: 'purchase', action: 'purchase.deleted', summary: 'Purchase order deleted' },
  [COLLECTION_STOCK]: { entityType: 'stock', action: 'stock.deleted', summary: 'Stock record deleted' },
  [COLLECTION_CUSTOMERS]: { entityType: 'customer', action: 'customer.deleted', summary: 'Customer deleted' },
  [COLLECTION_INVOICES]: { entityType: 'invoice', action: 'invoice.deleted', summary: 'Invoice deleted' },
  [COLLECTION_PAYMENTS]: { entityType: 'payment', action: 'payment.deleted', summary: 'Payment deleted' },
};

function getDocId(companyId: string, id: string): string {
  return `${companyId}_${id}`;
}

function withoutCompanyId<T>(data: T & { companyId?: string }): T {
  const rest = { ...data };
  delete rest.companyId;
  return rest as T;
}

async function get<T extends { deleted?: boolean }>(
  companyId: string,
  collectionName: string,
  id: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, getDocId(companyId, id));
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;

  const raw = { id: docSnap.data().id ?? id, ...docSnap.data() };
  const converted = convertTimestamps<T & { companyId?: string }>(raw as Record<string, unknown>);
  if (!isNotDeleted(converted)) return null;
  return withoutCompanyId(converted);
}

async function getAll<T extends { createdAt?: Date; deleted?: boolean }>(
  companyId: string,
  collectionName: string
): Promise<T[]> {
  const cached = getCachedList<T>(companyId, collectionName);
  if (cached) return cached;

  const q = query(collection(db, collectionName), where('companyId', '==', companyId));
  const querySnapshot = await getDocs(q);

  const list = querySnapshot.docs
    .map((d) => {
      const raw = { id: d.data().id ?? d.id, ...d.data() };
      return withoutCompanyId(
        convertTimestamps<T & { companyId?: string }>(raw as Record<string, unknown>)
      );
    })
    .filter(isNotDeleted);

  list.sort((a, b) => {
    const aMs = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bMs = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return bMs - aMs;
  });

  setCachedList(companyId, collectionName, list);
  return list;
}

async function create<T extends { id: string; createdAt?: Date; updatedAt?: Date }>(
  companyId: string,
  collectionName: string,
  data: T,
  userId: string
): Promise<T> {
  const { id, ...rest } = data;
  const docRef = doc(db, collectionName, getDocId(companyId, id));

  const prepared = prepareDatesForFirestore({
    ...rest,
    id,
    companyId,
    createdBy: userId,
    updatedBy: userId,
    createdAt: data.createdAt ?? serverTimestamp(),
    updatedAt: data.updatedAt ?? serverTimestamp(),
  } as Record<string, unknown>);

  await setDoc(docRef, prepared);
  invalidateCollectionCache(companyId, collectionName);
  return { ...data, createdBy: userId, updatedBy: userId };
}

async function update<T extends { id: string; updatedAt?: Date }>(
  companyId: string,
  collectionName: string,
  id: string,
  updates: Partial<T>,
  userId: string
): Promise<void> {
  const docRef = doc(db, collectionName, getDocId(companyId, id));
  const safeUpdates = { ...updates } as Partial<T> & { createdBy?: string; id?: string };
  delete safeUpdates.createdBy;
  delete safeUpdates.id;
  const prepared = prepareDatesForFirestore({
    ...safeUpdates,
    updatedBy: userId,
    updatedAt: safeUpdates.updatedAt ?? new Date(),
  } as Record<string, unknown>);
  await updateDoc(docRef, prepared as DocumentData);
  invalidateCollectionCache(companyId, collectionName);
}

async function softDelete(
  companyId: string,
  collectionName: string,
  id: string,
  deletedBy: string
): Promise<void> {
  const now = nowUtc();
  await update(
    companyId,
    collectionName,
    id,
    {
      deleted: true,
      deletedAt: now,
      deletedBy,
      updatedAt: now,
    } as DocumentData,
    deletedBy
  );

  const audit = COLLECTION_AUDIT[collectionName];
  if (audit) {
    appendAuditLog(companyId, deletedBy, {
      action: audit.action,
      entityType: audit.entityType,
      entityId: id,
      summary: audit.summary,
    });
  }
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    platformListings: Array.isArray(product.platformListings) ? product.platformListings : [],
  };
}

type DeleteFn = (companyId: string, id: string, deletedBy: string) => Promise<void>;
type CreateFn<T> = (companyId: string, data: T, userId: string) => Promise<T>;
type UpdateFn<T> = (companyId: string, id: string, updates: Partial<T>, userId: string) => Promise<void>;

function withDelete(
  companyId: string,
  collectionName: string,
  id: string,
  deletedBy: string
): Promise<void> {
  return softDelete(companyId, collectionName, id, deletedBy);
}

export const firestoreService = {
  products: {
    get: async (companyId: string, id: string) => {
      const product = await get<Product>(companyId, COLLECTION_PRODUCTS, id);
      return product ? normalizeProduct(product) : null;
    },
    getAll: (companyId: string) => getAll<Product>(companyId, COLLECTION_PRODUCTS),
    create: ((companyId, product, userId) =>
      create(companyId, COLLECTION_PRODUCTS, product, userId)) as CreateFn<Product>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_PRODUCTS, id, updates, userId)) as UpdateFn<Product>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_PRODUCTS, id, deletedBy)) as DeleteFn,
  },
  sales: {
    get: (companyId: string, id: string) => get<Sale>(companyId, COLLECTION_SALES, id),
    getAll: (companyId: string) => getAll<Sale>(companyId, COLLECTION_SALES),
    create: ((companyId, sale, userId) => create(companyId, COLLECTION_SALES, sale, userId)) as CreateFn<Sale>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_SALES, id, updates, userId)) as UpdateFn<Sale>,
    delete: ((companyId, id, deletedBy) => withDelete(companyId, COLLECTION_SALES, id, deletedBy)) as DeleteFn,
  },
  expenses: {
    get: (companyId: string, id: string) => get<Expense>(companyId, COLLECTION_EXPENSES, id),
    getAll: (companyId: string) => getAll<Expense>(companyId, COLLECTION_EXPENSES),
    create: ((companyId, expense, userId) =>
      create(companyId, COLLECTION_EXPENSES, expense, userId)) as CreateFn<Expense>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_EXPENSES, id, updates, userId)) as UpdateFn<Expense>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_EXPENSES, id, deletedBy)) as DeleteFn,
  },
  vendors: {
    get: (companyId: string, id: string) => get<Vendor>(companyId, COLLECTION_VENDORS, id),
    getAll: (companyId: string) => getAll<Vendor>(companyId, COLLECTION_VENDORS),
    create: ((companyId, vendor, userId) =>
      create(companyId, COLLECTION_VENDORS, vendor, userId)) as CreateFn<Vendor>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_VENDORS, id, updates, userId)) as UpdateFn<Vendor>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_VENDORS, id, deletedBy)) as DeleteFn,
  },
  purchases: {
    get: (companyId: string, id: string) => get<PurchaseOrder>(companyId, COLLECTION_PURCHASES, id),
    getAll: (companyId: string) => getAll<PurchaseOrder>(companyId, COLLECTION_PURCHASES),
    create: ((companyId, purchase, userId) =>
      create(companyId, COLLECTION_PURCHASES, purchase, userId)) as CreateFn<PurchaseOrder>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_PURCHASES, id, updates, userId)) as UpdateFn<PurchaseOrder>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_PURCHASES, id, deletedBy)) as DeleteFn,
  },
  stock: {
    get: (companyId: string, id: string) => get<ProductStock>(companyId, COLLECTION_STOCK, id),
    getAll: (companyId: string) => getAll<ProductStock>(companyId, COLLECTION_STOCK),
    getByProductId: async (companyId: string, productId: string) =>
      get<ProductStock>(companyId, COLLECTION_STOCK, productId),
    create: ((companyId, stock, userId) =>
      create(companyId, COLLECTION_STOCK, stock, userId)) as CreateFn<ProductStock>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_STOCK, id, updates, userId)) as UpdateFn<ProductStock>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_STOCK, id, deletedBy)) as DeleteFn,
  },
  stockMovements: {
    getAll: (companyId: string) =>
      getAll<StockMovement>(companyId, COLLECTION_STOCK_MOVEMENTS),
    listByProduct: async (companyId: string, productId: string) => {
      const all = await getAll<StockMovement>(companyId, COLLECTION_STOCK_MOVEMENTS);
      return all.filter((m) => m.productId === productId);
    },
    create: ((companyId, movement, userId) =>
      create(companyId, COLLECTION_STOCK_MOVEMENTS, movement, userId)) as CreateFn<StockMovement>,
  },
  customers: {
    get: (companyId: string, id: string) => get<Customer>(companyId, COLLECTION_CUSTOMERS, id),
    getAll: (companyId: string) => getAll<Customer>(companyId, COLLECTION_CUSTOMERS),
    create: ((companyId, customer, userId) =>
      create(companyId, COLLECTION_CUSTOMERS, customer, userId)) as CreateFn<Customer>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_CUSTOMERS, id, updates, userId)) as UpdateFn<Customer>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_CUSTOMERS, id, deletedBy)) as DeleteFn,
  },
  invoices: {
    get: (companyId: string, id: string) => get<Invoice>(companyId, COLLECTION_INVOICES, id),
    getAll: (companyId: string) => getAll<Invoice>(companyId, COLLECTION_INVOICES),
    create: ((companyId, invoice, userId) =>
      create(companyId, COLLECTION_INVOICES, invoice, userId)) as CreateFn<Invoice>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_INVOICES, id, updates, userId)) as UpdateFn<Invoice>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_INVOICES, id, deletedBy)) as DeleteFn,
  },
  payments: {
    get: (companyId: string, id: string) => get<Payment>(companyId, COLLECTION_PAYMENTS, id),
    getAll: (companyId: string) => getAll<Payment>(companyId, COLLECTION_PAYMENTS),
    create: ((companyId, payment, userId) =>
      create(companyId, COLLECTION_PAYMENTS, payment, userId)) as CreateFn<Payment>,
    update: ((companyId, id, updates, userId) =>
      update(companyId, COLLECTION_PAYMENTS, id, updates, userId)) as UpdateFn<Payment>,
    delete: ((companyId, id, deletedBy) =>
      withDelete(companyId, COLLECTION_PAYMENTS, id, deletedBy)) as DeleteFn,
  },
  counters: {
    /**
     * Atomically allocate the next sequence for a counter key. Runs in a
     * Firestore transaction so concurrent callers never receive the same value.
     * `floor` seeds the counter from pre-existing data (e.g. the current max
     * document number) the first time the counter is used.
     */
    next: async (companyId: string, key: string, floor = 0): Promise<number> => {
      const ref = doc(db, COLLECTION_COUNTERS, `${companyId}_${key}`);
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists() ? Number(snap.data().value ?? 0) : 0;
        const nextValue = Math.max(current, floor) + 1;
        tx.set(ref, {
          companyId,
          key,
          value: nextValue,
          updatedAt: serverTimestamp(),
        });
        return nextValue;
      });
    },
  },
};
