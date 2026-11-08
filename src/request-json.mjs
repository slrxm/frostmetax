/** Deduplicate in-flight requests and cache successful responses only. */
export function createJSONClient({
  baseUrl,
  ttl = 600000,
  timeout = 15000,
  fetchImpl = fetch,
  now = Date.now,
}) {
  const cache = new Map(),
    pending = new Map();
  return async function get(path) {
    const hit = cache.get(path);
    if (hit && now() - hit.at < ttl) return hit.value;
    if (pending.has(path)) return pending.get(path);
    const task = (async () => {
      const response = await fetchImpl(new URL(path, baseUrl), {
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok)
        throw Error(
          response.status === 429
            ? "OpenDota ограничил запросы. Попробуй через минуту."
            : "OpenDota временно недоступен.",
        );
      const value = await response.json();
      cache.set(path, { value, at: now() });
      return value;
    })();
    pending.set(path, task);
    try {
      return await task;
    } finally {
      pending.delete(path);
    }
  };
}
