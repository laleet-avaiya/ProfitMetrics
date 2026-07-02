export type AiChatMessageRole = 'user' | 'assistant';

export interface AiChatMessage {
  id: string;
  role: AiChatMessageRole;
  content: string;
  createdAt: Date;
}

export interface AiChat {
  id: string;
  companyId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}
