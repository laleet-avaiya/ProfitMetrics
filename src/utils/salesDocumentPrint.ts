import type { Customer, Invoice, Sale } from '../types';
import type { SalesDocumentPrintLine, SalesDocumentPrintProps } from '../components/SalesDocumentPrint/SalesDocumentPrint';
import { getSaleLines } from './saleLines';

export function printLinesFromInvoice(invoice: Invoice): SalesDocumentPrintLine[] {
  return invoice.lines.map((line) => ({
    productName: line.productName,
    description: 'ITEM',
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineSubtotal: line.lineSubtotal,
    taxPercentage: line.taxPercentage,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
  }));
}

export function printLinesFromSale(sale: Sale): SalesDocumentPrintLine[] {
  return getSaleLines(sale).map((line) => {
    const lineTotal = line.economics.sellingPrice * line.quantity;
    const taxAmount = line.economics.taxAmount ?? 0;
    return {
      productName: line.productName,
      description: 'ITEM',
      quantity: line.quantity,
      unitPrice: line.economics.sellingPrice,
      lineSubtotal: lineTotal - taxAmount,
      taxPercentage: line.economics.sellingTaxPercentage ?? line.economics.taxPercentage,
      taxAmount,
      lineTotal,
    };
  });
}

export function buildInvoicePrintProps(
  invoice: Invoice,
  company: NonNullable<SalesDocumentPrintProps['company']>,
  customer?: Customer | null
): Omit<SalesDocumentPrintProps, 'currency'> {
  return {
    kind: 'offline',
    documentNumber: invoice.invoiceNumber,
    documentDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    billTo: invoice.customerName ?? customer?.name ?? 'Customer',
    billToAddress: customer?.address,
    billToTaxId: customer?.taxId,
    billToPhone: customer?.phone,
    billToEmail: customer?.email,
    lines: printLinesFromInvoice(invoice),
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    totalPaid: invoice.totalPaid,
    balanceDue: invoice.balanceDue,
    notes: invoice.notes,
    company,
  };
}

export function buildSalePrintProps(
  sale: Sale,
  company: NonNullable<SalesDocumentPrintProps['company']>
): Omit<SalesDocumentPrintProps, 'currency'> {
  const subtotal = sale.grossRevenue - (sale.economics.taxAmount ?? 0);
  return {
    kind: 'marketplace',
    documentNumber: sale.orderId,
    documentDate: sale.orderDate,
    billTo: `${sale.platform} customer`,
    lines: printLinesFromSale(sale),
    subtotal,
    taxAmount: sale.economics.taxAmount ?? 0,
    total: sale.grossRevenue,
    notes: sale.notes,
    company,
  };
}
