import type { ReactNode } from 'react';

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
    <div className="overflow-auto rounded-lg border border-[#b4b4b4] dark:border-gray-600 shadow-sm max-h-[min(70vh,720px)]">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#217346] text-white">
            {showRowNumbers ? (
              <th className="w-10 border border-[#1a5c38] px-2 py-2 text-center text-[11px] font-semibold">
                #
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`border border-[#1a5c38] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${
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
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowKey(row, rowIndex)}
              className={
                rowIndex % 2 === 0
                  ? 'bg-white dark:bg-gray-900'
                  : 'bg-[#f3f3f3] dark:bg-gray-800/80'
              }
            >
              {showRowNumbers ? (
                <td className="border border-[#d4d4d4] dark:border-gray-600 px-2 py-1.5 text-center text-xs text-gray-500 dark:text-gray-400 tabular-nums bg-[#fafafa] dark:bg-gray-900/60">
                  {rowIndex + 1}
                </td>
              ) : null}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`border border-[#d4d4d4] dark:border-gray-600 px-3 py-1.5 text-gray-900 dark:text-gray-100 ${
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
              <tr key={`footer-${index}`} className="bg-[#eef6ef] dark:bg-emerald-950/30 font-semibold">
                {footer.cells.length === 1 ? (
                  <td colSpan={colSpan} className="border border-[#d4d4d4] dark:border-gray-600 px-3 py-2">
                    {footer.cells[0]}
                  </td>
                ) : (
                  footer.cells.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border border-[#d4d4d4] dark:border-gray-600 px-3 py-2"
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
