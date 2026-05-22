import { useEffect, useState } from "react";

/**
 * Optional throttle for markdown re-parses while tokens arrive.
 * `delayMs <= 0` passes through every update (no batching).
 */
export function useThrottledStreamContent(
  content: string,
  isStreaming: boolean,
  delayMs = 100
): string {
  const [throttled, setThrottled] = useState(content);

  useEffect(() => {
    if (!isStreaming || delayMs <= 0) {
      setThrottled(content);
      return;
    }
    const timer = window.setTimeout(() => setThrottled(content), delayMs);
    return () => window.clearTimeout(timer);
  }, [content, isStreaming, delayMs]);

  if (!isStreaming || delayMs <= 0) return content;
  return throttled;
}
