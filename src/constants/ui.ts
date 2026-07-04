/**
 * Shared UI class tokens — keep form controls, cards, and typography consistent app-wide.
 * Tailwind utility groups (14px base, 36px controls, compact spacing).
 */

export const fieldLabelClass =
  'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';

export const fieldHintClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

export const fieldErrorClass = 'mt-1 text-xs text-red-600 dark:text-red-400';

export const controlBaseClass = [
  'text-sm rounded-md',
  'bg-white dark:bg-gray-800',
  'text-gray-900 dark:text-white',
  'placeholder-gray-500 dark:placeholder-gray-400',
  'border border-gray-300 dark:border-gray-600',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
  'transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');

export const inputControlClass = `${controlBaseClass} h-9 px-3 w-full`;

export const selectControlClass = `${controlBaseClass} h-9 px-3 w-full`;

/** Compact toolbar filter — fixed width, never stretches on desktop */
export const filterSelectControlClass = `${controlBaseClass} h-9 px-2.5 w-[8.75rem] max-w-full shrink-0`;

/** Wider toolbar filter for category / vendor labels */
export const filterSelectWideControlClass = `${controlBaseClass} h-9 px-2.5 w-[10rem] max-w-full shrink-0`;

/** Inline date / short inputs in filter toolbars */
export const inlineInputControlClass = `${controlBaseClass} h-9 px-3 w-[8.75rem] max-w-full shrink-0`;

/** Compact controls inside data tables */
export const tableInputControlClass = `${controlBaseClass} h-8 px-2 w-full min-w-0 text-sm`;

export const textareaControlClass = `${controlBaseClass} min-h-[72px] px-3 py-2 resize-y`;

export const cardClass =
  'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm';

export const cardPaddingClass = 'p-4';

export const pageShellClass = 'w-full space-y-4';

export const pageTitleClass = 'text-lg sm:text-xl font-semibold text-gray-900 dark:text-white';

export const pageDescriptionClass = 'mt-0.5 text-sm text-gray-600 dark:text-gray-400';

export const sectionTitleClass = 'text-sm font-semibold text-gray-900 dark:text-white';

export const sectionDescriptionClass = 'text-xs text-gray-500 dark:text-gray-400 mt-0.5';

export const statLabelClass =
  'text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide';

export const statValueClass =
  'mt-0.5 text-lg font-semibold text-gray-900 dark:text-white tabular-nums';

export const statSubtextClass = 'text-xs text-gray-500 dark:text-gray-400 mt-0.5';

export const tableWrapClass =
  'overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700';

/** List pages: desktop table inside card toolbars */
export const listTableWrapClass =
  'hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700';

export const tableClass = 'w-full text-sm';

export const tableHeadRowClass =
  'bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide';

export const tableCellClass = 'px-3 py-2 align-middle whitespace-nowrap';

export const tableHeadCellClass = 'px-3 py-2';

/** Single-line cell with ellipsis when content is long */
export const tableTruncateCellClass =
  'px-3 py-2 align-middle max-w-[11rem] truncate';

export const emptyStateClass =
  'text-sm text-gray-500 dark:text-gray-400 text-center py-8 px-4 max-w-md mx-auto border border-dashed border-gray-300 dark:border-gray-600 rounded-md';

export const emptyStateWrapClass =
  'rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 sm:p-10 text-center flex flex-col items-center';

export const emptyStateIconClass = 'w-10 h-10 text-gray-300 dark:text-gray-600 mb-3 shrink-0';

export const emptyStateTitleClass = 'text-sm font-medium text-gray-700 dark:text-gray-300';

export const emptyStateDescriptionClass =
  'text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto leading-relaxed text-center';

/** Centered helper text outside the dashed empty-state box */
export const emptyStateMessageClass =
  'text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed text-center';

export const emptyStateActionClass = 'mt-4';

export const toolbarClass = 'flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between';

export const filterRowClass =
  'flex flex-col sm:flex-row gap-2 flex-wrap sm:items-center flex-1 min-w-0';

/** Desktop split: form fields left, profit-preview table right (moderate preview width) */
export const economicsSplitLayoutClass =
  'grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:gap-5 xl:items-start';

export const economicsFieldsColumnClass = 'space-y-4 min-w-0';

export const economicsPreviewColumnClass = 'xl:sticky xl:top-4 mt-4 xl:mt-0 min-w-0';
