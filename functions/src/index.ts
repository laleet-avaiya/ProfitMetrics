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
const COLLECTION_ORGS = 'orgs';
const COLLECTION_MEMBERS = 'companyMembers';
const COLLECTION_USERS = 'users';
const RECENT_MESSAGE_LIMIT = 8;

function getMemberDocId(companyId: string, userId: string): string {
  return `${companyId}_${userId}`;
}

async function resolveCompanyId(
  db: FirebaseFirestore.Firestore,
  userId: string,
  requestedCompanyId?: string
): Promise<string> {
  if (requestedCompanyId) {
    const memberSnap = await db
      .collection(COLLECTION_MEMBERS)
      .doc(getMemberDocId(requestedCompanyId, userId))
      .get();
    if (!memberSnap.exists || memberSnap.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'You do not have access to this company.');
    }
    return requestedCompanyId;
  }

  const userSnap = await db.collection(COLLECTION_USERS).doc(userId).get();
  const activeCompanyId = userSnap.data()?.activeCompanyId;
  if (typeof activeCompanyId === 'string' && activeCompanyId) {
    const memberSnap = await db
      .collection(COLLECTION_MEMBERS)
      .doc(getMemberDocId(activeCompanyId, userId))
      .get();
    if (memberSnap.exists && memberSnap.data()?.status === 'active') {
      return activeCompanyId;
    }
  }

  const memberships = await db
    .collection(COLLECTION_MEMBERS)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (memberships.empty) {
    throw new HttpsError('failed-precondition', 'No active company membership found.');
  }

  return String(memberships.docs[0].data().companyId);
}

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
  companyId?: string;
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

    const userId = request.auth.uid;
    const data = request.data as ProcessAiMessageRequest;
    const userMessage = typeof data.message === 'string' ? data.message.trim() : '';

    if (!userMessage) {
      throw new HttpsError('invalid-argument', 'Message is required.');
    }

    if (userMessage.length > 4000) {
      throw new HttpsError('invalid-argument', 'Message is too long (max 4000 characters).');
    }

    const db = getFirestore();
    const companyId = await resolveCompanyId(
      db,
      userId,
      typeof data.companyId === 'string' ? data.companyId : undefined
    );
    const companyRef = db.collection(COLLECTION_COMPANIES).doc(companyId);
    const companySnap = await companyRef.get();

    if (!companySnap.exists) {
      throw new HttpsError('not-found', 'Company not found.');
    }

    const companyData = companySnap.data() ?? {};
    const orgId = String(companyData.orgId ?? '');
    if (!orgId) {
      throw new HttpsError('failed-precondition', 'Company is not linked to an organization.');
    }

    const orgRef = db.collection(COLLECTION_ORGS).doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw new HttpsError('not-found', 'Organization not found.');
    }

    const orgData = orgSnap.data() ?? {};
    const aiMessageQuota =
      typeof orgData.aiMessageQuota === 'number'
        ? orgData.aiMessageQuota
        : DEFAULT_AI_MESSAGE_QUOTA;
    const aiMessagesUsed =
      typeof orgData.aiMessagesUsed === 'number' ? orgData.aiMessagesUsed : 0;

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
      if (!chatSnap.exists || chatSnap.data()?.companyId !== companyId || chatSnap.data()?.deleted === true) {
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
    batch.update(orgRef, {
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
