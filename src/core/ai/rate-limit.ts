const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

interface Entry {
  count: number;
  resetAt: number;
}

const globalRateLimit = globalThis as typeof globalThis & {
  __vibeCutRateLimit?: Map<string, Entry>;
};

const entries =
  globalRateLimit.__vibeCutRateLimit ??
  (globalRateLimit.__vibeCutRateLimit = new Map<string, Entry>());

export function consumeRateLimit(key: string, now = Date.now()): boolean {
  const current = entries.get(key);
  if (!current || now >= current.resetAt) {
    entries.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) {
    return false;
  }
  current.count += 1;
  return true;
}
