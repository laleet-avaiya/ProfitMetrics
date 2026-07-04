import type { Sale } from '../types';
import { TaxMode } from '../types';
import type { SalesDocumentPrintLine, SalesDocumentPrintProps } from '../components/SalesDocumentPrint/SalesDocumentPrint';
import { getSaleCustomerName } from './customerHelpers';
import { getSaleLines } from './saleLines';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function printLinesFromSale(sale: Sale): SalesDocumentPrintLine[] {
  return getSaleLines(sale).map((line) => {
    const e = line.economics;
    const grossLine = e.sellingPrice * line.quantity;
    const taxAmount = e.taxAmount ?? 0;
    // Inclusive tax is embedded in the selling price; exclusive tax is charged
    // on top. Split the row accordingly so the printed line total is what the
    // customer actually pays.
    const isExclusive = e.sellingTaxMode === TaxMode.EXCLUSIVE;
    const lineSubtotal = roundMoney(isExclusive ? grossLine : grossLine - taxAmount);
    const lineTotal = roundMoney(isExclusive ? grossLine + taxAmount : grossLine);
    return {
      productName: line.productName,
      description: 'ITEM',
      hsnCode: line.hsnCode,
      quantity: line.quantity,
      unitPrice: e.sellingPrice,
      lineSubtotal,
      taxPercentage: e.sellingTaxPercentage ?? e.taxPercentage,
      taxAmount,
      lineTotal,
    };
  });
}

export function buildSalePrintProps(
  sale: Sale,
  company: NonNullable<SalesDocumentPrintProps['company']>
): Omit<SalesDocumentPrintProps, 'currency'> {
  const taxAmount = sale.economics.taxAmount ?? 0;
  const total = sale.total ?? sale.grossRevenue;
  const subtotal = roundMoney(total - taxAmount);
  return {
    kind: 'marketplace',
    documentNumber: sale.orderNumber ?? sale.orderId ?? '',
    documentDate: sale.orderDate,
    billTo: getSaleCustomerName(sale) ?? `${sale.platform} customer`,
    lines: printLinesFromSale(sale),
    subtotal,
    taxAmount,
    total,
    totalPaid: sale.totalPaid,
    balanceDue: sale.balanceDue ?? Math.max(0, total - (sale.totalPaid ?? 0)),
    notes: sale.notes,
    company,
  };
}
