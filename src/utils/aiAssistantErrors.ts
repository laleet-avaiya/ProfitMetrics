const INDEX_PATTERNS = [
  /requires an index/i,
  /index is currently building/i,
  /failed-precondition/i,
  /create_composite/i,
];

const PERMISSION_PATTERNS = [
  /permission/i,
  /insufficient permissions/i,
  /permission-denied/i,
];

const NETWORK_PATTERNS = [/network/i, /fetch failed/i, /failed to fetch/i, /offline/i];

const TIMEOUT_PATTERNS = [/timed out/i, /timeout/i, /deadline exceeded/i];

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message ?? '');
  }
  return '';
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function firebaseCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code?: string }).code ?? '');
  }
  return undefined;
}

/** Map Firebase / OpenAI / network errors to short user-friendly copy. */
export function formatAiAssistantError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = firebaseCode(err);
  const message = rawMessage(err);
  const combined = `${code} ${message}`.trim();

  if (code === 'functions/resource-exhausted' || message.toLowerCase().includes('message quota')) {
    return 'You have used all AI assistant messages for this period.';
  }

  if (code === 'functions/unauthenticated') {
    return 'Please sign in again to use the AI assistant.';
  }

  if (matchesAny(combined, INDEX_PATTERNS)) {
    return 'Chat history is still setting up. Please try again in a few minutes.';
  }

  if (
    code === 'permission-denied' ||
    code === 'functions/permission-denied' ||
    matchesAny(combined, PERMISSION_PATTERNS)
  ) {
    return 'Unable to load chat history right now. Please try again later.';
  }

  if (matchesAny(combined, TIMEOUT_PATTERNS)) {
    return 'The request took too long. Please try again with a shorter question.';
  }

  if (matchesAny(combined, NETWORK_PATTERNS)) {
    return 'Connection problem. Check your internet and try again.';
  }

  if (code === 'functions/internal' || code === 'functions/unavailable') {
    return 'AI assistant is temporarily unavailable. Please try again later.';
  }

  if (message.toLowerCase().includes('openai') || message.toLowerCase().includes('api key')) {
    return 'AI assistant is temporarily unavailable. Please try again later.';
  }

  // Never surface long technical Firebase URLs or console links
  if (message.length > 120 || message.includes('firebase.google.com') || message.includes('create_composite')) {
    return fallback;
  }

  if (message && message.length <= 120 && !message.includes('http')) {
    return message;
  }

  return fallback;
}
