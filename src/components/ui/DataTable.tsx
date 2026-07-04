import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTableSort } from '../../hooks/useTableSort';
import type { SortableValue, TableSortState } from '../../utils/tableSort';
import {
  listTableWrapClass,
  tableCellClass,
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableTruncateCellClass,
} from '../../constants/ui';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  sortValue?: (row: T) => SortableValue;
  truncate?: boolean;
  className?: string;
  headerClassName?: string;
  render: (row: T, rowIndex: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  defaultSort?: TableSortState | null;
  wrapClassName?: string;
  rowClassName?: string;
  emptyMessage?: string;
}

function headerAlignClass(align: DataTableColumn<unknown>['align']): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

function cellAlignClass(align: DataTableColumn<unknown>['align']): string {
  if (align === 'right') return 'text-right tabular-nums';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

function SortHeaderButton({
  label,
  active,
  direction,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: TableSortState['direction'];
  align: DataTableColumn<unknown>['align'];
  onClick: () => void;
}) {
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 max-w-full hover:text-gray-700 dark:hover:text-gray-200 ${
        align === 'right' ? 'ml-auto' : ''
      } ${active ? 'text-gray-800 dark:text-gray-100' : ''}`}
    >
      <span>{label}</span>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}
        aria-hidden
      />
    </button>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  defaultSort = null,
  wrapClassName = listTableWrapClass,
  rowClassName = 'bg-white dark:bg-gray-800',
  emptyMessage,
}: DataTableProps<T>) {
  const { sortedRows, sort, toggleSort } = useTableSort(rows, columns, defaultSort);

  if (rows.length === 0 && emptyMessage) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{emptyMessage}</p>
    );
  }

  return (
    <div className={wrapClassName}>
      <table className={tableClass}>
        <thead>
          <tr className={tableHeadRowClass}>
            {columns.map((column) => {
              const align = column.align ?? 'left';
              const isActive = sort?.key === column.key;
              const canSort = Boolean(column.sortable && column.sortValue);

              return (
                <th
                  key={column.key}
                  className={`${tableHeadCellClass} ${headerAlignClass(align)} ${column.headerClassName ?? ''}`}
                >
                  {canSort ? (
                    <SortHeaderButton
                      label={column.header}
                      active={isActive}
                      direction={isActive ? sort!.direction : 'asc'}
                      align={align}
                      onClick={() => toggleSort(column.key)}
                    />
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedRows.map((row, rowIndex) => (
            <tr key={rowKey(row)} className={rowClassName}>
              {columns.map((column) => {
                const align = column.align ?? 'left';
                const baseClass = column.truncate ? tableTruncateCellClass : tableCellClass;
                return (
                  <td
                    key={column.key}
                    className={`${baseClass} ${cellAlignClass(align)} ${column.className ?? ''}`}
                  >
                    {column.render(row, rowIndex)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
