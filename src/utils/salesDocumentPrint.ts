import type { Sale } from '../types';
import type { SalesDocumentPrintLine, SalesDocumentPrintProps } from '../components/SalesDocumentPrint/SalesDocumentPrint';
import { getSaleLines } from './saleLines';

export function printLinesFromSale(sale: Sale): SalesDocumentPrintLine[] {
  return getSaleLines(sale).map((line) => {
    const lineTotal = line.economics.sellingPrice * line.quantity;
    const taxAmount = line.economics.taxAmount ?? 0;
    return {
      productName: line.productName,
      description: 'ITEM',
      hsnCode: line.hsnCode,
      quantity: line.quantity,
      unitPrice: line.economics.sellingPrice,
      lineSubtotal: lineTotal - taxAmount,
      taxPercentage: line.economics.sellingTaxPercentage ?? line.economics.taxPercentage,
      taxAmount,
      lineTotal,
    };
  });
}

export function buildSalePrintProps(
  sale: Sale,
  company: NonNullable<SalesDocumentPrintProps['company']>
): Omit<SalesDocumentPrintProps, 'currency'> {
  const subtotal = sale.grossRevenue - (sale.economics.taxAmount ?? 0);
  const total = sale.total ?? sale.grossRevenue;
  return {
    kind: 'marketplace',
    documentNumber: sale.orderNumber ?? sale.orderId ?? '',
    documentDate: sale.orderDate,
    billTo: sale.customerName ?? `${sale.platform} customer`,
    lines: printLinesFromSale(sale),
    subtotal,
    taxAmount: sale.economics.taxAmount ?? 0,
    total: sale.grossRevenue,
    totalPaid: sale.totalPaid,
    balanceDue: sale.balanceDue ?? Math.max(0, total - (sale.totalPaid ?? 0)),
    notes: sale.notes,
    company,
  };
}
