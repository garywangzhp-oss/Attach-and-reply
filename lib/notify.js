/**
 * Telling the user about attachments that were deliberately left out.
 *
 * There is no post-reply dialog in this add-on - the whole design goal is to stay
 * out of the way. But one case needs a visible answer: the original mail *has*
 * attachments and *all* of them were skipped (inline images, cloud links, deleted
 * placeholders, ...). Without a hint the user would just see an empty attachment
 * pane and think the add-on is broken.
 *
 * This uses the badge of our own toolbar button plus the Error Console, so it
 * costs no extra permission. See README.md ("Notice" section) for the tradeoff.
 */

const BADGE_COLOR = "#C45500";

const REASON_MESSAGE_KEY = {
  inline: "reasonInline",
  linked: "reasonLinked",
  cloud: "reasonCloud",
  deleted: "reasonDeleted",
  detached: "reasonDetached",
  unreadable: "reasonUnreadable",
  unknown: "reasonUnknown",
};

function message(browser, key, substitutions) {
  const text = browser.i18n.getMessage(key, substitutions);
  return text || key;
}

export function describeReason(browser, reason) {
  return message(browser, REASON_MESSAGE_KEY[reason] || "reasonUnknown");
}

/**
 * Build the one-line summary shown in the button tooltip / logged to the console.
 */
export function summarizeSkipped(browser, skipped) {
  const parts = skipped.map(
    (entry) => `${entry.name || "?"} (${describeReason(browser, entry.reason)})`
  );
  return parts.join(", ");
}

function actionApi(browser) {
  return browser.messageDisplayAction;
}

export async function showSkippedNotice({ skipped, browser, log, tabId }) {
  const summary = summarizeSkipped(browser, skipped);
  log?.warn?.(`${skipped.length} attachment(s) not added: ${summary}`);

  const action = actionApi(browser);
  if (!action) {
    return;
  }

  const details = (extra) => (typeof tabId === "number" ? { ...extra, tabId } : extra);

  try {
    await action.setBadgeText(details({ text: String(skipped.length) }));
    await action.setBadgeBackgroundColor(details({ color: BADGE_COLOR }));
    await action.setTitle(
      details({
        title: message(browser, "noticeSkippedTitle", [String(skipped.length), summary]),
      })
    );
  } catch (error) {
    log?.warn?.("could not update the toolbar button", error);
  }
}

export async function clearNotice({ browser, log, tabId }) {
  const action = actionApi(browser);
  if (!action) {
    return;
  }

  const details = (extra) => (typeof tabId === "number" ? { ...extra, tabId } : extra);

  try {
    await action.setBadgeText(details({ text: "" }));
    await action.setTitle(details({ title: message(browser, "actionTooltip") }));
  } catch (error) {
    log?.warn?.("could not reset the toolbar button", error);
  }
}
