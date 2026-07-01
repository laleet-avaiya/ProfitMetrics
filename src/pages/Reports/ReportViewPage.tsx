import { Navigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { ReportDateFilters } from '../../components/ReportDateFilters/ReportDateFilters';
import { getReportDefinition, type ReportId } from '../../constants/reportCatalog';
import { useReportData } from '../../hooks/useReportData';
import { ReportContent } from './ReportContent';

export function ReportViewPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const report = getReportDefinition(reportId);

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
    summary,
    hasData,
  } = useReportData();

  if (!report) {
    return <Navigate to="/reports" replace />;
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader title={report.title} description={report.description} />

        <div className="space-y-4">
          <ReportDateFilters
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            rangeLabel={dateRange.label}
          />

          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Generating report…</p>
            </div>
          ) : (
            <ReportContent
              reportId={report.id as ReportId}
              currency={currency}
              filteredSales={filteredSales}
              filteredInvoices={filteredInvoices}
              filteredExpenses={filteredExpenses}
              summary={summary}
              hasData={hasData}
            />
          )}
        </div>
      </PageShell>
    </Layout>
  );
}
