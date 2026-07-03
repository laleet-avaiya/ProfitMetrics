import type { Invoice, Sale } from '../types';
import { SalesChannelFilter } from '../constants/salesChannels';
import { getSaleDisplayProductName } from './saleLines';

export type UnifiedSalesRow =
  | { kind: 'marketplace'; id: string; date: Date; sale: Sale }
  | { kind: 'offline'; id: string; date: Date; invoice: Invoice };

export function mergeSalesRows(sales: Sale[], invoices: Invoice[]): UnifiedSalesRow[] {
  const rows: UnifiedSalesRow[] = [
    ...sales.map((sale) => ({
      kind: 'marketplace' as const,
      id: sale.id,
      date: sale.orderDate,
      sale,
    })),
    ...invoices.map((invoice) => ({
      kind: 'offline' as const,
      id: invoice.id,
      date: invoice.invoiceDate,
      invoice,
    })),
  ];

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function filterUnifiedRows(
  rows: UnifiedSalesRow[],
  channel: SalesChannelFilter
): UnifiedSalesRow[] {
  if (channel === SalesChannelFilter.MARKETPLACE) {
    return rows.filter((row) => row.kind === 'marketplace');
  }
  if (channel === SalesChannelFilter.OFFLINE) {
    return rows.filter((row) => row.kind === 'offline');
  }
  return rows;
}

export function unifiedRowReference(row: UnifiedSalesRow): string {
  if (row.kind === 'marketplace') {
    return row.sale.orderNumber ?? row.sale.orderId ?? '—';
  }
  return row.invoice.invoiceNumber;
}

export function unifiedRowSubtitle(row: UnifiedSalesRow): string {
  if (row.kind === 'marketplace') {
    return getSaleDisplayProductName(row.sale);
  }
  return row.invoice.customerName ?? 'Customer invoice';
}

export function unifiedRowDetailPath(row: UnifiedSalesRow): string {
  return row.kind === 'marketplace' ? `/sales/${row.id}` : `/invoices/${row.id}`;
}

export function unifiedRowEditPath(row: UnifiedSalesRow): string {
  return row.kind === 'marketplace'
    ? `/sales/${row.id}/edit`
    : `/invoices/${row.id}/edit`;
}

export function unifiedRowPrintPath(row: UnifiedSalesRow): string {
  return row.kind === 'marketplace' ? `/sales/${row.id}/print` : `/invoices/${row.id}/print`;
}

export function unifiedRowRevenue(row: UnifiedSalesRow): number {
  return row.kind === 'marketplace' ? row.sale.grossRevenue : row.invoice.total;
}

export function unifiedRowProfit(row: UnifiedSalesRow): number {
  return row.kind === 'marketplace' ? row.sale.profit : row.invoice.profit;
}
