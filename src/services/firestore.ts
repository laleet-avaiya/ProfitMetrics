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
  Vendor,
} from '../types';
import { convertTimestamps, prepareDatesForFirestore } from '../utils/firestoreDates';

const COLLECTION_PRODUCTS = 'products';
const COLLECTION_SALES = 'sales';
const COLLECTION_EXPENSES = 'expenses';
const COLLECTION_VENDORS = 'vendors';
const COLLECTION_PURCHASES = 'purchases';
const COLLECTION_STOCK = 'stock';
const COLLECTION_CUSTOMERS = 'customers';
const COLLECTION_INVOICES = 'invoices';
const COLLECTION_PAYMENTS = 'payments';

function getDocId(companyId: string, id: string): string {
  return `${companyId}_${id}`;
}

function withoutCompanyId<T>(data: T & { companyId?: string }): T {
  const rest = { ...data };
  delete rest.companyId;
  return rest as T;
}

async function get<T>(companyId: string, collectionName: string, id: string): Promise<T | null> {
  const docRef = doc(db, collectionName, getDocId(companyId, id));
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;

  const raw = { id: docSnap.data().id ?? id, ...docSnap.data() };
  const converted = convertTimestamps<T & { companyId?: string }>(raw as Record<string, unknown>);
  return withoutCompanyId(converted);
}

async function getAll<T extends { createdAt?: Date }>(
  companyId: string,
  collectionName: string
): Promise<T[]> {
  const q = query(collection(db, collectionName), where('companyId', '==', companyId));
  const querySnapshot = await getDocs(q);

  const list = querySnapshot.docs.map((d) => {
    const raw = { id: d.data().id ?? d.id, ...d.data() };
    return withoutCompanyId(convertTimestamps<T & { companyId?: string }>(raw as Record<string, unknown>));
  });

  list.sort((a, b) => {
    const aMs = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bMs = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return bMs - aMs;
  });

  return list;
}

async function create<T extends { id: string; createdAt?: Date; updatedAt?: Date }>(
  companyId: string,
  collectionName: string,
  data: T
): Promise<T> {
  const { id, ...rest } = data;
  const docRef = doc(db, collectionName, getDocId(companyId, id));

  const prepared = prepareDatesForFirestore({
    ...rest,
    id,
    companyId,
    createdAt: data.createdAt ?? serverTimestamp(),
    updatedAt: data.updatedAt ?? serverTimestamp(),
  } as Record<string, unknown>);

  await setDoc(docRef, prepared);
  return data;
}

async function update<T extends { id: string; updatedAt?: Date }>(
  companyId: string,
  collectionName: string,
  id: string,
  updates: Partial<T>
): Promise<void> {
  const docRef = doc(db, collectionName, getDocId(companyId, id));
  const prepared = prepareDatesForFirestore({
    ...updates,
    updatedAt: updates.updatedAt ?? new Date(),
  } as Record<string, unknown>);
  await updateDoc(docRef, prepared as DocumentData);
}

async function softDelete(
  companyId: string,
  collectionName: string,
  id: string
): Promise<void> {
  await update(companyId, collectionName, id, {
    deleted: true,
    deletedAt: new Date(),
  } as DocumentData);
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    platformListings: Array.isArray(product.platformListings) ? product.platformListings : [],
  };
}

