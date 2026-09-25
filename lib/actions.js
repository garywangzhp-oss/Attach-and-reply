/**
 * The one action all three entry points (context menu, toolbar button, keyboard
 * shortcut) end up calling.
 */

import { fetchAttachments } from "./collect.js";
import { beginReplyWithAttachments } from "./reply.js";
import { clearNotice, showNotDownloadedNotice, showSkippedNotice } from "./notify.js";

/**
 * Open a reply to `messageId` with the attachments of the original mail already
 * in place.
 *
 * @param {object} options
 * @param {string} options.messageId
 * @param {string} options.replyType - "replyToSender" or "replyToAll"
 * @param {boolean} [options.headersOnly] - the host told us the body is not local
 * @param {object} browser
 * @param {object} log
 * @returns {Promise<object|undefined>} the compose tab, if one was opened
 */
export async function replyWithAttachments({ messageId, replyType, headersOnly }, browser, log) {
  if (!messageId) {
    log?.warn("no message id, nothing to do");
    return undefined;
  }

  if (headersOnly) {
    // Only the headers are local: the body, and with it every attachment, is not
    // available. Say so instead of opening a reply that silently has nothing.
    log?.warn("the original message is not fully downloaded (headers only)");
  }

  let files = [];
  let skipped = [];
  let listedFailed = false;
  try {
    const collected = await fetchAttachments(messageId, browser, log);
    files = collected.files;
    skipped = collected.skipped;
  } catch (error) {
    listedFailed = true;
    log?.error("could not read the attachments of the original message", error);
  }

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
  } else if (headersOnly || listedFailed) {
    await showNotDownloadedNotice({ browser, log, tabId: tab?.id });
  } else {
    await clearNotice({ browser, log, tabId: tab?.id });
  }

  return tab;
}
