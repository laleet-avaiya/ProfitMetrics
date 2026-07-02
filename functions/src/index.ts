import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DEFAULT_AI_MESSAGE_QUOTA, FUNCTIONS_REGION } from './constants';
import { processUserMessage, type QueryClassification } from './aiAssistant';
import type { OpenAiChatMessage } from './openai';
import { buildChatTitleFromMessage } from './queryHeuristics';

initializeApp();

const COLLECTION_AI_CHATS = 'aiChats';
const COLLECTION_COMPANIES = 'companies';
const RECENT_MESSAGE_LIMIT = 8;

function getDocId(companyId: string, id: string): string {
  return `${companyId}_${id}`;
}

function toOpenAiMessages(
  messages: Array<{ role: string; content: string }>
): OpenAiChatMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));
}

interface ProcessAiMessageRequest {
  chatId?: string;
  message: string;
}

interface ProcessAiMessageResponse {
  chatId: string;
  title: string;
  response: string;
  aiMessagesUsed: number;
  aiMessageQuota: number;
  classification: QueryClassification;
}

export const processAiMessage = onCall(
  {
    region: FUNCTIONS_REGION,
    timeoutSeconds: 60,
    memory: '1GiB',
    minInstances: 0,
  },
  async (request): Promise<ProcessAiMessageResponse> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to use the AI assistant.');
    }

    const companyId = request.auth.uid;
    const data = request.data as ProcessAiMessageRequest;
    const userMessage = typeof data.message === 'string' ? data.message.trim() : '';

    if (!userMessage) {
      throw new HttpsError('invalid-argument', 'Message is required.');
    }

    if (userMessage.length > 4000) {
      throw new HttpsError('invalid-argument', 'Message is too long (max 4000 characters).');
    }

    const db = getFirestore();
    const companyRef = db.collection(COLLECTION_COMPANIES).doc(companyId);
    const companySnap = await companyRef.get();

    if (!companySnap.exists) {
      throw new HttpsError('not-found', 'Company not found.');
    }

    const companyData = companySnap.data() ?? {};
    const aiMessageQuota =
      typeof companyData.aiMessageQuota === 'number'
        ? companyData.aiMessageQuota
        : DEFAULT_AI_MESSAGE_QUOTA;
    const aiMessagesUsed =
      typeof companyData.aiMessagesUsed === 'number' ? companyData.aiMessagesUsed : 0;

    if (aiMessagesUsed >= aiMessageQuota) {
      throw new HttpsError(
        'resource-exhausted',
        'You have used all AI assistant messages for this period.'
      );
    }

    let chatId = typeof data.chatId === 'string' && data.chatId.trim() ? data.chatId.trim() : '';
    let chatRef;
    let isNewChat = false;

    if (chatId) {
      chatRef = db.collection(COLLECTION_AI_CHATS).doc(getDocId(companyId, chatId));
      const chatSnap = await chatRef.get();
      if (!chatSnap.exists || chatSnap.data()?.companyId !== companyId) {
        throw new HttpsError('not-found', 'Chat not found.');
      }
    } else {
      isNewChat = true;
      chatId = crypto.randomUUID();
      chatRef = db.collection(COLLECTION_AI_CHATS).doc(getDocId(companyId, chatId));
      const now = Timestamp.now();
      await chatRef.set({
        id: chatId,
        companyId,
        title: buildChatTitleFromMessage(userMessage),
        createdAt: now,
        updatedAt: now,
      });
    }

    const messagesRef = chatRef.collection('messages');
    const existingMessagesSnap = await messagesRef
      .orderBy('createdAt', 'desc')
      .limit(RECENT_MESSAGE_LIMIT)
      .get();

    const recentMessages = toOpenAiMessages(
      existingMessagesSnap.docs
        .reverse()
        .map((docSnap) => docSnap.data() as { role: string; content: string })
    );

    const company = {
      name: String(companyData.name ?? 'Company'),
      currency: String(companyData.currency ?? 'USD'),
      country: String(companyData.country ?? ''),
      timezone: companyData.timezone ? String(companyData.timezone) : undefined,
    };

    const userMessageId = crypto.randomUUID();
    const userMessageNow = Timestamp.now();

    let response: string;
    let classification: QueryClassification;

    try {
      const [, result] = await Promise.all([
        messagesRef.doc(userMessageId).set({
          id: userMessageId,
          role: 'user',
          content: userMessage,
          createdAt: userMessageNow,
        }),
        processUserMessage({
          userMessage,
          company,
          companyId,
          db,
          recentMessages,
        }),
      ]);
      response = result.response;
      classification = result.classification;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI processing failed.';
      throw new HttpsError('internal', message);
    }

    const assistantMessageId = crypto.randomUUID();
    const assistantNow = Timestamp.now();
    const title = isNewChat
      ? buildChatTitleFromMessage(userMessage)
      : String((await chatRef.get()).data()?.title ?? buildChatTitleFromMessage(userMessage));

    const batch = db.batch();
    batch.set(messagesRef.doc(assistantMessageId), {
      id: assistantMessageId,
      role: 'assistant',
      content: response,
      createdAt: assistantNow,
    });
    batch.update(chatRef, {
      title,
      updatedAt: Timestamp.now(),
    });
    batch.update(companyRef, {
      aiMessagesUsed: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });
    await batch.commit();

    return {
      chatId,
      title,
      response,
      aiMessagesUsed: aiMessagesUsed + 1,
      aiMessageQuota,
      classification,
    };
  }
);
