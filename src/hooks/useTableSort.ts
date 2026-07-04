import { useCallback, useMemo, useState } from 'react';
import {
  compareSortValues,
  toggleTableSort,
  type SortableValue,
  type TableSortState,
} from '../utils/tableSort';

export interface SortableColumn<T> {
  key: string;
  sortable?: boolean;
  sortValue?: (row: T) => SortableValue;
}

export function useTableSort<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  defaultSort?: TableSortState | null
) {
  const [sort, setSort] = useState<TableSortState | null>(defaultSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column?.sortable || !column.sortValue) return rows;
    const getValue = column.sortValue;
    return [...rows].sort((a, b) =>
      compareSortValues(getValue(a), getValue(b), sort.direction)
    );
  }, [rows, sort, columns]);

  const toggleSort = useCallback((key: string) => {
    setSort((current) => toggleTableSort(current, key));
  }, []);

  return { sortedRows, sort, toggleSort, setSort };
}
