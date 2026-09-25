/**
 * Whether to show the donation ask.
 *
 * Deliberately passive: nothing is ever pushed at the user. This only decides
 * whether the Donate block on the options page is visible, and after someone
 * says they donated it stays quiet for 90 days.
 *
 * Kept free of any browser API so it can be unit tested.
 */

export const SNOOZE_DAYS = 90;
export const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

/** Timestamp until which the ask should stay hidden. */
export function nextSnoozeUntil(nowMs) {
  return nowMs + SNOOZE_MS;
}

/**
 * @param {number} nowMs
 * @param {number|string|null|undefined} hideUntil - stored timestamp, if any
 * @returns {boolean} true when the Donate block should be shown
 */
export function shouldShowDonate(nowMs, hideUntil) {
  const until = Number(hideUntil);
  if (!Number.isFinite(until)) {
    return true;
  }
  return nowMs >= until;
}
