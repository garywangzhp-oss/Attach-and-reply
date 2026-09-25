/**
 * The one action all three entry points (context menu, toolbar button, keyboard
 * shortcut) end up calling.
 */

import { fetchAttachments } from "./collect.js";
import { beginReplyWithAttachments } from "./reply.js";
import { clearNotice, showSkippedNotice } from "./notify.js";

/**
 * Open a reply to `messageId` with the attachments of the original mail already
 * in place.
 *
 * @param {object} options
 * @param {string} options.messageId
 * @param {string} options.replyType - "replyToSender" or "replyToAll"
 * @param {object} browser
 * @param {object} log
 * @returns {Promise<object|undefined>} the compose tab, if one was opened
 */
export async function replyWithAttachments({ messageId, replyType }, browser, log) {
  if (!messageId) {
    log?.warn("no message id, nothing to do");
    return undefined;
  }

  const { files, skipped } = await fetchAttachments(messageId, browser, log);
  log?.debug(`collected ${files.length} attachment(s), skipped ${skipped.length}`);

  const tab = await beginReplyWithAttachments({
    messageId,
    replyType,
    attachments: files,
    browser,
    logger: log,
  });

  if (skipped.length) {
    await showSkippedNotice({ skipped, browser, log, tabId: tab?.id });
  } else {
    await clearNotice({ browser, log, tabId: tab?.id });
  }

  return tab;
}
