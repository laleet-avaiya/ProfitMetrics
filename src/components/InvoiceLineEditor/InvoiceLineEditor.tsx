import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { SearchableSelect } from '../SearchableSelect/SearchableSelect';
import { TaxModeField } from '../TaxModeField/TaxModeField';
import type { Product } from '../../types';
import { TaxType } from '../../types';
import type { InvoiceLineFormState } from '../../utils/invoiceHelpers';
import { formatMoney } from '../../utils/profit';
import { selectControlClass, tableCellClass, tableInputControlClass } from '../../constants/ui';

const taxTypeOptions = [
  { value: TaxType.NONE, label: 'None' },
  { value: TaxType.VAT, label: 'VAT' },
  { value: TaxType.GST, label: 'GST' },
  { value: TaxType.SALES_TAX, label: 'Sales tax' },
];

function parseQty(value: string): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseMoney(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

interface InvoiceLineEditorProps {
  line: InvoiceLineFormState;
  index: number;
  products: Product[];
  currency: string;
  canRemove: boolean;
  onChange: (patch: Partial<InvoiceLineFormState>) => void;
  onProductSelect: (productId: string) => void;
  onVariantSelect: (variantId: string) => void;
  onRemove: () => void;
  layout?: 'card' | 'table';
}

export function InvoiceLineEditor({
  line,
  index,
  products,
  currency,
  canRemove,
  onChange,
  onProductSelect,
  onVariantSelect,
  onRemove,
  layout = 'card',
}: InvoiceLineEditorProps) {
  const productOptions = useMemo(
    () => [
      { value: '', label: 'Select product…' },
      ...products.map((p) => ({ value: p.id, label: p.name })),
    ],
    [products]
  );

  const selectedProductForVariants = products.find((p) => p.id === line.productId);
  const variantOptions = useMemo(() => {
    const variants = selectedProductForVariants?.variants ?? [];
    if (variants.length === 0) return [];
    return [
      { value: '', label: 'Select variant…' },
      ...variants.map((v) => ({ value: v.id, label: v.label })),
    ];
  }, [selectedProductForVariants]);
  const hasVariants = variantOptions.length > 0;

  const lineTotal = useMemo(() => {
    const qty = parseQty(line.quantity);
    const unit = parseMoney(line.unitPrice);
    return qty * unit;
  }, [line.quantity, line.unitPrice]);

  const selectedProduct = products.find((p) => p.id === line.productId);
  const filled = line.isCustom ? line.productName.trim().length > 0 : Boolean(line.productId);

  const setMode = (isCustom: boolean) => {
    if (isCustom === line.isCustom) return;
    onChange(isCustom ? { isCustom: true, productId: '' } : { isCustom: false, productName: '' });
  };

  const modeToggleClass =
    'text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline';

  const taxFields =
    line.taxType !== TaxType.NONE ? (
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Tax %"
          type="number"
          min="0"
          step="0.01"
          value={line.taxPercentage}
          onChange={(e) => onChange({ taxPercentage: e.target.value })}
        />
        <TaxModeField value={line.taxMode} onChange={(taxMode) => onChange({ taxMode })} />
      </div>
    ) : null;

  if (layout === 'table') {
    return (
      <>
        <tr className="border-t border-gray-100 dark:border-gray-700/80 hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
          <td className={`${tableCellClass} w-8 text-xs text-gray-500 tabular-nums`}>{index + 1}</td>
          <td className={`${tableCellClass} min-w-[16rem] max-w-[24rem]`}>
            {line.isCustom ? (
              <input
                type="text"
                value={line.productName}
                onChange={(e) => onChange({ productName: e.target.value })}
                placeholder="Custom item name…"
                className={tableInputControlClass}
              />
            ) : (
              <SearchableSelect
                options={productOptions}
                value={line.productId}
                onChange={(e) => onProductSelect(e.target.value)}
                placeholder="Product…"
                controlClassName={`${selectControlClass} h-8 px-2`}
              />
            )}
            {!line.isCustom && hasVariants ? (
              <div className="mt-1">
                <SearchableSelect
                  options={variantOptions}
                  value={line.variantId}
                  onChange={(e) => onVariantSelect(e.target.value)}
                  placeholder="Variant…"
                  controlClassName={`${selectControlClass} h-8 px-2`}
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setMode(!line.isCustom)}
              className={`mt-1 ${modeToggleClass}`}
            >
              {line.isCustom ? 'Pick from catalog' : 'Enter custom item'}
            </button>
          </td>
          <td className={`${tableCellClass} w-16`}>
            <input
              type="number"
              min="1"
              step="1"
              value={line.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
              className={tableInputControlClass}
            />
          </td>
          <td className={`${tableCellClass} w-24`}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice}
              onChange={(e) => onChange({ unitPrice: e.target.value })}
              className={tableInputControlClass}
            />
          </td>
          <td className={`${tableCellClass} w-24`}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.purchasePrice}
              onChange={(e) => onChange({ purchasePrice: e.target.value })}
              className={tableInputControlClass}
            />
          </td>
          <td className={`${tableCellClass} w-24 text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300`}>
            {filled ? formatMoney(lineTotal, currency) : '—'}
          </td>
          <td className={`${tableCellClass} w-20`}>
            <div className="flex items-center justify-end gap-0.5">
              {canRemove ? (
                <button
                  type="button"
                  onClick={onRemove}
                  className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label="Remove line"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </td>
        </tr>
        <tr className="bg-gray-50/80 dark:bg-gray-900/30">
          <td colSpan={7} className="px-3 pb-3 pt-1">
            <div className="rounded-lg border border-gray-200/80 dark:border-gray-700/70 bg-white dark:bg-gray-800/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                Item &amp; tax details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl items-start">
                <Input
                  label="HSN / SAC code"
                  value={line.hsnCode}
                  onChange={(e) => onChange({ hsnCode: e.target.value })}
                  placeholder="Optional"
                />
                <Select
                  label="Tax type"
                  value={line.taxType}
                  onChange={(e) => onChange({ taxType: e.target.value as TaxType })}
                  options={taxTypeOptions}
                />
                {line.taxType !== TaxType.NONE ? (
                  <>
                    <Input
                      label="Tax %"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.taxPercentage}
                      onChange={(e) => onChange({ taxPercentage: e.target.value })}
                    />
                    <TaxModeField
                      value={line.taxMode}
                      onChange={(taxMode) => onChange({ taxMode })}
                    />
                  </>
                ) : (
                  <p className="sm:col-span-2 sm:self-center text-xs text-gray-500 dark:text-gray-400">
                    No tax applied to this line.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-900/30">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Line {index + 1}
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {line.isCustom
              ? line.productName.trim() || 'Custom item'
              : (selectedProduct?.name ?? 'Choose a product')}
          </p>
          {filled ? (
            <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400 mt-0.5">
              {formatMoney(lineTotal, currency)} line total
            </p>
          ) : null}
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
            aria-label="Remove line"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <div className="p-3 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {line.isCustom ? 'Custom item' : 'Product'}
            </span>
            <button
              type="button"
              onClick={() => setMode(!line.isCustom)}
              className={modeToggleClass}
            >
              {line.isCustom ? 'Pick from catalog' : 'Enter custom item'}
            </button>
          </div>
          {line.isCustom ? (
            <Input
              value={line.productName}
              onChange={(e) => onChange({ productName: e.target.value })}
              placeholder="e.g. Custom tailoring service"
            />
          ) : (
            <Select
              value={line.productId}
              onChange={(e) => onProductSelect(e.target.value)}
              options={productOptions}
            />
          )}
          {!line.isCustom && hasVariants ? (
            <div className="mt-2">
              <Select
                label="Variant"
                value={line.variantId}
                onChange={(e) => onVariantSelect(e.target.value)}
                options={variantOptions}
              />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Qty"
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
          <Input
            label="Unit price"
            type="number"
            min={0}
            step="0.01"
            value={line.unitPrice}
            onChange={(e) => onChange({ unitPrice: e.target.value })}
          />
          <Input
            label="COGS / unit"
            type="number"
            min={0}
            step="0.01"
            value={line.purchasePrice}
            onChange={(e) => onChange({ purchasePrice: e.target.value })}
          />
          <Select
            label="Tax"
            value={line.taxType}
            onChange={(e) => onChange({ taxType: e.target.value as TaxType })}
            options={taxTypeOptions}
          />
          <Input
            label="HSN / SAC code"
            value={line.hsnCode}
            onChange={(e) => onChange({ hsnCode: e.target.value })}
            placeholder="Optional"
          />
        </div>
        {taxFields}
      </div>
    </div>
  );
}
