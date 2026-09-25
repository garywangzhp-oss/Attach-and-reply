import test from "node:test";
import assert from "node:assert/strict";

import {
  SNOOZE_DAYS,
  SNOOZE_MS,
  nextSnoozeUntil,
  shouldShowDonate,
} from "../lib/donate.js";

test("shows the donation ask when nothing was stored", () => {
  assert.equal(shouldShowDonate(1_000_000, null), true);
  assert.equal(shouldShowDonate(1_000_000, undefined), true);
  assert.equal(shouldShowDonate(1_000_000, ""), true);
  assert.equal(shouldShowDonate(1_000_000, "not a number"), true);
});

test("hides the donation ask for the snooze period", () => {
  const now = 1_700_000_000_000;
  const until = nextSnoozeUntil(now);

  assert.equal(until, now + SNOOZE_MS);
  assert.equal(SNOOZE_DAYS, 90);
  assert.equal(shouldShowDonate(now, until), false);
  assert.equal(shouldShowDonate(until - 1, until), false);
  assert.equal(shouldShowDonate(until, until), true);
  assert.equal(shouldShowDonate(until + 1, until), true);
});

test("accepts the timestamp as a string, the way localStorage returns it", () => {
  const now = 1_700_000_000_000;
  const until = String(nextSnoozeUntil(now));
  assert.equal(shouldShowDonate(now, until), false);
  assert.equal(shouldShowDonate(now + SNOOZE_MS, until), true);
});
