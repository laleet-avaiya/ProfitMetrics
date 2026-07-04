import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTableSort } from '../../hooks/useTableSort';
import type { SortableValue, TableSortState } from '../../utils/tableSort';
import {
  tableCellClass,
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableWrapClass,
} from '../../constants/ui';

export interface SpreadsheetColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  sortable?: boolean;
  sortValue?: (row: T) => SortableValue;
  render: (row: T, rowIndex: number) => ReactNode;
}

export interface SpreadsheetFooterRow {
  cells: ReactNode[];
}

interface SpreadsheetTableProps<T> {
  columns: SpreadsheetColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  footerRows?: SpreadsheetFooterRow[];
  emptyMessage?: string;
  showRowNumbers?: boolean;
  defaultSort?: TableSortState | null;
}

function headerAlignClass(align: SpreadsheetColumn<unknown>['align']): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export function SpreadsheetTable<T>({
  columns,
  rows,
  rowKey,
  footerRows = [],
  emptyMessage = 'No rows to display.',
  showRowNumbers = true,
  defaultSort = null,
}: SpreadsheetTableProps<T>) {
  const { sortedRows, sort, toggleSort } = useTableSort(rows, columns, defaultSort);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{emptyMessage}</p>
    );
  }

  const colSpan = columns.length + (showRowNumbers ? 1 : 0);

  return (
    <div
      className={`${tableWrapClass} max-h-[min(70vh,720px)] overflow-auto shadow-sm`}
    >
      <table className={`${tableClass} border-collapse`}>
        <thead className="sticky top-0 z-10">
          <tr className={tableHeadRowClass}>
            {showRowNumbers ? (
              <th
                className={`${tableHeadCellClass} w-10 text-center text-[11px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/95`}
              >
                #
              </th>
            ) : null}
            {columns.map((column) => {
              const align = column.align ?? 'left';
              const isActive = sort?.key === column.key;
              const canSort = Boolean(column.sortable && column.sortValue);

              return (
                <th
                  key={column.key}
                  className={`${tableHeadCellClass} border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/95 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${headerAlignClass(align)}`}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 ${
                        align === 'right' ? 'ml-auto' : ''
                      } ${isActive ? 'text-gray-800 dark:text-gray-100' : ''}`}
                    >
                      <span>{column.header}</span>
                      {isActive ? (
                        sort!.direction === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
          {sortedRows.map((row, rowIndex) => (
            <tr
              key={rowKey(row, rowIndex)}
              className="bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-750/80 transition-colors"
            >
              {showRowNumbers ? (
                <td
                  className={`${tableCellClass} w-10 text-center text-xs text-gray-400 dark:text-gray-500 tabular-nums`}
                >
                  {rowIndex + 1}
                </td>
              ) : null}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${tableCellClass} text-gray-900 dark:text-gray-100 ${
                    column.align === 'right'
                      ? 'text-right tabular-nums'
                      : column.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  } ${column.className ?? ''}`}
                >
                  {column.render(row, rowIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footerRows.length > 0 ? (
          <tfoot>
            {footerRows.map((footer, index) => (
              <tr
                key={`footer-${index}`}
                className="bg-gray-50 dark:bg-gray-900/60 font-semibold text-gray-900 dark:text-white"
              >
                {footer.cells.length === 1 ? (
                  <td
                    colSpan={colSpan}
                    className={`${tableCellClass} border-t border-gray-200 dark:border-gray-700`}
                  >
                    {footer.cells[0]}
                  </td>
                ) : (
                  footer.cells.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`${tableCellClass} border-t border-gray-200 dark:border-gray-700`}
                    >
                      {cell}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
