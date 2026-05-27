export type RafThrottled<T extends (...args: never[]) => void> = T & {
  cancel: () => void;
};

/** Coalesce rapid calls to at most once per animation frame (trailing). */
export function rafThrottle<T extends (...args: never[]) => void>(
  fn: T
): RafThrottled<T> {
  let rafId: number | null = null;

  const throttled = ((...args: Parameters<T>) => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      fn(...args);
    });
  }) as RafThrottled<T>;

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
}

/** Trailing throttle by wall-clock interval (drops intermediate calls). */
export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | null = null;

  const run = () => {
    timer = undefined;
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer !== undefined) return;
    timer = setTimeout(run, waitMs);
  }) as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    lastArgs = null;
  };

  return throttled;
}
