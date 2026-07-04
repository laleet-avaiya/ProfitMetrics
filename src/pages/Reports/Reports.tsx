import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  Coins,
  Download,
  Layers,
  LineChart,
  PieChart,
  Receipt,
  Store,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader, PageShell } from "../../components/PageShell/PageShell";
import { Button } from "../../components/Button/Button";
import { LoadingView } from "../../components/AppLoader/AppLoader";
import { ReportDateFilters } from "../../components/ReportDateFilters/ReportDateFilters";
import { FormTabs } from "../../components/ui/FormTabs";
import {
  getReportDefinition,
  REPORT_CATALOG,
  ReportId,
  type ReportId as ReportIdType,
} from "../../constants/reportCatalog";
import { useNotification } from "../../hooks/useNotification";
import { useReportData } from "../../hooks/useReportData";
import {
  buildReportCompanyInfo,
  canExportReport,
} from "../../utils/reportExport";
import type { ProfitLossBasis } from "../../utils/reports";
import { useAuth } from "../../hooks/useAuth";
import { ReportContent } from "./ReportContent";

const DEFAULT_REPORT_ID = ReportId.PROFIT_LOSS;

const REPORT_ICONS: Record<ReportIdType, LucideIcon> = {
  [ReportId.PROFIT_LOSS]: BarChart3,
  [ReportId.GROSS_PROFIT]: Coins,
  [ReportId.SALES_BY_PRODUCT]: Layers,
  [ReportId.SALES_BY_PLATFORM]: Store,
  [ReportId.EXPENSE_BREAKDOWN]: PieChart,
  [ReportId.TAX_SUMMARY]: Receipt,
  [ReportId.TREND]: LineChart,
  [ReportId.STOCK_ON_HAND]: Warehouse,
  [ReportId.PURCHASE_ORDERS]: ClipboardList,
  [ReportId.PURCHASE_TREND]: CalendarRange,
};

const REPORT_TAB_LABELS: Record<ReportIdType, string> = {
  [ReportId.PROFIT_LOSS]: "P&L",
  [ReportId.GROSS_PROFIT]: "Gross profit",
  [ReportId.SALES_BY_PRODUCT]: "By product",
  [ReportId.SALES_BY_PLATFORM]: "By channel",
  [ReportId.EXPENSE_BREAKDOWN]: "Expenses",
  [ReportId.TAX_SUMMARY]: "Tax",
  [ReportId.TREND]: "Trend",
  [ReportId.STOCK_ON_HAND]: "Stock",
  [ReportId.PURCHASE_ORDERS]: "Purchases",
  [ReportId.PURCHASE_TREND]: "Purchase trend",
};

export function Reports() {
  const { reportId: reportIdParam } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
  const notification = useNotification();
  const { company } = useAuth();

  const report = getReportDefinition(reportIdParam);
  const activeReportId = report?.id ?? DEFAULT_REPORT_ID;

  const {
    currency,
    loading,
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    dateRange,
    filteredSales,
    filteredInvoices,
    filteredExpenses,
    filteredPurchases,
    stock,
    products,
    summary,
    hasData,
  } = useReportData();

  const [plBasis, setPlBasis] = useState<ProfitLossBasis>("paid");

  const reportTabs = useMemo(
    () =>
      REPORT_CATALOG.map((item) => ({
        id: item.id,
        label: REPORT_TAB_LABELS[item.id],
        icon: REPORT_ICONS[item.id],
      })),
    [],
  );

  const exportContext = useMemo(() => {
    if (!report) return null;
    return {
      reportId: report.id,
      reportTitle: report.title,
      company: buildReportCompanyInfo(company),
      currency,
      dateRangeLabel:
        report.id === ReportId.STOCK_ON_HAND ? "As of today" : dateRange.label,
      filteredSales,
      filteredInvoices,
      filteredExpenses,
      filteredPurchases,
      stock,
      products,
      summary,
      plBasis: report.id === ReportId.PROFIT_LOSS ? plBasis : undefined,
    };
  }, [
    report,
    company,
    currency,
    dateRange.label,
    filteredSales,
    filteredInvoices,
    filteredExpenses,
    filteredPurchases,
    stock,
    products,
    summary,
    plBasis,
  ]);

  const canDownload = Boolean(
    !loading && exportContext && canExportReport(exportContext),
  );
  const isStockReport = activeReportId === ReportId.STOCK_ON_HAND;
  const activeReport = report ?? getReportDefinition(DEFAULT_REPORT_ID)!;

  const handleDownload = async () => {
    if (!exportContext) return;
    const { downloadReportWorkbook } =
      await import("../../utils/downloadReport");
    const result = await downloadReportWorkbook(
      exportContext,
      activeReport.title,
    );
    if (!result.ok) {
      notification.error(result.reason);
    }
  };

  const setActiveReport = (id: string) => {
    if (id !== ReportId.PROFIT_LOSS) {
      setPlBasis("paid");
    }
    navigate(`/reports/${id}`, { replace: true });
  };

  if (reportIdParam && !report) {
    return <Navigate to={`/reports/${DEFAULT_REPORT_ID}`} replace />;
  }

  if (!reportIdParam) {
    return <Navigate to={`/reports/${DEFAULT_REPORT_ID}`} replace />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description={activeReport.description}
        actions={
          canDownload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" />
              Download XLS
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        {isStockReport ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
            Snapshot report — shows current stock on hand (not filtered by
            date).
          </div>
        ) : (
          <ReportDateFilters
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            rangeLabel={dateRange.label}
          />
        )}

        <FormTabs
          tabs={reportTabs}
          active={activeReportId}
          onChange={setActiveReport}
          ariaLabel="Report type"
        />

        {loading ? (
          <LoadingView
            message="Generating report…"
            size="md"
            className="py-12"
          />
        ) : (
          <ReportContent
            reportId={activeReportId}
            currency={currency}
            filteredSales={filteredSales}
            filteredInvoices={filteredInvoices}
            filteredExpenses={filteredExpenses}
            filteredPurchases={filteredPurchases}
            stock={stock}
            products={products}
            summary={summary}
            hasData={hasData}
            plBasis={plBasis}
            onPlBasisChange={setPlBasis}
          />
        )}
      </div>
    </PageShell>
  );
}
