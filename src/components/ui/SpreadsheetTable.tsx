import type { ReactNode } from 'react';
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
}

export function SpreadsheetTable<T>({
  columns,
  rows,
  rowKey,
  footerRows = [],
  emptyMessage = 'No rows to display.',
  showRowNumbers = true,
}: SpreadsheetTableProps<T>) {
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
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${tableHeadCellClass} border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/95 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                  column.align === 'right'
                    ? 'text-right'
                    : column.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
          {rows.map((row, rowIndex) => (
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
