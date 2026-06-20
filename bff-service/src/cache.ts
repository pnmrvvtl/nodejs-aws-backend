export type CachedResponse = {
  status: number;
  headers: Array<[string, string]>;
  body: Buffer;
  expiresAt: number;
};

const cache = new Map<string, CachedResponse>();
const ttl = 120000;

export function getCachedResponse(key: string): CachedResponse | null {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached;
}

export function setCachedResponse(
  key: string,
  response: Omit<CachedResponse, "expiresAt">,
): void {
  cache.set(key, {
    ...response,
    expiresAt: Date.now() + ttl,
  });
}

export function clearCache(): void {
  cache.clear();
}