export const firestoreService = {
  products: {
    get: async (companyId: string, id: string) => {
      const product = await get<Product>(companyId, COLLECTION_PRODUCTS, id);
      return product ? normalizeProduct(product) : null;
    },
    getAll: (companyId: string) => getAll<Product>(companyId, COLLECTION_PRODUCTS),
    create: (companyId: string, product: Product) => create(companyId, COLLECTION_PRODUCTS, product),
    update: (companyId: string, id: string, updates: Partial<Product>) =>
      update(companyId, COLLECTION_PRODUCTS, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_PRODUCTS, id),
  },
  sales: {
    get: (companyId: string, id: string) => get<Sale>(companyId, COLLECTION_SALES, id),
    getAll: (companyId: string) => getAll<Sale>(companyId, COLLECTION_SALES),
    create: (companyId: string, sale: Sale) => create(companyId, COLLECTION_SALES, sale),
    update: (companyId: string, id: string, updates: Partial<Sale>) =>
      update(companyId, COLLECTION_SALES, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_SALES, id),
  },
  expenses: {
    get: (companyId: string, id: string) => get<Expense>(companyId, COLLECTION_EXPENSES, id),
    getAll: (companyId: string) => getAll<Expense>(companyId, COLLECTION_EXPENSES),
    create: (companyId: string, expense: Expense) => create(companyId, COLLECTION_EXPENSES, expense),
    update: (companyId: string, id: string, updates: Partial<Expense>) =>
      update(companyId, COLLECTION_EXPENSES, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_EXPENSES, id),
  },
  vendors: {
    get: (companyId: string, id: string) => get<Vendor>(companyId, COLLECTION_VENDORS, id),
    getAll: (companyId: string) => getAll<Vendor>(companyId, COLLECTION_VENDORS),
    create: (companyId: string, vendor: Vendor) => create(companyId, COLLECTION_VENDORS, vendor),
    update: (companyId: string, id: string, updates: Partial<Vendor>) =>
      update(companyId, COLLECTION_VENDORS, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_VENDORS, id),
  },
  purchases: {
    get: (companyId: string, id: string) => get<PurchaseOrder>(companyId, COLLECTION_PURCHASES, id),
    getAll: (companyId: string) => getAll<PurchaseOrder>(companyId, COLLECTION_PURCHASES),
    create: (companyId: string, purchase: PurchaseOrder) =>
      create(companyId, COLLECTION_PURCHASES, purchase),
    update: (companyId: string, id: string, updates: Partial<PurchaseOrder>) =>
      update(companyId, COLLECTION_PURCHASES, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_PURCHASES, id),
  },
  stock: {
    get: (companyId: string, id: string) => get<ProductStock>(companyId, COLLECTION_STOCK, id),
    getAll: (companyId: string) => getAll<ProductStock>(companyId, COLLECTION_STOCK),
    getByProductId: async (companyId: string, productId: string) =>
      get<ProductStock>(companyId, COLLECTION_STOCK, productId),
    create: (companyId: string, stock: ProductStock) => create(companyId, COLLECTION_STOCK, stock),
    update: (companyId: string, id: string, updates: Partial<ProductStock>) =>
      update(companyId, COLLECTION_STOCK, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_STOCK, id),
  },
  customers: {
    get: (companyId: string, id: string) => get<Customer>(companyId, COLLECTION_CUSTOMERS, id),
    getAll: (companyId: string) => getAll<Customer>(companyId, COLLECTION_CUSTOMERS),
    create: (companyId: string, customer: Customer) =>
      create(companyId, COLLECTION_CUSTOMERS, customer),
    update: (companyId: string, id: string, updates: Partial<Customer>) =>
      update(companyId, COLLECTION_CUSTOMERS, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_CUSTOMERS, id),
  },
  invoices: {
    get: (companyId: string, id: string) => get<Invoice>(companyId, COLLECTION_INVOICES, id),
    getAll: (companyId: string) => getAll<Invoice>(companyId, COLLECTION_INVOICES),
    create: (companyId: string, invoice: Invoice) => create(companyId, COLLECTION_INVOICES, invoice),
    update: (companyId: string, id: string, updates: Partial<Invoice>) =>
      update(companyId, COLLECTION_INVOICES, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_INVOICES, id),
  },
  payments: {
    get: (companyId: string, id: string) => get<Payment>(companyId, COLLECTION_PAYMENTS, id),
    getAll: (companyId: string) => getAll<Payment>(companyId, COLLECTION_PAYMENTS),
    create: (companyId: string, payment: Payment) => create(companyId, COLLECTION_PAYMENTS, payment),
    update: (companyId: string, id: string, updates: Partial<Payment>) =>
      update(companyId, COLLECTION_PAYMENTS, id, updates),
    delete: (companyId: string, id: string) => softDelete(companyId, COLLECTION_PAYMENTS, id),
  },
};
