import { defineString } from 'firebase-functions/params';
import { OPENAI_MODEL } from './constants';

/** Set via functions/.env or functions/.env.<projectId> (not Secret Manager). */
export const openAiApiKey = defineString('OPENAI_API_KEY');

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
}

const OPENAI_TIMEOUT_MS = 45_000;

export async function createChatCompletion(
  messages: OpenAiChatMessage[],
  options?: {
    json?: boolean;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const apiKey = openAiApiKey.value();
  if (!apiKey?.trim()) {
    throw new Error('OpenAI API key is not configured on the server.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1200,
        ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as ChatCompletionResponse;

    if (!response.ok) {
      const message = data.error?.message ?? `OpenAI request failed (${response.status})`;
      throw new Error(message);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response.');
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI response timed out. Please try a shorter question.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
