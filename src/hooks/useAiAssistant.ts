import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { aiChatService } from '../services/aiChat';
import { sendAiMessage } from '../services/aiAssistantClient';
import { DEFAULT_AI_MESSAGE_QUOTA } from '../constants/aiAssistant';
import { formatAiAssistantError } from '../utils/aiAssistantErrors';
import type { AiChat, AiChatMessage } from '../types';

function getQuotaInfo(org: { aiMessageQuota?: number; aiMessagesUsed?: number } | null) {
  const quota = org?.aiMessageQuota ?? DEFAULT_AI_MESSAGE_QUOTA;
  const used = org?.aiMessagesUsed ?? 0;
  return { quota, used, remaining: Math.max(0, quota - used) };
}

export type AiSendingPhase = 'idle' | 'thinking' | 'analyzing';

export function useAiAssistant() {
  const { company, org, refreshSession } = useAuth();
  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingPhase, setSendingPhase] = useState<AiSendingPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const companyId = company?.id;
  const quotaInfo = getQuotaInfo(org);

  const loadChats = useCallback(async () => {
    if (!companyId) return;
    setLoadingChats(true);
    try {
      const list = await aiChatService.listChats(companyId);
      setChats(list);
    } catch (err) {
      setError(formatAiAssistantError(err, 'Unable to load chats. Please try again.'));
    } finally {
      setLoadingChats(false);
    }
  }, [companyId]);

  const loadMessages = useCallback(
    async (chatId: string) => {
      if (!companyId) return;
      setLoadingMessages(true);
      setError(null);
      try {
        const list = await aiChatService.listMessages(companyId, chatId);
        setMessages(list);
      } catch (err) {
        setError(formatAiAssistantError(err, 'Unable to load this conversation. Please try again.'));
      } finally {
        setLoadingMessages(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (activeChatId) {
      void loadMessages(activeChatId);
    } else {
      setMessages([]);
    }
  }, [activeChatId, loadMessages]);

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setError(null);
  }, []);

  const selectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    setError(null);
  }, []);

  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!companyId) return;
      setError(null);
      try {
        await aiChatService.deleteChat(companyId, chatId);
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
      } catch (err) {
        setError(formatAiAssistantError(err, 'Unable to delete this chat. Please try again.'));
      }
    },
    [companyId, activeChatId]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!companyId || !text.trim() || sending) return;

      if (quotaInfo.remaining <= 0) {
        setError('You have used all AI assistant messages for this period.');
        return;
      }

      const trimmed = text.trim();
      setSending(true);
      setSendingPhase('thinking');
      setError(null);

      const optimisticUserMessage: AiChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, optimisticUserMessage]);

      const analyzeTimer = window.setTimeout(() => {
        setSendingPhase('analyzing');
      }, 1200);

      try {
        const result = await sendAiMessage({
          chatId: activeChatId ?? undefined,
          message: trimmed,
          companyId,
        });

        const now = new Date();
        setActiveChatId(result.chatId);
        setMessages((prev) => [
          ...prev.filter((message) => message.id !== optimisticUserMessage.id),
          {
            id: `user-${now.getTime()}`,
            role: 'user',
            content: trimmed,
            createdAt: now,
          },
          {
            id: `assistant-${now.getTime()}`,
            role: 'assistant',
            content: result.response,
            createdAt: now,
          },
        ]);

        setChats((prev) => {
          const existing = prev.find((chat) => chat.id === result.chatId);
          const updatedChat: AiChat = existing
            ? { ...existing, title: result.title, updatedAt: now }
            : {
                id: result.chatId,
                companyId,
                title: result.title,
                createdAt: now,
                updatedAt: now,
              };
          const rest = prev.filter((chat) => chat.id !== result.chatId);
          return [updatedChat, ...rest];
        });

        void refreshSession();
        void loadChats();
      } catch (err) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticUserMessage.id));
        setError(formatAiAssistantError(err, 'Unable to send your message. Please try again.'));
      } finally {
        window.clearTimeout(analyzeTimer);
        setSending(false);
        setSendingPhase('idle');
      }
    },
    [
      companyId,
      sending,
      quotaInfo.remaining,
      activeChatId,
      refreshSession,
      loadChats,
    ]
  );

  return {
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
  };
}
