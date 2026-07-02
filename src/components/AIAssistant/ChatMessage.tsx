import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

function formatContent(content: string): ReactNode[] {
  const paragraphs = content.split(/\n{2,}/);
  return paragraphs.map((paragraph, index) => {
    const lines = paragraph.split('\n');
    const isList = lines.every((line) => /^[-*•]\s/.test(line.trim()) || line.trim() === '');

    if (isList && lines.some((line) => line.trim())) {
      return (
        <ul key={index} className="my-2 list-disc space-y-1 pl-5">
          {lines
            .filter((line) => line.trim())
            .map((line, lineIndex) => (
              <li key={lineIndex}>{line.replace(/^[-*•]\s*/, '')}</li>
            ))}
        </ul>
      );
    }

    if (paragraph.trim().startsWith('### ')) {
      return (
        <h4 key={index} className="mb-1 mt-3 text-sm font-semibold">
          {paragraph.replace(/^###\s*/, '')}
        </h4>
      );
    }

    if (paragraph.trim().startsWith('## ')) {
      return (
        <h3 key={index} className="mb-1 mt-3 text-base font-semibold">
          {paragraph.replace(/^##\s*/, '')}
        </h3>
      );
    }

    if (paragraph.trim().startsWith('# ')) {
      return (
        <h2 key={index} className="mb-1 mt-3 text-lg font-semibold">
          {paragraph.replace(/^#\s*/, '')}
        </h2>
      );
    }

    return (
      <p key={index} className="my-1.5 whitespace-pre-wrap leading-relaxed">
        {paragraph}
      </p>
    );
  });
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex max-w-[88%] flex-row-reverse items-end gap-2 sm:max-w-[75%]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
            <User className="h-4 w-4" />
          </div>
          <div className="rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm">
            {formatContent(content)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex max-w-[92%] items-end gap-2 sm:max-w-[85%]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="rounded-2xl rounded-bl-md border border-gray-200/80 bg-white px-4 py-2.5 text-[15px] leading-relaxed text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {formatContent(content)}
        </div>
      </div>
    </div>
  );
}
