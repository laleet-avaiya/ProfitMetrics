import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  'aria-label'?: string;
  controlClassName?: string;
  /** Minimum dropdown menu width in px (defaults to 240; also expands for long labels). */
  menuMinWidth?: number;
}

/** Above sticky footers, modals, and layout chrome */
const MENU_Z_INDEX = 10050;
const MENU_GAP = 4;
const MENU_MIN_WIDTH = 240;
const SEARCH_BLOCK_HEIGHT = 49;
const DEFAULT_LIST_MAX = 208;
const MIN_LIST_HEIGHT = 96;

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxListHeight: number;
}

function menuWidthForOptions(
  triggerWidth: number,
  options: SearchableSelectOption[],
  placeholder: string,
  menuMinWidth: number
): number {
  const longestChars = options.reduce(
    (max, option) => Math.max(max, option.label.length),
    placeholder.length
  );
  const estimated = longestChars * 7.5 + 56;
  return Math.min(520, Math.max(triggerWidth, menuMinWidth, estimated));
}

/** Position a fixed portal menu from viewport-relative trigger bounds. */
function computeMenuPosition(trigger: DOMRect, menuWidth: number): MenuPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = trigger.left;
  if (left + menuWidth > vw - 8) {
    left = Math.max(8, vw - menuWidth - 8);
  }

  const spaceBelow = vh - trigger.bottom - MENU_GAP;
  const spaceAbove = trigger.top - MENU_GAP;

  const listMaxBelow = Math.min(
    DEFAULT_LIST_MAX,
    Math.max(MIN_LIST_HEIGHT, spaceBelow - SEARCH_BLOCK_HEIGHT)
  );
  const listMaxAbove = Math.min(
    DEFAULT_LIST_MAX,
    Math.max(MIN_LIST_HEIGHT, spaceAbove - SEARCH_BLOCK_HEIGHT)
  );

  const minMenuHeight = SEARCH_BLOCK_HEIGHT + MIN_LIST_HEIGHT;
  const openUp =
    spaceBelow < minMenuHeight && listMaxAbove >= MIN_LIST_HEIGHT && listMaxAbove > spaceBelow;

  if (openUp) {
    const maxListHeight = listMaxAbove;
    const menuHeight = SEARCH_BLOCK_HEIGHT + maxListHeight;
    return {
      top: Math.max(MENU_GAP, trigger.top - MENU_GAP - menuHeight),
      left,
      width: menuWidth,
      maxListHeight,
    };
  }

  return {
    top: trigger.bottom + MENU_GAP,
    left,
    width: menuWidth,
    maxListHeight: listMaxBelow,
  };
}

function emitChange(onChange: SearchableSelectProps['onChange'], value: string) {
  onChange?.({ target: { value } } as ChangeEvent<HTMLSelectElement>);
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  required = false,
  name,
  id,
  'aria-label': ariaLabel,
  controlClassName = '',
  menuMinWidth = MENU_MIN_WIDTH,
}: SearchableSelectProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<MenuPosition | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = menuWidthForOptions(rect.width, options, placeholder, menuMinWidth);
    setMenuStyle(computeMenuPosition(rect, width));
  }, [menuMinWidth, options, placeholder]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setMenuStyle(null);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = menuWidthForOptions(rect.width, options, placeholder, menuMinWidth);
      setMenuStyle(computeMenuPosition(rect, width));
    }
    setOpen(true);
  }, [disabled, menuMinWidth, options, placeholder]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const handleScrollOrResize = () => updateMenuPosition();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const menu = document.getElementById(listboxId);
      if (menu?.contains(target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.visualViewport?.addEventListener('resize', handleScrollOrResize);
    window.visualViewport?.addEventListener('scroll', handleScrollOrResize);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.visualViewport?.removeEventListener('resize', handleScrollOrResize);
      window.visualViewport?.removeEventListener('scroll', handleScrollOrResize);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, listboxId, open, updateMenuPosition]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const pick = (nextValue: string) => {
    emitChange(onChange, nextValue);
    close();
  };

  const stopListScrollPropagation = (event: WheelEvent | TouchEvent) => {
    event.stopPropagation();
  };

  return (
    <>
      {name ? (
        <input type="hidden" name={name} value={value} required={required} readOnly />
      ) : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        className={`inline-flex w-full min-w-0 items-center justify-between gap-2 text-left ${controlClassName} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`.trim()}
      >
        <span
          className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${
            selected ? '' : 'text-gray-500 dark:text-gray-400'
          }`}
          title={selected?.label ?? placeholder}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              id={listboxId}
              role="listbox"
              data-searchable-select-menu
              style={{
                position: 'fixed',
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
                zIndex: MENU_Z_INDEX,
              }}
              className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col"
            >
              <div className="shrink-0 p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full h-8 pl-8 pr-2 text-sm rounded-md bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <ul
                className="searchable-select-list overflow-y-auto overscroll-contain py-1"
                style={{ maxHeight: menuStyle.maxListHeight }}
                onWheel={stopListScrollPropagation}
                onTouchMove={stopListScrollPropagation}
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No matches
                  </li>
                ) : (
                  filtered.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <li key={`${option.value}-${option.label}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => pick(option.value)}
                          className={`w-full text-left px-3 py-2.5 text-sm whitespace-normal break-words transition-colors touch-manipulation ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                              : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function optionsFromSelectChildren(children: ReactNode): SearchableSelectOption[] {
  const options: SearchableSelectOption[] = [];

  const visit = (nodes: ReactNode) => {
    if (nodes == null || typeof nodes === 'boolean') return;

    if (Array.isArray(nodes)) {
      nodes.forEach(visit);
      return;
    }

    if (typeof nodes !== 'object' || !('props' in nodes)) return;

    const element = nodes as { type?: unknown; props?: { value?: string; children?: ReactNode } };
    if (element.type === 'option') {
      const label =
        typeof element.props?.children === 'string'
          ? element.props.children
          : Array.isArray(element.props?.children)
            ? element.props.children.join('')
            : String(element.props?.children ?? '');
      options.push({
        value: String(element.props?.value ?? ''),
        label,
      });
      return;
    }

    if (element.props?.children) {
      visit(element.props.children);
    }
  };

  visit(children);
  return options;
}
