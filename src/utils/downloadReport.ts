import type { ReportExportContext } from './reportExport';

/** Lazy-loads XLS libraries and report builders — keeps xlsx out of the main bundle. */
export async function downloadReportWorkbook(
  ctx: ReportExportContext,
  filenameBase: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ buildReportWorkbook, canExportReport }, { downloadWorkbook, slugifyFilename }] =
    await Promise.all([import('./reportExport'), import('./exportSpreadsheet')]);

  if (!canExportReport(ctx)) {
    return { ok: false, reason: 'Nothing to export for this report.' };
  }

  const sheets = buildReportWorkbook(ctx);
  if (sheets.length === 0) {
    return { ok: false, reason: 'Nothing to export for this report.' };
  }

  const stamp = new Date().toISOString().slice(0, 10);
  downloadWorkbook(`${slugifyFilename(filenameBase)}-${stamp}`, sheets);
  return { ok: true };
}
