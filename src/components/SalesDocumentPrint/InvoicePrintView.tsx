import { InvoicePrintFormat } from '../../constants/invoicePrintFormats';
import { ProfessionalInvoicePrint } from './ProfessionalInvoicePrint';
import { SalesDocumentPrint, type SalesDocumentPrintProps } from './SalesDocumentPrint';

export function InvoicePrintView({
  format,
  ...props
}: SalesDocumentPrintProps & { format: InvoicePrintFormat }) {
  if (format === InvoicePrintFormat.PROFESSIONAL) {
    return <ProfessionalInvoicePrint {...props} />;
  }
  return <SalesDocumentPrint {...props} />;
}
