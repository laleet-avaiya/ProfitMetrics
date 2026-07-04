export type SortDirection = 'asc' | 'desc';

export interface TableSortState {
  key: string;
  direction: SortDirection;
}

export type SortableValue = string | number | Date | null | undefined;

function normalizeSortableValue(value: SortableValue): string | number {
  if (value == null) return '';
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return String(value).toLowerCase();
}

export function compareSortValues(
  a: SortableValue,
  b: SortableValue,
  direction: SortDirection
): number {
  const left = normalizeSortableValue(a);
  const right = normalizeSortableValue(b);

  let result = 0;
  if (typeof left === 'number' && typeof right === 'number') {
    result = left - right;
  } else {
    result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
  }

  return direction === 'asc' ? result : -result;
}

export function toggleTableSort(
  current: TableSortState | null,
  key: string
): TableSortState {
  if (current?.key !== key) {
    return { key, direction: 'asc' };
  }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
