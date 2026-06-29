import type { LineEconomicsResult } from '../../utils/profit';
import { formatMoney, formatPercent } from '../../utils/profit';
import type { SalePreviewResult } from '../../utils/saleHelpers';

interface LineEconomicsPreviewProps {
  title?: string;
  preview: LineEconomicsResult | SalePreviewResult;
  currency: string;
  tracksTax?: boolean;
  className?: string;
}

type TaxKind = 'itc' | 'output';

interface BreakdownRow {
  item: string;
  base: number;
  tax: number;
  taxKind: TaxKind | null;
  total: number;
}

function profitTone(value: number): string {
  return value >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
}

function isSalePreview(preview: LineEconomicsResult | SalePreviewResult): preview is SalePreviewResult {
  return 'returnOutcome' in preview;
}

function buildBreakdownRows(
  preview: LineEconomicsResult | SalePreviewResult,
  tracksTax: boolean
): BreakdownRow[] {
  const rows: BreakdownRow[] = [
    {
      item: 'Selling (revenue)',
      base: preview.netRevenue,
      tax: tracksTax ? preview.taxAmount : 0,
      taxKind: tracksTax ? 'output' : null,
      total: preview.grossRevenue,
    },
    {
      item: 'Purchase',
      base: preview.cogs,
      tax: tracksTax ? preview.purchaseTaxAmount : 0,
      taxKind: tracksTax ? 'itc' : null,
      total: preview.cogs + (tracksTax ? preview.purchaseTaxAmount : 0),
    },
    {
      item: 'Platform fee',
      base: preview.platformFeesBase,
      tax: tracksTax ? preview.platformFeeTaxAmount : 0,
      taxKind: tracksTax ? 'itc' : null,
      total: preview.platformFeesBase + (tracksTax ? preview.platformFeeTaxAmount : 0),
    },
    {
      item: 'Delivery',
      base: preview.shippingTotal,
      tax: tracksTax ? preview.deliveryTaxAmount : 0,
      taxKind: tracksTax ? 'itc' : null,
      total: preview.shippingTotal + (tracksTax ? preview.deliveryTaxAmount : 0),
    },
  ];

  if (isSalePreview(preview)) {
    if (preview.returnOutcome.grossAmount > 0) {
      rows.push({
        item: 'Return charges',
        base: preview.returnOutcome.base,
        tax: tracksTax ? preview.returnOutcome.tax : 0,
        taxKind: tracksTax ? 'itc' : null,
        total: preview.returnOutcome.total,
      });
    }
    if (preview.cancellationOutcome.grossAmount > 0) {
      rows.push({
        item: 'Cancellation charges',
        base: preview.cancellationOutcome.base,
        tax: tracksTax ? preview.cancellationOutcome.tax : 0,
        taxKind: tracksTax ? 'itc' : null,
        total: preview.cancellationOutcome.total,
      });
    }
  }

  return rows;
}

function TaxBadge({ kind }: { kind: TaxKind }) {
  if (kind === 'itc') {
    return (
      <span className="inline-flex text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        ITC
      </span>
    );
  }
  return (
    <span className="inline-flex text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      Out
    </span>
  );
}

