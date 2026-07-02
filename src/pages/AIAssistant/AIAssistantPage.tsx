import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { ChatSidebar } from '../../components/AIAssistant/ChatSidebar';
import { ChatMessage } from '../../components/AIAssistant/ChatMessage';
import { ChatComposer } from '../../components/AIAssistant/ChatComposer';
import { ChatTypingIndicator } from '../../components/AIAssistant/ChatTypingIndicator';
import { useAiAssistant } from '../../hooks/useAiAssistant';
import {
  Bot,
  History,
  MessageSquarePlus,
  Sparkles,
  TrendingUp,
  Package,
  Receipt,
  BarChart3,
  X,
} from 'lucide-react';

const SUGGESTIONS = [
  { text: 'How are my sales this month?', icon: TrendingUp },
  { text: 'Best profit margin products?', icon: Package },
  { text: 'Where can I cut costs?', icon: Receipt },
  { text: 'Business overview', icon: BarChart3 },
];

const HISTORY_COLLAPSED_KEY = 'ai-chat-history-collapsed';

function getInitialHistoryCollapsed(): boolean {
  return localStorage.getItem(HISTORY_COLLAPSED_KEY) === 'true';
}

export function AIAssistantPage() {
  const {
    chats,
    activeChatId,
    messages,
    loadingChats,
    loadingMessages,
    sending,
    sendingPhase,
    error,
    quotaInfo,
    startNewChat,
    selectChat,
    deleteChat,
    sendMessage,
    setError,
  } = useAiAssistant();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(getInitialHistoryCollapsed);
  const quotaExceeded = quotaInfo.remaining <= 0;
  const showEmptyState = !loadingMessages && messages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    localStorage.setItem(HISTORY_COLLAPSED_KEY, String(historyCollapsed));
  }, [historyCollapsed]);

  const toggleHistoryCollapsed = () => setHistoryCollapsed((prev) => !prev);

  return (
    <Layout fullBleed>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Main chat panel */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200/80 bg-white/80 px-3 py-2.5 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80 sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
                  <Bot className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    AI Assistant
                  </h1>
                  <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                    Ask about sales, profit &amp; expenses
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 sm:inline md:hidden">
                  {quotaInfo.remaining} left
                </span>
                <button
                  type="button"
                  onClick={startNewChat}
                  className="rounded-xl p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 md:hidden"
                  aria-label="New chat"
                >
                  <MessageSquarePlus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="rounded-xl p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 md:hidden"
                  aria-label="Chat history"
                >
                  <History className="h-5 w-5" />
                </button>
              </div>
            </header>

            {error ? (
              <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/40 sm:px-4">
                <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="shrink-0 text-xs font-medium text-red-600 underline dark:text-red-400"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loadingMessages ? (
                <LoadingView message="Loading conversation…" className="h-full min-h-[200px]" />
              ) : showEmptyState ? (
                <div className="flex min-h-full flex-col px-3 pb-2 pt-4 sm:px-4 sm:pt-8">
                  <div className="mx-auto w-full max-w-2xl flex-1">
                    <div className="mb-5 text-center sm:mb-8">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-600/10 ring-1 ring-indigo-200/50 dark:ring-indigo-800/50 sm:h-14 sm:w-14">
                        <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400 sm:h-7 sm:w-7" />
                      </div>
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                        How can I help?
                      </h2>
                      <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                        Read-only insights on your business. I can&apos;t change any data.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {SUGGESTIONS.map(({ text, icon: Icon }) => (
                        <button
                          key={text}
                          type="button"
                          disabled={quotaExceeded || sending}
                          onClick={() => void sendMessage(text)}
                          className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-3.5 py-3 text-left text-sm text-gray-700 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-indigo-600"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="leading-snug">{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl py-2 sm:py-4">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} role={message.role} content={message.content} />
                  ))}
                  {sending ? (
                    <ChatTypingIndicator
                      phase={sendingPhase === 'analyzing' ? 'analyzing' : 'thinking'}
                    />
                  ) : null}
                  <div ref={messagesEndRef} className="h-2" />
                </div>
              )}
            </div>

            <ChatComposer
              onSend={(message) => void sendMessage(message)}
              disabled={quotaExceeded}
              sending={sending}
              placeholder={
                quotaExceeded
                  ? 'Message quota reached'
                  : 'Ask about sales, profit, expenses…'
              }
            />
          </div>

          {/* Desktop chat history — right side */}
          <div className="hidden min-h-0 shrink-0 transition-[width] duration-300 ease-in-out md:flex">
            <ChatSidebar
              chats={chats}
              activeChatId={activeChatId}
              loading={loadingChats}
              quotaUsed={quotaInfo.used}
              quotaTotal={quotaInfo.quota}
              collapsed={historyCollapsed}
              onToggleCollapse={toggleHistoryCollapsed}
              onNewChat={startNewChat}
              onSelectChat={selectChat}
              onDeleteChat={deleteChat}
            />
          </div>

          {/* Mobile chat history drawer — slides from right */}
          {mobileSidebarOpen ? (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                aria-label="Close chat history"
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <div className="absolute inset-y-0 right-0 flex w-[min(18rem,88vw)] flex-col border-l border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3 dark:border-gray-800">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Chat history
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <ChatSidebar
                    chats={chats}
                    activeChatId={activeChatId}
                    loading={loadingChats}
                    quotaUsed={quotaInfo.used}
                    quotaTotal={quotaInfo.quota}
                    onNewChat={() => {
                      startNewChat();
                      setMobileSidebarOpen(false);
                    }}
                    onSelectChat={(chatId) => {
                      selectChat(chatId);
                      setMobileSidebarOpen(false);
                    }}
                    onDeleteChat={deleteChat}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
