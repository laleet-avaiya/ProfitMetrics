import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AiChat, AiChatMessage } from '../types';
import { isNotDeleted } from '../models/softDelete';
import { convertTimestamps, nowUtc, prepareDatesForFirestore } from '../utils/firestoreDates';
import { appendAuditLog } from './auditLog';

const COLLECTION_AI_CHATS = 'aiChats';

function getDocId(companyId: string, id: string): string {
  return `${companyId}_${id}`;
}

function mapChat(id: string, data: Record<string, unknown>): AiChat {
  const converted = convertTimestamps<Record<string, unknown>>(data);
  return {
    id,
    companyId: String(converted.companyId ?? ''),
    title: String(converted.title ?? 'New chat'),
    deleted: converted.deleted === true,
    deletedAt: converted.deletedAt instanceof Date ? converted.deletedAt : undefined,
    deletedBy: converted.deletedBy ? String(converted.deletedBy) : undefined,
    createdAt: converted.createdAt instanceof Date ? converted.createdAt : nowUtc(),
    updatedAt: converted.updatedAt instanceof Date ? converted.updatedAt : nowUtc(),
  };
}

function mapMessage(id: string, data: Record<string, unknown>): AiChatMessage {
  const converted = convertTimestamps<Record<string, unknown>>(data);
  return {
    id,
    role: converted.role === 'assistant' ? 'assistant' : 'user',
    content: String(converted.content ?? ''),
    createdAt: converted.createdAt instanceof Date ? converted.createdAt : nowUtc(),
  };
}

export const aiChatService = {
  async listChats(companyId: string): Promise<AiChat[]> {
    const q = query(
      collection(db, COLLECTION_AI_CHATS),
      where('companyId', '==', companyId),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((chatDoc) => {
        const data = chatDoc.data();
        const id = String(data.id ?? chatDoc.id.replace(`${companyId}_`, ''));
        return mapChat(id, data as Record<string, unknown>);
      })
      .filter(isNotDeleted);
  },

  async createChat(companyId: string, title = 'New chat'): Promise<AiChat> {
    const id = crypto.randomUUID();
    const now = nowUtc();
    const chat: AiChat = {
      id,
      companyId,
      title,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(
      doc(db, COLLECTION_AI_CHATS, getDocId(companyId, id)),
      prepareDatesForFirestore({ ...chat, companyId })
    );

    return chat;
  },

  async deleteChat(companyId: string, chatId: string, deletedBy: string): Promise<void> {
    const now = nowUtc();
    await updateDoc(
      doc(db, COLLECTION_AI_CHATS, getDocId(companyId, chatId)),
      prepareDatesForFirestore({
        deleted: true,
        deletedAt: now,
        deletedBy,
        updatedAt: now,
      })
    );
    appendAuditLog(companyId, deletedBy, {
      action: 'ai_chat.deleted',
      entityType: 'ai_chat',
      entityId: chatId,
      summary: 'AI chat deleted',
    });
  },

  async listMessages(companyId: string, chatId: string): Promise<AiChatMessage[]> {
    const chat = await this.getChat(companyId, chatId);
    if (!chat) return [];

    const messagesRef = collection(
      doc(db, COLLECTION_AI_CHATS, getDocId(companyId, chatId)),
      'messages'
    );
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((messageDoc) =>
      mapMessage(messageDoc.id, messageDoc.data() as Record<string, unknown>)
    );
  },

  async getChat(companyId: string, chatId: string): Promise<AiChat | null> {
    const chatDoc = await getDoc(doc(db, COLLECTION_AI_CHATS, getDocId(companyId, chatId)));
    if (!chatDoc.exists()) return null;
    const data = chatDoc.data();
    const id = String(data.id ?? chatId);
    const chat = mapChat(id, data as Record<string, unknown>);
    return isNotDeleted(chat) ? chat : null;
  },
};
