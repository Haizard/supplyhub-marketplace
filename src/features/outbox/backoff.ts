export const MAX_OUTBOX_ATTEMPTS = 5;

/** Exponential backoff with a one-hour cap, based on the completed attempt count. */
export function nextAttemptDelayMs(attempts: number): number {
  const safeAttempts = Math.max(1, Math.floor(attempts));
  const exponent = Math.min(safeAttempts - 1, 12);
  return Math.min(60 * 60 * 1000, 1_000 * 2 ** exponent);
}
