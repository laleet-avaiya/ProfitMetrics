import { MessageSquarePlus, Trash2, Sparkles, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { AiChat } from '../../types';

interface ChatSidebarProps {
  chats: AiChat[];
  activeChatId: string | null;
  loading?: boolean;
  quotaUsed: number;
  quotaTotal: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  loading = false,
  quotaUsed,
  quotaTotal,
  collapsed = false,
  onToggleCollapse,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const remaining = Math.max(0, quotaTotal - quotaUsed);
  const quotaPercent = quotaTotal > 0 ? Math.min(100, (quotaUsed / quotaTotal) * 100) : 0;

  if (collapsed) {
    return (
      <aside className="flex h-full w-14 flex-col items-center border-l border-gray-200/80 bg-gray-50/95 py-3 dark:border-gray-800 dark:bg-gray-950/95">
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mb-3 rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Expand chat history"
            title="Expand history"
          >
            <PanelRightOpen className="h-5 w-5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNewChat}
          className="mb-2 rounded-xl bg-indigo-600 p-2.5 text-white shadow-sm hover:bg-indigo-700"
          aria-label="New chat"
          title="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <div className="min-h-0 flex-1 w-full overflow-y-auto px-1.5">
          {chats.slice(0, 12).map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelectChat(chat.id)}
                title={chat.title}
                className={`mb-1 flex h-9 w-full items-center justify-center rounded-lg text-[10px] font-bold ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {chat.title.charAt(0).toUpperCase()}
              </button>
            );
          })}
        </div>
        <div
          className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[10px] font-semibold tabular-nums text-indigo-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-indigo-400 dark:ring-gray-700"
          title={`${remaining} messages remaining`}
        >
          {remaining}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-gray-50/95 dark:bg-gray-950/95 md:w-64 lg:w-72">
      <div className="flex items-center gap-2 border-b border-gray-200/80 p-3 dark:border-gray-800">
        <button
          type="button"
          onClick={onNewChat}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/25 transition-colors hover:bg-indigo-700 active:scale-[0.98]"
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          New chat
        </button>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Collapse chat history"
            title="Collapse history"
          >
            <PanelRightClose className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Loading chats…
          </p>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No chats yet</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Start a conversation below
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <li key={chat.id}>
                  <div
                    className={`group flex items-center gap-0.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white shadow-sm ring-1 ring-indigo-200 dark:bg-gray-800 dark:ring-indigo-800'
                        : 'hover:bg-white/70 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectChat(chat.id)}
                      className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm ${
                        isActive
                          ? 'font-medium text-indigo-700 dark:text-indigo-300'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                      title={chat.title}
                    >
                      {chat.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteChat(chat.id)}
                      aria-label="Delete chat"
                      className="mr-1 rounded-lg p-1.5 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200/80 p-3 dark:border-gray-800">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Messages</span>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {remaining} left
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                quotaPercent >= 100
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-indigo-500 to-violet-500'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            {quotaUsed} of {quotaTotal} used this period
          </p>
        </div>
      </div>
    </aside>
  );
}
