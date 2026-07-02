import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  onSend,
  disabled = false,
  sending = false,
  placeholder = 'Message AI Assistant…',
}: ChatComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled && !sending;

  const handleSend = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-200/80 bg-white/90 px-3 py-3 backdrop-blur-md safe-area-inset-bottom dark:border-gray-700/80 dark:bg-gray-900/90 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-lg shadow-gray-200/50 ring-1 ring-black/[0.03] focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:shadow-none dark:ring-white/5 dark:focus-within:border-indigo-500">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled || sending}
            placeholder={placeholder}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 dark:text-white dark:placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={sending ? 'Sending' : 'Send message'}
            className={`mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
              canSend
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
            }`}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
            )}
          </button>
        </div>
        <p className="mt-2 hidden text-center text-[11px] text-gray-400 sm:block dark:text-gray-500">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
