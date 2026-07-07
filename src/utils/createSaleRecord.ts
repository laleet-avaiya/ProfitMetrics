import type { Company, Customer, Product, Sale } from '../types';
import { firestoreService } from '../services/firestore';
import { allocateNextSaleNumber } from './documentNumbers';
import { buildSaleFromForm, type SaleFormState } from './saleHelpers';
import { checkSaleStock, requireSyncSaleStock } from './saleStock';
import { deleteSaleLinkedExpenses, syncSaleExpenses } from './saleExpenses';

export interface CreateSaleResult {
  sale: Sale;
  warnings: string[];
}

export async function createSaleRecord(
  company: Company,
  userId: string,
  form: SaleFormState,
  products: Product[],
  customer?: Customer
): Promise<CreateSaleResult> {
  const warnings: string[] = [];
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const productHsnCodes = new Map(
    products.filter((p) => p.hsnCode).map((p) => [p.id, p.hsnCode as string])
  );
  const orderNumber = await allocateNextSaleNumber(company.id, form.orderDate);
  const payload = buildSaleFromForm(
    form,
    company.id,
    productNames,
    undefined,
    productHsnCodes,
    customer,
    orderNumber
  );

  const stockCheck = await checkSaleStock(company.id, payload);
  if (!stockCheck.ok) {
    throw new Error(
      `Insufficient stock for ${stockCheck.productName ?? 'product'}. Available: ${stockCheck.available}, needed: ${stockCheck.needed}`
    );
  }

  const created = await firestoreService.sales.create(company.id, payload, userId);

  try {
    await requireSyncSaleStock(company.id, created, userId);
    await firestoreService.sales.update(
      company.id,
      created.id,
      { stockApplied: true, updatedAt: created.updatedAt },
      userId
    );
  } catch (stockErr) {
    try {
      await firestoreService.sales.delete(company.id, created.id, userId);
      await deleteSaleLinkedExpenses(company.id, created.id, userId);
    } catch (rollbackErr) {
      console.error('Failed to roll back sale after stock error:', rollbackErr);
    }
    throw stockErr instanceof Error
      ? stockErr
      : new Error('Could not update stock. The sale was not saved.');
  }

  try {
    await syncSaleExpenses(company.id, created, userId);
  } catch (syncErr) {
    console.error('Failed to sync sale expenses:', syncErr);
    warnings.push('Sale saved but linked expenses could not be created.');
  }

  return { sale: created, warnings };
}
