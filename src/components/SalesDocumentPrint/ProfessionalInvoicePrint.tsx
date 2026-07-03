import type { SalesDocumentPrintProps } from './SalesDocumentPrint';
import { formatDateLocal } from '../../utils/date';
import { formatMoney } from '../../utils/profit';

function salesKindLabel(kind: 'marketplace' | 'offline'): string {
  return kind === 'offline' ? 'Offline' : 'Marketplace';
}

function GridCell({
  label,
  children,
  className = '',
}: {
  label?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-black p-2 text-[11px] leading-snug ${className}`}>
      {label ? <p className="font-bold uppercase tracking-wide text-[10px] mb-1">{label}</p> : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <p>
      <span className="font-semibold">{label}:</span> {value}
    </p>
  );
}

export function ProfessionalInvoicePrint({
  kind,
  documentNumber,
  documentDate,
  dueDate,
  billTo,
  billToAddress,
  billToTaxId,
  billToPhone,
  billToEmail,
  lines,
  subtotal,
  taxAmount,
  total,
  totalPaid,
  balanceDue,
  notes,
  company,
  currency,
}: SalesDocumentPrintProps) {
  const vatLabel = company.defaultTaxPercentage
    ? `VAT ${company.defaultTaxPercentage}%`
    : 'VAT';
  const amountPaid = totalPaid ?? (balanceDue != null && balanceDue <= 0 ? total : 0);
  const balance = balanceDue ?? Math.max(0, total - amountPaid);
  const hasBank =
    company.bankName ||
    company.bankAccountName ||
    company.bankIban ||
    company.bankAccountNumber ||
    company.bankSwift;

  const showHsn = lines.some((line) => Boolean(line.hsnCode));
  const totalLabelColSpan = showHsn ? 6 : 5;

  const tableTotals = lines.reduce(
    (acc, line) => ({
      taxable: acc.taxable + line.lineSubtotal,
      vat: acc.vat + (line.taxAmount ?? 0),
      total: acc.total + line.lineTotal,
    }),
    { taxable: 0, vat: 0, total: 0 }
  );

  return (
    <div className="print-page mx-auto max-w-[210mm] bg-white text-black p-4 sm:p-6 print:p-0 print:max-w-none text-[11px] leading-snug">
      <div className="grid grid-cols-1 sm:grid-cols-2 border border-black border-b-0">
        <GridCell>
          {company.logo ? (
            <img src={company.logo} alt="" className="h-10 mb-2 object-contain object-left" />
          ) : null}
          <p className="text-base font-bold uppercase">{company.name}</p>
          {company.address ? <p className="whitespace-pre-line">{company.address}</p> : null}
          <MetaRow label="TRN" value={company.trn} />
          {company.trn ? <MetaRow label="VAT" value={company.trn} /> : null}
          <MetaRow label="Contact" value={company.phone} />
          <MetaRow label="Email" value={company.email} />
        </GridCell>
        <GridCell>
          <MetaRow label="Invoice No" value={documentNumber} />
          <MetaRow label="Invoice Date" value={formatDateLocal(documentDate)} />
          <MetaRow label="Due Date" value={dueDate ? formatDateLocal(dueDate) : null} />
          <MetaRow label="Sale Type" value={salesKindLabel(kind)} />
          <p className="mt-2 text-sm font-bold uppercase">Tax Invoice</p>
        </GridCell>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 border border-black border-b-0">
        <GridCell label="Customer">
          <p className="font-semibold">{billTo}</p>
          <MetaRow label="TRN" value={billToTaxId} />
          <MetaRow label="PH" value={billToPhone} />
          <MetaRow label="Email" value={billToEmail} />
          {billToAddress ? <p className="whitespace-pre-line mt-1">{billToAddress}</p> : null}
        </GridCell>
        <GridCell label="Order details">
          <MetaRow label="Currency" value={currency} />
          <MetaRow label="Payment status" value={balance <= 0 ? 'Paid' : 'Outstanding'} />
          <MetaRow label="Items" value={String(lines.length)} />
        </GridCell>
      </div>

      <div className="invoice-table-wrap border border-black overflow-x-auto">
        <table className="invoice-print-professional w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-1 py-1.5 text-center w-8">#</th>
              <th className="border border-black px-1 py-1.5 text-left min-w-[120px]">Part / item</th>
              {showHsn ? (
                <th className="border border-black px-1 py-1.5 text-left w-16">HSN / SAC</th>
              ) : null}
              <th className="border border-black px-1 py-1.5 text-left w-16">Type</th>
              <th className="border border-black px-1 py-1.5 text-right w-12">Qty</th>
              <th className="border border-black px-1 py-1.5 text-right whitespace-nowrap">
                Unit price ({currency})
              </th>
              <th className="border border-black px-1 py-1.5 text-right whitespace-nowrap">
                Taxable ({currency})
              </th>
              <th className="border border-black px-1 py-1.5 text-right whitespace-nowrap">
                {vatLabel} ({currency})
              </th>
              <th className="border border-black px-1 py-1.5 text-right whitespace-nowrap">
                Total ({currency})
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.productName}-${index}`}>
                <td className="border border-black px-1 py-1 text-center tabular-nums">{index + 1}</td>
                <td className="border border-black px-1 py-1">{line.productName}</td>
                {showHsn ? (
                  <td className="border border-black px-1 py-1 tabular-nums">
                    {line.hsnCode ?? '—'}
                  </td>
                ) : null}
                <td className="border border-black px-1 py-1 uppercase text-[9px]">
                  {line.description ?? 'ITEM'}
                </td>
                <td className="border border-black px-1 py-1 text-right tabular-nums">{line.quantity}</td>
                <td className="border border-black px-1 py-1 text-right tabular-nums">
                  {formatMoney(line.unitPrice, currency)}
                </td>
                <td className="border border-black px-1 py-1 text-right tabular-nums">
                  {formatMoney(line.lineSubtotal, currency)}
                </td>
                <td className="border border-black px-1 py-1 text-right tabular-nums">
                  {line.taxAmount != null ? formatMoney(line.taxAmount, currency) : '—'}
                </td>
                <td className="border border-black px-1 py-1 text-right tabular-nums font-semibold">
                  {formatMoney(line.lineTotal, currency)}
                </td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td colSpan={totalLabelColSpan} className="border border-black px-1 py-1.5 text-right uppercase">
                Total
              </td>
              <td className="border border-black px-1 py-1.5 text-right tabular-nums">
                {formatMoney(tableTotals.taxable, currency)}
              </td>
              <td className="border border-black px-1 py-1.5 text-right tabular-nums">
                {formatMoney(tableTotals.vat, currency)}
              </td>
              <td className="border border-black px-1 py-1.5 text-right tabular-nums">
                {formatMoney(tableTotals.total, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 border border-black border-t-0">
        <GridCell label="Bank details">
          {hasBank ? (
            <>
              <MetaRow label="Bank" value={company.bankName} />
              <MetaRow label="Beneficiary Name" value={company.bankAccountName ?? company.name} />
              <MetaRow label="IBAN" value={company.bankIban} />
              <MetaRow label="Account Number" value={company.bankAccountNumber} />
              <MetaRow label="SWIFT Code" value={company.bankSwift} />
            </>
          ) : (
            <p className="text-gray-600 italic">
              Add bank details under Settings → Company → Invoice &amp; bank (optional).
            </p>
          )}
        </GridCell>
        <GridCell>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium">{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>{vatLabel} Total</span>
              <span className="tabular-nums font-medium">{formatMoney(taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-black pt-1 text-base font-bold">
              <span>Grand Total</span>
              <span className="tabular-nums">{formatMoney(total, currency)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Amount Paid</span>
              <span className="tabular-nums">{formatMoney(amountPaid, currency)}</span>
            </div>
            <div className="flex justify-between gap-2 font-bold">
              <span>Balance Due</span>
              <span className="tabular-nums">{formatMoney(balance, currency)}</span>
            </div>
          </div>
        </GridCell>
      </div>

      <div className="mt-4 space-y-3 border border-black p-3">
        {notes || company.invoiceFooterNotes ? (
          <div>
            <p className="font-bold mb-1">Notes</p>
            <p className="whitespace-pre-line">{notes ?? company.invoiceFooterNotes}</p>
          </div>
        ) : null}
        {company.invoiceTerms ? (
          <div>
            <p className="font-bold mb-1">Terms &amp; Conditions</p>
            <p className="whitespace-pre-line">{company.invoiceTerms}</p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
          <div>
            <div className="border-b border-dotted border-black h-8" />
            <p className="mt-1 font-semibold">Customer signature</p>
            <p className="text-[10px] text-gray-600">Date: _______________</p>
          </div>
          <div>
            <div className="border border-dotted border-black h-16" />
            <p className="mt-1 font-semibold">Authorized signature &amp; stamp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
