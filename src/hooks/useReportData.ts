import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useNotification } from './useNotification';
import { firestoreService } from '../services/firestore';
import type { Expense, Sale } from '../types';
import {
  computePeriodSummary,
  filterExpensesInRange,
  filterSalesInRange,
  getReportDateRange,
  type ReportPreset,
} from '../utils/reports';

export function useReportData() {
  const { company } = useAuth();
  const notification = useNotification();

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<ReportPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [salesList, expensesList] = await Promise.all([
        firestoreService.sales.getAll(company.id),
        firestoreService.expenses.getAll(company.id),
      ]);
      setSales(salesList.filter((s) => !s.deleted));
      setExpenses(expensesList.filter((e) => !e.deleted));
    } catch (err) {
      console.error('Failed to load report data:', err);
      notification.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [company]);

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

  const filteredExpenses = useMemo(
    () => filterExpensesInRange(expenses, dateRange.from, dateRange.to),
    [expenses, dateRange]
  );

  const summary = useMemo(
    () =>
      computePeriodSummary(
        filteredSales,
        filteredExpenses,
        dateRange.label,
        dateRange.from,
        dateRange.to
      ),
    [filteredSales, filteredExpenses, dateRange]
  );

  const hasData = filteredSales.length > 0 || filteredExpenses.length > 0;

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
    filteredExpenses,
    summary,
    hasData,
  };
}
