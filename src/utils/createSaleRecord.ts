import type { Company, Customer, Product, Sale } from '../types';
import { firestoreService } from '../services/firestore';
import { allocateNextSaleNumber } from './documentNumbers';
import { buildSaleFromForm, type SaleFormState } from './saleHelpers';
import { requireSyncSaleStock, restoreSaleStock } from './saleStock';
import { syncSaleExpenses } from './saleExpenses';

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

  let stockApplied = false;
  try {
    await requireSyncSaleStock(company.id, payload, userId);
    stockApplied = true;
  } catch (stockErr) {
    throw stockErr instanceof Error
      ? stockErr
      : new Error('Could not update stock. The sale was not saved.');
  }

  let created: Sale;
  try {
    created = await firestoreService.sales.create(
      company.id,
      { ...payload, stockApplied: true },
      userId
    );
  } catch (createErr) {
    if (stockApplied) {
      try {
        await restoreSaleStock(company.id, payload, userId);
      } catch (rollbackErr) {
        console.error('Failed to roll back stock after sale create error:', rollbackErr);
      }
    }
    throw createErr;
  }

  try {
    await syncSaleExpenses(company.id, created, userId);
  } catch (syncErr) {
    console.error('Failed to sync sale expenses:', syncErr);
    warnings.push('Sale saved but linked expenses could not be created.');
  }

  return { sale: created, warnings };
}
