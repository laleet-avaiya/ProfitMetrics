import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Layers,
  LineChart,
  PieChart,
  Receipt,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionPage } from '../../components/SectionPage/SectionPage';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/ui/Card';
import { REPORT_CATALOG, type ReportId } from '../../constants/reportCatalog';

const REPORT_ICONS: Record<ReportId, LucideIcon> = {
  'profit-loss': BarChart3,
  'sales-by-product': Layers,
  'sales-by-platform': Store,
  'expense-breakdown': PieChart,
  'tax-summary': Receipt,
  trend: LineChart,
};

export function Reports() {
  const navigate = useNavigate();

  return (
    <SectionPage
      title="Reports"
      description="Choose a report, set the date range on the next screen, and generate insights for your business."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORT_CATALOG.map((report) => {
          const Icon = REPORT_ICONS[report.id];
          return (
            <Card
              key={report.id}
              className="flex flex-col gap-3 p-4 hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {report.title}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {report.description}
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  Generate report
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </SectionPage>
  );
}
