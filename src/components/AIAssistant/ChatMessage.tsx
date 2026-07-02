import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

type InlineVariant = 'default' | 'user';

const LIST_LINE = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/;
const METRIC_LINE = /^\s*(?:[-*•]\s+)?\*\*([^*]+)\*\*:\s*(.+)$/;

function renderInline(text: string, variant: InlineVariant = 'default'): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const label = part.slice(2, -2);
      return (
        <strong
          key={index}
          className={
            variant === 'user'
              ? 'font-semibold text-white'
              : 'font-semibold text-gray-900 dark:text-white'
          }
        >
          {label}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className={variant === 'user' ? 'text-white/95' : undefined}>
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className={
            variant === 'user'
              ? 'rounded bg-white/15 px-1 py-0.5 text-[0.9em]'
              : 'rounded bg-gray-100 px-1 py-0.5 text-[0.9em] dark:bg-gray-900'
          }
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function parseMetricLine(line: string): { label: string; value: string } | null {
  const match = line.trim().match(METRIC_LINE);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

function isListLine(line: string): boolean {
  return LIST_LINE.test(line.trim());
}

function isMetricLine(line: string): boolean {
  return METRIC_LINE.test(line.trim());
}

function MetricGrid({ metrics }: { metrics: { label: string; value: string }[] }) {
  return (
    <dl className="my-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-700/80 dark:bg-gray-900/40"
        >
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{metric.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {renderInline(metric.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatContent(content: string, variant: InlineVariant = 'default'): ReactNode[] {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let blockIndex = 0;

  const pushParagraph = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={blockIndex++} className="mb-1 mt-3 text-sm font-semibold">
          {renderInline(trimmed.replace(/^###\s*/, ''), variant)}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={blockIndex++} className="mb-1 mt-3 text-base font-semibold">
          {renderInline(trimmed.replace(/^##\s*/, ''), variant)}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h2 key={blockIndex++} className="mb-1 mt-3 text-lg font-semibold">
          {renderInline(trimmed.replace(/^#\s*/, ''), variant)}
        </h2>
      );
      return;
    }

    blocks.push(
      <p key={blockIndex++} className="my-1.5 leading-relaxed">
        {renderInline(trimmed, variant)}
      </p>
    );
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (isMetricLine(line)) {
      const metrics: { label: string; value: string }[] = [];
      while (index < lines.length && lines[index].trim() && isMetricLine(lines[index])) {
        const metric = parseMetricLine(lines[index]);
        if (metric) metrics.push(metric);
        index += 1;
      }
      if (metrics.length > 0) {
        blocks.push(<MetricGrid key={blockIndex++} metrics={metrics} />);
      }
      continue;
    }

    if (isListLine(line)) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim() && isListLine(lines[index])) {
        const match = lines[index].trim().match(LIST_LINE);
        if (match) items.push(match[1]);
        index += 1;
      }
      blocks.push(
        <ul key={blockIndex++} className="my-2 list-disc space-y-1.5 pl-5">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="leading-relaxed">
              {renderInline(item, variant)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isListLine(lines[index]) &&
      !isMetricLine(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    pushParagraph(paragraphLines.join('\n'));
  }

  return blocks;
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
            {formatContent(content, 'user')}
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
        <div className="min-w-0 rounded-2xl rounded-bl-md border border-gray-200/80 bg-white px-4 py-2.5 text-[15px] leading-relaxed text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {formatContent(content)}
        </div>
      </div>
    </div>
  );
}
