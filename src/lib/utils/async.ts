const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicates concurrent requests with the same key.
 * If a request with the same key is already in flight, returns the existing promise.
 * Otherwise, executes the function and caches the promise until completion.
 */
export function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last time it was invoked.
 * The function is invoked with the last arguments provided.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {},
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let isLeadingInvoked = false;

  const { leading = false, trailing = true } = options;

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (leading && !isLeadingInvoked) {
      invoke();
      isLeadingInvoked = true;
    }

    timeoutId = setTimeout(() => {
      if (trailing) {
        invoke();
      }
      isLeadingInvoked = false;
      timeoutId = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    isLeadingInvoked = false;
  };

  return debounced;
}

/**
 * Creates a memoized function that caches the result of the function call.
 * The cache key is determined by the provided key function.
 */
export function memoize<T, K>(
  fn: (arg: K) => Promise<T>,
  keyFn: (arg: K) => string = (arg) => String(arg),
  ttlMs: number = 60000,
): (arg: K) => Promise<T> {
  const cache = new Map<string, { value: T; timestamp: number }>();

  return async (arg: K) => {
    const key = keyFn(arg);
    const cached = cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < ttlMs) {
      return cached.value;
    }

    const value = await fn(arg);
    cache.set(key, { value, timestamp: now });

    // Clean up expired entries periodically
    if (cache.size > 100) {
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp > ttlMs) {
          cache.delete(k);
        }
      }
    }

    return value;
  };
}
