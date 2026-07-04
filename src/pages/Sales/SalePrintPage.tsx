import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { PageShell } from "../../components/PageShell/PageShell";
import { Button } from "../../components/Button/Button";
import { Select } from "../../components/Select/Select";
import { LoadingView } from "../../components/AppLoader/AppLoader";
import { InvoicePrintView } from "../../components/SalesDocumentPrint/InvoicePrintView";
import type { SalesDocumentPrintProps } from "../../components/SalesDocumentPrint/SalesDocumentPrint";
import {
  getStoredInvoicePrintFormat,
  INVOICE_PRINT_FORMAT_OPTIONS,
  type InvoicePrintFormat,
  storeInvoicePrintFormat,
} from "../../constants/invoicePrintFormats";
import { useAuth } from "../../hooks/useAuth";
import { firestoreService } from "../../services/firestore";
import { buildSalePrintProps } from "../../utils/salesDocumentPrint";

type PrintProps = Omit<SalesDocumentPrintProps, "currency">;

function DocumentPrintShell({
  backTo,
  backLabel,
  loadingLabel,
  notFoundTitle,
}: {
  backTo: string;
  backLabel: string;
  loadingLabel: string;
  notFoundTitle: string;
}) {
  const { company } = useAuth();
  const navigate = useNavigate();
  const { saleId } = useParams();
  const id = saleId;
  const currency = company?.currency ?? "AED";

  const [printProps, setPrintProps] = useState<PrintProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [printFormat, setPrintFormat] = useState<InvoicePrintFormat>(
    getStoredInvoicePrintFormat,
  );

  useEffect(() => {
    if (!company || !id) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const sale = await firestoreService.sales.get(company.id, id);
      if (!sale || sale.deleted) return null;
      return buildSalePrintProps(sale, company);
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
  }, [company, id]);

  if (loading) {
    return (
      <PageShell>
        <LoadingView message={loadingLabel} size="xl" className="py-20" />
      </PageShell>
    );
  }

  if (notFound || !printProps || !company) {
    return (
      <PageShell>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          {notFoundTitle}
        </p>
        <Button variant="outline" onClick={() => navigate(backTo)}>
          {backLabel}
        </Button>
      </PageShell>
    );
  }

  return (
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
            options={INVOICE_PRINT_FORMAT_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
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
      <InvoicePrintView
        format={printFormat}
        {...printProps}
        currency={currency}
      />
    </PageShell>
  );
}

export function SalePrintPage() {
  return (
    <DocumentPrintShell
      backTo="/sales"
      backLabel="Back to sales"
      loadingLabel="Preparing invoice…"
      notFoundTitle="Sale not found."
    />
  );
}