function BreakdownTable({
  rows,
  currency,
  tracksTax,
  preview,
}: {
  rows: BreakdownRow[];
  currency: string;
  tracksTax: boolean;
  preview: LineEconomicsResult;
}) {
  const costBaseTotal = rows
    .filter((r) => r.item !== 'Selling (revenue)')
    .reduce((sum, r) => sum + r.base, 0);
  const costGrossTotal = rows
    .filter((r) => r.item !== 'Selling (revenue)')
    .reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200/80 dark:border-gray-700/80">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Line breakdown
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200/80 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-800/40">
              <th className="px-2.5 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">
                Item
              </th>
              <th className="px-2.5 py-1.5 text-right font-semibold text-gray-500 dark:text-gray-400">
                Base
              </th>
              {tracksTax ? (
                <th className="px-2.5 py-1.5 text-right font-semibold text-gray-500 dark:text-gray-400">
                  Tax
                </th>
              ) : null}
              <th className="px-2.5 py-1.5 text-right font-semibold text-gray-500 dark:text-gray-400">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => {
              const isRevenue = row.item === 'Selling (revenue)';
              return (
                <tr key={row.item} className="tabular-nums">
                  <td className="px-2.5 py-2 text-gray-700 dark:text-gray-300 font-medium">
                    {row.item}
                  </td>
                  <td className="px-2.5 py-2 text-right text-gray-900 dark:text-white">
                    {formatMoney(row.base, currency)}
                  </td>
                  {tracksTax ? (
                    <td className="px-2.5 py-2 text-right">
                      {row.taxKind ? (
                        <div className="flex items-center justify-end gap-1 min-w-0">
                          <TaxBadge kind={row.taxKind} />
                          <span
                            className={
                              row.taxKind === 'itc'
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                : 'text-amber-700 dark:text-amber-400 font-medium'
                            }
                          >
                            {formatMoney(row.tax, currency)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  ) : null}
                  <td
                    className={`px-2.5 py-2 text-right font-semibold ${
                      isRevenue
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {formatMoney(row.total, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/30">
            {tracksTax ? (
              <>
                <tr className="tabular-nums text-[11px]">
                  <td className="px-2.5 py-1.5 text-gray-500 dark:text-gray-400" colSpan={2}>
                    Total output tax (debit)
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                    {formatMoney(preview.taxAmount, currency)}
                  </td>
                  <td />
                </tr>
                <tr className="tabular-nums text-[11px]">
                  <td className="px-2.5 py-1.5 text-gray-500 dark:text-gray-400" colSpan={2}>
                    Total ITC (credit)
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatMoney(preview.inputTaxAmount, currency)}
                  </td>
                  <td />
                </tr>
              </>
            ) : null}
            <tr className="tabular-nums">
              <td className="px-2.5 py-2 font-semibold text-gray-700 dark:text-gray-300">
                Costs (ex-tax)
              </td>
              <td className="px-2.5 py-2 text-right font-semibold text-gray-900 dark:text-white">
                {formatMoney(costBaseTotal, currency)}
              </td>
              {tracksTax ? <td /> : null}
              <td className="px-2.5 py-2 text-right font-semibold text-gray-900 dark:text-white">
                {formatMoney(preview.totalCosts, currency)}
              </td>
            </tr>
            {tracksTax && preview.inputTaxAmount > 0 ? (
              <tr className="tabular-nums text-[11px]">
                <td className="px-2.5 py-1.5 text-gray-500 dark:text-gray-400" colSpan={tracksTax ? 3 : 1}>
                  Costs if ITC not claimed
                </td>
                <td className="px-2.5 py-1.5 text-right font-medium text-gray-700 dark:text-gray-300">
                  {formatMoney(costGrossTotal, currency)}
                </td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ProfitSummary({
  preview,
  currency,
  showItcComparison,
}: {
  preview: LineEconomicsResult;
  currency: string;
  showItcComparison: boolean;
}) {
  const profitPositive = preview.profit >= 0;

  return (
    <div
      className={`rounded-lg px-3 py-3 space-y-3 ${
        profitPositive
          ? 'bg-white/80 dark:bg-gray-900/50 ring-1 ring-emerald-200/70 dark:ring-emerald-800/50'
          : 'bg-white/80 dark:bg-gray-900/50 ring-1 ring-red-200/70 dark:ring-red-800/50'
      }`}
    >
      {showItcComparison ? (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Profit (with ITC)
              </p>
              <p className={`text-lg font-bold tabular-nums break-all ${profitTone(preview.profit)}`}>
                {formatMoney(preview.profit, currency)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Margin
              </p>
              <p className={`text-lg font-bold tabular-nums ${profitTone(preview.profit)}`}>
                {formatPercent(preview.profitMarginPercent)}
              </p>
            </div>
          </div>
          <div className="border-t border-gray-200/80 dark:border-gray-700/60 pt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Profit (without ITC)
              </p>
              <p className={`text-sm font-bold tabular-nums break-all ${profitTone(preview.profitWithoutItc)}`}>
                {formatMoney(preview.profitWithoutItc, currency)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Margin
              </p>
              <p className={`text-sm font-bold tabular-nums ${profitTone(preview.profitWithoutItc)}`}>
                {formatPercent(preview.profitMarginWithoutItcPercent)}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Profit
            </p>
            <p className={`text-lg font-bold tabular-nums break-all ${profitTone(preview.profit)}`}>
              {formatMoney(preview.profit, currency)}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Margin
            </p>
            <p className={`text-lg font-bold tabular-nums ${profitTone(preview.profit)}`}>
              {formatPercent(preview.profitMarginPercent)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function LineEconomicsPreview({
  title = 'Profit preview',
  preview,
  currency,
  tracksTax = false,
  className = '',
}: LineEconomicsPreviewProps) {
  const showItcComparison = tracksTax && preview.inputTaxAmount > 0;
  const profitPositive = preview.profit >= 0;
  const breakdownRows = buildBreakdownRows(preview, tracksTax);

  const scopeLabel =
    preview.quantity > 1 ? `Order total · ${preview.quantity} units` : 'Per unit';

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        profitPositive
          ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
          : 'border-red-200 dark:border-red-800/60 bg-red-50/40 dark:bg-red-950/20'
      } ${className}`.trim()}
    >
      <div className="px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-900/40">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{scopeLabel}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <BreakdownTable
          rows={breakdownRows}
          currency={currency}
          tracksTax={tracksTax}
          preview={preview}
        />

        <ProfitSummary preview={preview} currency={currency} showItcComparison={showItcComparison} />
      </div>
    </div>
  );
}
