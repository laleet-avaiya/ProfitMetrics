import { formatMoney } from '../../utils/profit';

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </p>
      {description ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      ) : null}
    </div>
  );
}

export type SectionTaxDirection = 'credit' | 'debit';

interface SectionLinePreviewProps {
  /** e.g. Cost per unit, Revenue per unit */
  amountLabel: string;
  amount: number;
  taxDirection: SectionTaxDirection;
  taxAmount: number;
  currency: string;
  tracksTax: boolean;
  /** Defaults to per unit; set false when preview is already order-total. */
  perUnit?: boolean;
}

const taxDirectionMeta: Record<
  SectionTaxDirection,
  { label: string; valueClass: string; badgeClass: string }
> = {
  credit: {
    label: 'Tax credit (ITC)',
    valueClass: 'text-emerald-700 dark:text-emerald-400',
    badgeClass:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  debit: {
    label: 'Tax debit (output)',
    valueClass: 'text-amber-700 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
};

function PreviewRow({
  label,
  value,
  valueClassName = '',
  badgeText,
  badgeClassName = '',
}: {
  label: string;
  value: string;
  valueClassName?: string;
  badgeText?: string;
  badgeClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {badgeText ? (
          <span
            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badgeClassName}`}
          >
            {badgeText}
          </span>
        ) : null}
        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{label}</span>
      </div>
      <span
        className={`text-xs font-semibold tabular-nums shrink-0 ${valueClassName || 'text-gray-900 dark:text-white'}`}
      >
        {value}
      </span>
    </div>
  );
}

export function SectionLinePreview({
  amountLabel,
  amount,
  taxDirection,
  taxAmount,
  currency,
  tracksTax,
  perUnit = true,
}: SectionLinePreviewProps) {
  const taxMeta = taxDirectionMeta[taxDirection];
  const scopeLabel = perUnit ? 'Per unit' : 'This order';

  return (
    <div className="rounded-md border border-dashed border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2.5 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {scopeLabel} preview
      </p>

      {!tracksTax ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select a tax type above to see tax credit or debit for this line.
        </p>
      ) : (
        <>
          <PreviewRow label={amountLabel} value={formatMoney(amount, currency)} />
          <PreviewRow
            label={taxMeta.label}
            value={formatMoney(taxAmount, currency)}
            valueClassName={taxMeta.valueClass}
            badgeText={taxDirection === 'credit' ? 'ITC' : 'Out'}
            badgeClassName={taxMeta.badgeClass}
          />
        </>
      )}
    </div>
  );
}
