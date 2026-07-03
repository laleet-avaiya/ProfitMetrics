import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageShell } from '../../components/PageShell/PageShell';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { InvoicePrintView } from '../../components/SalesDocumentPrint/InvoicePrintView';
import type { SalesDocumentPrintProps } from '../../components/SalesDocumentPrint/SalesDocumentPrint';
import {
  getStoredInvoicePrintFormat,
  INVOICE_PRINT_FORMAT_OPTIONS,
  type InvoicePrintFormat,
  storeInvoicePrintFormat,
} from '../../constants/invoicePrintFormats';
import { useAuth } from '../../hooks/useAuth';
import { firestoreService } from '../../services/firestore';
import { buildInvoicePrintProps, buildSalePrintProps } from '../../utils/salesDocumentPrint';

type PrintProps = Omit<SalesDocumentPrintProps, 'currency'>;

function DocumentPrintShell({
  kind,
  backTo,
  backLabel,
  loadingLabel,
  notFoundTitle,
}: {
  kind: 'sale' | 'invoice';
  backTo: string;
  backLabel: string;
  loadingLabel: string;
  notFoundTitle: string;
}) {
  const { company } = useAuth();
  const navigate = useNavigate();
  const { saleId, invoiceId } = useParams();
  const id = kind === 'sale' ? saleId : invoiceId;
  const currency = company?.currency ?? 'AED';

  const [printProps, setPrintProps] = useState<PrintProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [printFormat, setPrintFormat] = useState<InvoicePrintFormat>(getStoredInvoicePrintFormat);

  useEffect(() => {
    if (!company || !id) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      if (kind === 'sale') {
        const sale = await firestoreService.sales.get(company.id, id);
        if (!sale || sale.deleted) return null;
        return buildSalePrintProps(sale, company);
      }
      const invoice = await firestoreService.invoices.get(company.id, id);
      if (!invoice || invoice.deleted) return null;
      const customer = invoice.customerId
        ? await firestoreService.customers.get(company.id, invoice.customerId)
        : null;
      return buildInvoicePrintProps(invoice, company, customer);
    };

    load()
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
          setPrintProps(null);
        } else {
          setPrintProps(result);
          setNotFound(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company, id, kind]);

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <LoadingView message={loadingLabel} size="xl" className="py-20" />
        </PageShell>
      </Layout>
    );
  }

  if (notFound || !printProps || !company) {
    return (
      <Layout>
        <PageShell>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{notFoundTitle}</p>
          <Button variant="outline" onClick={() => navigate(backTo)}>
            {backLabel}
          </Button>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell className="print:space-y-0">
        <div className="print:hidden flex flex-wrap items-end gap-3 mb-4">
          <Button variant="outline" onClick={() => navigate(backTo)}>
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Button>
          <div className="w-52">
            <Select
              label="Invoice layout"
              value={printFormat}
              options={INVOICE_PRINT_FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(e) => {
                const next = e.target.value as InvoicePrintFormat;
                setPrintFormat(next);
                storeInvoicePrintFormat(next);
              }}
            />
          </div>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Print invoice
          </Button>
        </div>
        <InvoicePrintView format={printFormat} {...printProps} currency={currency} />
      </PageShell>
    </Layout>
  );
}

export function SalePrintPage() {
  return (
    <DocumentPrintShell
      kind="sale"
      backTo="/sales"
      backLabel="Back to sales"
      loadingLabel="Preparing invoice…"
      notFoundTitle="Sale not found."
    />
  );
}

export function InvoicePrintPage() {
  return (
    <DocumentPrintShell
      kind="invoice"
      backTo="/sales"
      backLabel="Back to sales"
      loadingLabel="Preparing invoice…"
      notFoundTitle="Invoice not found."
    />
  );
}
