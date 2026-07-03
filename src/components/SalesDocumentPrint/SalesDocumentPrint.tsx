import type { Company } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { formatMoney } from '../../utils/profit';
import { salesKindLabel } from '../../constants/salesChannels';

export interface SalesDocumentPrintLine {
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  taxPercentage?: number;
  taxAmount?: number;
  lineTotal: number;
}

export interface SalesDocumentPrintProps {
  kind: 'marketplace' | 'offline';
  documentNumber: string;
  documentDate: Date;
  dueDate?: Date;
  billTo: string;
  billToAddress?: string;
  billToTaxId?: string;
  billToPhone?: string;
  billToEmail?: string;
  lines: SalesDocumentPrintLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  totalPaid?: number;
  balanceDue?: number;
  notes?: string;
  company: Company;
  currency: string;
}

export function SalesDocumentPrint({
  kind,
  documentNumber,
  documentDate,
  dueDate,
  billTo,
  billToAddress,
  billToTaxId,
  lines,
  subtotal,
  taxAmount,
  total,
  balanceDue,
  notes,
  company,
  currency,
}: SalesDocumentPrintProps) {
  const docTitle = kind === 'offline' ? 'Tax Invoice' : 'Sales Invoice';

  return (
    <div className="print-page mx-auto max-w-[210mm] bg-white text-gray-900 p-6 sm:p-8">
      <header className="flex flex-wrap justify-between gap-4 border-b border-gray-300 pb-4 mb-6">
        <div>
          {company.logo ? (
            <img src={company.logo} alt="" className="h-12 mb-2 object-contain" />
          ) : null}
          <h1 className="text-xl font-bold">{company.name}</h1>
          {company.address ? <p className="text-sm mt-1 whitespace-pre-line">{company.address}</p> : null}
          <div className="text-sm mt-2 space-y-0.5">
            {company.phone ? <p>Phone: {company.phone}</p> : null}
            {company.email ? <p>Email: {company.email}</p> : null}
            {company.trn ? <p>TRN / Tax ID: {company.trn}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">{docTitle}</p>
          <p className="text-lg font-bold mt-1">{documentNumber}</p>
          <p className="text-sm mt-2">Date: {formatDateLocal(documentDate)}</p>
          {dueDate ? <p className="text-sm">Due: {formatDateLocal(dueDate)}</p> : null}
          <p className="text-xs mt-2 inline-flex px-2 py-0.5 rounded bg-gray-100">
            {salesKindLabel(kind)} sale
          </p>
        </div>
      </header>

      <section className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Bill to</p>
        <p className="font-semibold">{billTo}</p>
        {billToAddress ? <p className="text-sm mt-1 whitespace-pre-line">{billToAddress}</p> : null}
        {billToTaxId ? <p className="text-sm mt-1">Tax ID: {billToTaxId}</p> : null}
      </section>

      <div className="invoice-table-wrap mb-6">
        <table className="invoice-print-line-table invoice-print-table w-full text-sm border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-left">Product</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Qty</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Unit price</th>
              <th className="border border-gray-300 px-2 py-2 text-right invoice-print-th-vat-pct">
                VAT %
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right">Tax</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.productName}-${index}`} className="invoice-item-row">
                <td className="border border-gray-300 px-2 py-2">{line.productName}</td>
                <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">
                  {line.quantity}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">
                  {formatMoney(line.unitPrice, currency)}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">
                  {line.taxPercentage != null ? `${line.taxPercentage}%` : '—'}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">
                  {line.taxAmount != null ? formatMoney(line.taxAmount, currency) : '—'}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right tabular-nums font-medium">
                  {formatMoney(line.lineTotal, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-6">
        <div className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Subtotal</span>
            <span className="tabular-nums font-medium">{formatMoney(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Tax</span>
            <span className="tabular-nums font-medium">{formatMoney(taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-gray-300 pt-2 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(total, currency)}</span>
          </div>
          {balanceDue != null && balanceDue > 0 ? (
            <div className="flex justify-between gap-4 text-amber-800">
              <span>Balance due</span>
              <span className="tabular-nums font-semibold">{formatMoney(balanceDue, currency)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {notes ? (
        <footer className="invoice-print-page-footer border-t border-gray-200 pt-4 text-sm text-gray-600">
          <p className="font-medium text-gray-800 mb-1">Notes</p>
          <p className="whitespace-pre-line">{notes}</p>
        </footer>
      ) : null}
    </div>
  );
}
