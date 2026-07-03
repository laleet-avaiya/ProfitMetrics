import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import type { ProductVariant, ProductVariantOption } from '../../types';
import {
  createEmptyVariantOption,
  generateVariants,
  sanitizeVariantOptions,
} from '../../utils/variantHelpers';
import {
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableWrapClass,
} from '../../constants/ui';

interface VariantEditorProps {
  options: ProductVariantOption[];
  variants: ProductVariant[];
  currency: string;
  onOptionsChange: (options: ProductVariantOption[]) => void;
  onVariantsChange: (variants: ProductVariant[]) => void;
}

export function VariantEditor({
  options,
  variants,
  currency,
  onOptionsChange,
  onVariantsChange,
}: VariantEditorProps) {
  /** Apply new options and regenerate variants, preserving existing sku/prices/ids. */
  const applyOptions = (nextOptions: ProductVariantOption[]) => {
    onOptionsChange(nextOptions);
    onVariantsChange(generateVariants(nextOptions, variants));
  };

  const addOption = () => applyOptions([...options, createEmptyVariantOption()]);

  const removeOption = (id: string) =>
    applyOptions(options.filter((opt) => opt.id !== id));

  const updateOptionName = (id: string, name: string) =>
    applyOptions(options.map((opt) => (opt.id === id ? { ...opt, name } : opt)));

  const updateOptionValues = (id: string, raw: string) => {
    const values = raw.split(',').map((v) => v.replace(/\s+/g, ' ').trimStart());
    applyOptions(options.map((opt) => (opt.id === id ? { ...opt, values } : opt)));
  };

  const updateVariant = (id: string, patch: Partial<ProductVariant>) =>
    onVariantsChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const parsePrice = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const hasUsableOptions = sanitizeVariantOptions(options).length > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Variant options</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Add option axes like Color or Size. Enter values separated by commas. Combinations
              are generated below, each tracking its own stock.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="w-4 h-4" />
            Add option
          </Button>
        </div>

        {options.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
            No variant options. This product is tracked as a single SKU.
          </p>
        ) : (
          <div className="space-y-2">
            {options.map((opt) => (
              <div
                key={opt.id}
                className="flex flex-col sm:flex-row gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div className="sm:w-48">
                  <Input
                    label="Option name"
                    value={opt.name}
                    onChange={(e) => updateOptionName(opt.id, e.target.value)}
                    placeholder="e.g. Color"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="Values (comma separated)"
                    value={opt.values.join(', ')}
                    onChange={(e) => updateOptionValues(opt.id, e.target.value)}
                    placeholder="e.g. Red, Blue, Green"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(opt.id)}
                    aria-label="Remove option"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasUsableOptions && variants.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Variants ({variants.length})
          </p>
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr className={tableHeadRowClass}>
                  <th className={tableHeadCellClass}>Variant</th>
                  <th className={tableHeadCellClass}>SKU</th>
                  <th className={`${tableHeadCellClass} w-32`}>Purchase ({currency})</th>
                  <th className={`${tableHeadCellClass} w-32`}>Selling ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {variant.label}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={variant.sku ?? ''}
                        onChange={(e) => updateVariant(variant.id, { sku: e.target.value })}
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={variant.purchasePrice ?? ''}
                        onChange={(e) =>
                          updateVariant(variant.id, { purchasePrice: parsePrice(e.target.value) })
                        }
                        placeholder="Default"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={variant.sellingPrice ?? ''}
                        onChange={(e) =>
                          updateVariant(variant.id, { sellingPrice: parsePrice(e.target.value) })
                        }
                        placeholder="Default"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Blank price falls back to the product's platform pricing. Set stock per variant on the
            Inventory tab.
          </p>
        </div>
      ) : null}
    </div>
  );
}
