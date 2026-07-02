import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface ProcessAiMessageRequest {
  chatId?: string;
  message: string;
  companyId?: string;
}

export interface ProcessAiMessageResponse {
  chatId: string;
  title: string;
  response: string;
  aiMessagesUsed: number;
  aiMessageQuota: number;
}

export async function sendAiMessage(
  request: ProcessAiMessageRequest
): Promise<ProcessAiMessageResponse> {
  const callable = httpsCallable<ProcessAiMessageRequest, ProcessAiMessageResponse>(
    functions,
    'processAiMessage'
  );
  const result = await callable(request);
  return result.data;
}
