import * as XLSX from 'xlsx';

export interface WorkbookSheet {
  name: string;
  rows: (string | number | null | undefined)[][];
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet';
}

export function downloadWorkbook(filename: string, sheets: WorkbookSheet[]): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name));
  }

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
