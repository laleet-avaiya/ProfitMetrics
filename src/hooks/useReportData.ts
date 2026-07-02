import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useNotification } from './useNotification';
import { firestoreService } from '../services/firestore';
import type { Expense, Invoice, Product, ProductStock, Sale } from '../types';
import {
  computePeriodSummary,
  filterExpensesInRange,
  filterInvoicesInRange,
  filterSalesInRange,
  getReportDateRange,
  type ReportPreset,
} from '../utils/reports';

export function useReportData() {
  const { company } = useAuth();
  const notification = useNotification();

  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stock, setStock] = useState<ProductStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<ReportPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [salesList, invoicesList, expensesList, stockList, productsList] = await Promise.all([
        firestoreService.sales.getAll(company.id),
        firestoreService.invoices.getAll(company.id),
        firestoreService.expenses.getAll(company.id),
        firestoreService.stock.getAll(company.id),
        firestoreService.products.getAll(company.id),
      ]);
      setSales(salesList.filter((s) => !s.deleted));
      setInvoices(invoicesList.filter((i) => !i.deleted));
      setExpenses(expensesList.filter((e) => !e.deleted));
      setStock(stockList);
      setProducts(productsList.filter((p) => !p.deleted));
    } catch (err) {
      console.error('Failed to load report data:', err);
      notification.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dateRange = useMemo(
    () => getReportDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const filteredSales = useMemo(
    () => filterSalesInRange(sales, dateRange.from, dateRange.to),
    [sales, dateRange]
  );

  const filteredInvoices = useMemo(
    () => filterInvoicesInRange(invoices, dateRange.from, dateRange.to),
    [invoices, dateRange]
  );

  const filteredExpenses = useMemo(
    () => filterExpensesInRange(expenses, dateRange.from, dateRange.to),
    [expenses, dateRange]
  );

  const summary = useMemo(
    () =>
      computePeriodSummary(
        filteredSales,
        filteredInvoices,
        filteredExpenses,
        dateRange.label,
        dateRange.from,
        dateRange.to
      ),
    [filteredSales, filteredInvoices, filteredExpenses, dateRange]
  );

  const hasData =
    filteredSales.length > 0 ||
    filteredInvoices.length > 0 ||
    filteredExpenses.length > 0;

  return {
    currency: company?.currency ?? 'AED',
    loading,
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    dateRange,
    filteredSales,
    filteredInvoices,
    filteredExpenses,
    stock,
    products,
    summary,
    hasData,
  };
}
