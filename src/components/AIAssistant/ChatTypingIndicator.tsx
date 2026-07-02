import { Bot, Loader2 } from 'lucide-react';

interface ChatTypingIndicatorProps {
  phase: 'thinking' | 'analyzing';
}

export function ChatTypingIndicator({ phase }: ChatTypingIndicatorProps) {
  return (
    <div className="flex justify-start px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex items-end gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="rounded-2xl rounded-bl-md border border-gray-200/80 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {phase === 'analyzing' ? 'Analyzing your data…' : 'Thinking…'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
