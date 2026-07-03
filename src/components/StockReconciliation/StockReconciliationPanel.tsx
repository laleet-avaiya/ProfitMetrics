import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Scale, Warehouse } from 'lucide-react';
import { Button } from '../Button/Button';
import { Card } from '../ui/Card';
import { LoadingView } from '../AppLoader/AppLoader';
import {
  tableCellClass,
  tableHeadCellClass,
  tableWrapClass,
} from '../../constants/ui';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import { notDeleted } from '../../hooks/useEntityList';
import {
  applyStockReconciliation,
  computeStockReconciliation,
  type StockReconciliationSummary,
} from '../../utils/stockReconciliation';

interface StockReconciliationPanelProps {
  canReconcile: boolean;
  onReconciled?: () => void;
}

export function StockReconciliationPanel({
  canReconcile,
  onReconciled,
}: StockReconciliationPanelProps) {
  const { company, user } = useAuth();
  const notification = useNotification();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<StockReconciliationSummary | null>(null);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof firestoreService.sales.getAll>>>([]);
  const [invoices, setInvoices] = useState<
    Awaited<ReturnType<typeof firestoreService.invoices.getAll>>
  >([]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [products, stock, purchases, salesList, invoiceList] = await Promise.all([
        firestoreService.products.getAll(company.id),
        firestoreService.stock.getAll(company.id),
        firestoreService.purchases.getAll(company.id),
        firestoreService.sales.getAll(company.id),
        firestoreService.invoices.getAll(company.id),
      ]);

      const activeSales = salesList.filter(notDeleted);
      const activeInvoices = invoiceList.filter(notDeleted);
      setSales(activeSales);
      setInvoices(activeInvoices);
      setSummary(
        computeStockReconciliation({
          products: products.filter(notDeleted),
          stock: stock.filter(notDeleted),
          purchases: purchases.filter(notDeleted),
          sales: activeSales,
          invoices: activeInvoices,
        })
      );
    } catch (err) {
      console.error('Failed to load stock reconciliation:', err);
      notification.error('Could not load stock reconciliation');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    void load();
  }, [load]);

  const needsAttention = useMemo(() => {
    if (!summary) return false;
    return summary.outOfSyncCount > 0;
  }, [summary]);

  function formatReconcileError(err: unknown): string {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = String((err as { code?: string }).code ?? '');
      if (code === 'permission-denied') {
        return 'Permission denied updating stock. Deploy the latest Firestore rules (firebase deploy --only firestore:rules) and ensure your role can edit products.';
      }
    }
    if (err instanceof Error && err.message) return err.message;
    return 'Failed to reconcile stock. Check permissions and try again.';
  }

  const mismatchRows = useMemo(
    () => summary?.rows.filter((row) => row.difference !== 0) ?? [],
    [summary]
  );

  const handleReconcile = () => {
    if (!company || !summary || !user) return;

    notification.confirm({
      title: 'Reconcile stock from ledger?',
      message:
        'This recalculates on-hand stock as purchase receipts minus all marketplace and offline sales. ' +
        'Use this once to fix historical records that never deducted stock. New sales will keep stock in sync.',
      confirmLabel: 'Reconcile stock',
      variant: 'primary',
      onConfirm: async () => {
        setApplying(true);
        try {
          const result = await applyStockReconciliation(
            company.id,
            summary,
            sales,
            invoices,
            user.uid
          );
          let message = `Updated ${result.updatedProducts} product(s)`;
          if (result.markedSales > 0 || result.markedInvoices > 0) {
            message += ` and marked ${result.markedSales + result.markedInvoices} historical sale(s) as synced`;
          }
          if (result.oversoldProducts.length > 0) {
            message += `. Oversold: ${result.oversoldProducts.join(', ')} (stock set to 0 for those).`;
          }
          if (result.failedSaleMarks > 0 || result.failedInvoiceMarks > 0) {
            message += `. Could not mark ${result.failedSaleMarks + result.failedInvoiceMarks} historical record(s) — stock quantities were still updated.`;
          }
          notification.success(message);
          await load();
          onReconciled?.();
        } catch (err) {
          console.error('Stock reconciliation failed:', err);
          notification.error(formatReconcileError(err));
        } finally {
          setApplying(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <Card className="py-6">
        <LoadingView message="Checking stock ledger…" size="md" />
      </Card>
    );
  }

  if (!summary || !needsAttention) {
    return null;
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex gap-3">
          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 p-2 h-fit">
            <Scale className="w-5 h-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <p className="font-semibold text-amber-950 dark:text-amber-100">Stock may be out of sync</p>
            <p className="text-sm text-amber-900/80 dark:text-amber-200/80 mt-1 leading-relaxed">
              {summary.outOfSyncCount > 0
                ? `${summary.outOfSyncCount} product(s) have a different on-hand count than purchase receipts minus sales. `
                : ''}
              {summary.pendingSaleCount > 0
                ? `${summary.pendingSaleCount} marketplace sale(s) `
                : ''}
              {summary.pendingInvoiceCount > 0
                ? `${summary.pendingInvoiceCount} offline sale(s) `
                : ''}
              {(summary.pendingSaleCount > 0 || summary.pendingInvoiceCount > 0) &&
                'were never marked as deducted from stock. '}
              Reconcile once to align historical data.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={applying}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            <Warehouse className="w-4 h-4" />
            {expanded ? 'Hide details' : 'View details'}
          </Button>
          {canReconcile ? (
            <Button variant="primary" size="sm" onClick={handleReconcile} disabled={applying}>
              {applying ? 'Reconciling…' : 'Reconcile stock'}
            </Button>
          ) : null}
        </div>
      </div>

      {summary.oversoldCount > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/30 px-3 py-2 text-sm text-rose-900 dark:text-rose-100">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {summary.oversoldCount} product(s) have more sales than purchase receipts. Reconcile will
            set those to 0 on hand and flag them below.
          </p>
        </div>
      ) : null}

      {expanded && mismatchRows.length > 0 ? (
        <div className={`${tableWrapClass} max-h-80 overflow-y-auto`}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-amber-50 dark:bg-amber-950/40">
              <tr>
                <th className={tableHeadCellClass}>Product</th>
                <th className={`${tableHeadCellClass} text-right`}>Received</th>
                <th className={`${tableHeadCellClass} text-right`}>Sold</th>
                <th className={`${tableHeadCellClass} text-right`}>Expected</th>
                <th className={`${tableHeadCellClass} text-right`}>Recorded</th>
                <th className={`${tableHeadCellClass} text-right`}>Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/60 dark:divide-amber-800/60">
              {mismatchRows.map((row) => (
                <tr key={row.productId}>
                  <td className={tableCellClass}>{row.productName}</td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>{row.receivedQty}</td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>{row.soldQty}</td>
                  <td className={`${tableCellClass} text-right tabular-nums font-medium`}>
                    {Math.max(0, row.expectedOnHand)}
                    {row.oversoldBy > 0 ? (
                      <span className="block text-xs text-rose-600 dark:text-rose-400">
                        oversold by {row.oversoldBy}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tableCellClass} text-right tabular-nums`}>{row.recordedOnHand}</td>
                  <td
                    className={`${tableCellClass} text-right tabular-nums font-semibold ${
                      row.difference > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {row.difference > 0 ? '+' : ''}
                    {row.difference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
