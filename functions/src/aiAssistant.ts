import type { AiDataDomain } from './constants';
import { fetchAiBusinessContext } from './aiDataFetcher';
import { createChatCompletion, type OpenAiChatMessage } from './openai';
import {
  analyzeQueryHeuristically,
  type HeuristicClassification,
} from './queryHeuristics';
import type { Firestore } from 'firebase-admin/firestore';

export interface QueryClassification {
  intent: 'analysis' | 'mutation' | 'general';
  domains: AiDataDomain[];
  rejectionReason?: string;
}

const ANALYSIS_SYSTEM_PROMPT = `You are a helpful business analyst for ProfitMetrics, a profit-tracking app for sellers.
You ONLY analyze read-only data provided in the context. You cannot change data.

Guidelines:
- Reply in the SAME language the user used in their latest message.
- Be concise but actionable. Prefer short sections over long essays.
- Use bullet points and numbers where helpful.
- Focus on profit, revenue, costs, trends, and improvement ideas.
- Reference amounts in the company's currency when available.
- If data is insufficient, say what is missing briefly.
- Never invent figures not present in the context.
- Do not expose personal customer details.`;

function toClassification(heuristic: HeuristicClassification): QueryClassification {
  return {
    intent: heuristic.intent,
    domains: heuristic.domains.length > 0 ? heuristic.domains : ['overview'],
  };
}

export async function generateAnalysisResponse(params: {
  userMessage: string;
  company: { name: string; currency: string; country: string; timezone?: string };
  companyId: string;
  db: Firestore;
  domains: AiDataDomain[];
  recentMessages: OpenAiChatMessage[];
}): Promise<string> {
  const context = await fetchAiBusinessContext(
    params.db,
    params.company,
    params.companyId,
    params.domains
  );

  const contextJson = JSON.stringify(context);

  const messages: OpenAiChatMessage[] = [{ role: 'system', content: ANALYSIS_SYSTEM_PROMPT }];

  for (const message of params.recentMessages.slice(-4)) {
    messages.push(message);
  }

  messages.push({
    role: 'user',
    content: `${params.userMessage}\n\n--- Business data (anonymized, read-only) ---\n${contextJson}`,
  });

  return createChatCompletion(messages, { temperature: 0.35, maxTokens: 1200 });
}

export async function generateGeneralResponse(
  userMessage: string,
  recentMessages: OpenAiChatMessage[]
): Promise<string> {
  const messages: OpenAiChatMessage[] = [
    {
      role: 'system',
      content:
        'You are the ProfitMetrics AI assistant. You help users understand sales, profit, expenses, and inventory. You only read data — you cannot change it. Reply in the same language as the user. Keep answers short (under 120 words).',
    },
    ...recentMessages.slice(-2),
    { role: 'user', content: userMessage },
  ];

  return createChatCompletion(messages, { temperature: 0.4, maxTokens: 350 });
}

export async function generateMutationRejection(
  userMessage: string,
  recentMessages: OpenAiChatMessage[]
): Promise<string> {
  const messages: OpenAiChatMessage[] = [
    {
      role: 'system',
      content:
        'Politely refuse because you are a read-only assistant and cannot create, update, or delete data. Reply in the same language as the user. Maximum 2 short sentences.',
    },
    ...recentMessages.slice(-1),
    { role: 'user', content: userMessage },
  ];

  return createChatCompletion(messages, { temperature: 0.2, maxTokens: 180 });
}

/** Fast path: heuristic routing + a single OpenAI call (no separate classify step). */
export async function processUserMessage(params: {
  userMessage: string;
  company: { name: string; currency: string; country: string; timezone?: string };
  companyId: string;
  db: Firestore;
  recentMessages: OpenAiChatMessage[];
}): Promise<{ response: string; classification: QueryClassification }> {
  const heuristic = analyzeQueryHeuristically(params.userMessage);
  const classification = toClassification(heuristic);

  if (heuristic.intent === 'mutation') {
    const response = await generateMutationRejection(params.userMessage, params.recentMessages);
    return { response, classification };
  }

  if (heuristic.intent === 'general') {
    const response = await generateGeneralResponse(params.userMessage, params.recentMessages);
    return { response, classification };
  }

  const response = await generateAnalysisResponse({
    userMessage: params.userMessage,
    company: params.company,
    companyId: params.companyId,
    db: params.db,
    domains: classification.domains,
    recentMessages: params.recentMessages,
  });

  return { response, classification };
}
