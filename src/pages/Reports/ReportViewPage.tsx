import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Button } from '../../components/Button/Button';
import { ReportDateFilters } from '../../components/ReportDateFilters/ReportDateFilters';
import { getReportDefinition, ReportId } from '../../constants/reportCatalog';
import { useNotification } from '../../hooks/useNotification';
import { useReportData } from '../../hooks/useReportData';
import { downloadWorkbook, slugifyFilename } from '../../utils/exportSpreadsheet';
import { buildReportWorkbook, canExportReport } from '../../utils/reportExport';
import { ReportContent } from './ReportContent';

export function ReportViewPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const report = getReportDefinition(reportId);
  const notification = useNotification();

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
    stock,
    products,
    summary,
    hasData,
  } = useReportData();

  const exportContext = useMemo(() => {
    if (!report) return null;
    return {
      reportId: report.id,
      reportTitle: report.title,
      currency,
      dateRangeLabel:
        report.id === ReportId.STOCK_ON_HAND ? 'As of today' : dateRange.label,
      filteredSales,
      filteredInvoices,
      filteredExpenses,
      stock,
      products,
      summary,
    };
  }, [
    report,
    currency,
    dateRange.label,
    filteredSales,
    filteredInvoices,
    filteredExpenses,
    stock,
    products,
    summary,
  ]);

  const canDownload = Boolean(!loading && exportContext && canExportReport(exportContext));

  const handleDownload = () => {
    if (!report || !exportContext) return;
    const sheets = buildReportWorkbook(exportContext);
    if (sheets.length === 0) {
      notification.error('Nothing to export for this report.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadWorkbook(`${slugifyFilename(report.title)}-${stamp}`, sheets);
  };

  if (!report) {
    return <Navigate to="/reports" replace />;
  }

  const isStockReport = report.id === ReportId.STOCK_ON_HAND;

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={report.title}
          description={report.description}
          actions={
            canDownload ? (
              <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Download XLS
              </Button>
            ) : undefined
          }
        />

        <div className="space-y-4">
          {isStockReport ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              Snapshot report — shows current stock on hand (not filtered by date).
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

          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Generating report…</p>
            </div>
          ) : (
            <ReportContent
              reportId={report.id}
              currency={currency}
              filteredSales={filteredSales}
              filteredInvoices={filteredInvoices}
              filteredExpenses={filteredExpenses}
              stock={stock}
              products={products}
              summary={summary}
              hasData={hasData}
            />
          )}
        </div>
      </PageShell>
    </Layout>
  );
}
