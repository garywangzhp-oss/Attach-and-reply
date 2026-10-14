/**
 * Opening the reply.
 *
 * The whole point of this add-on is that the attachments are already there when
 * the compose window appears. `compose.beginReply()` accepts an `attachments`
 * array (the schema says it is "only used in the begin* functions"), so that is
 * the primary path - no polling, no waiting for the compose window to figure out
 * which message it belongs to.
 *
 * Because that behaviour is worth double-checking on every host version, the
 * result is verified once and missing attachments are added right away. That is
 * a single API call, not a retry loop.
 */

// The compose API is reached through the global `browser` object on purpose: the
// permission a call needs has to be visible to the static analysis ATN's review
// tooling runs, and a call on an injected parameter is not attributed to it. The
// module that takes a fake API object for unit tests is lib/collect.js.

const REPLY_TYPE_SENDER = "replyToSender";
const REPLY_TYPE_ALL = "replyToAll";

export { REPLY_TYPE_SENDER, REPLY_TYPE_ALL };

/**
 * @param {object} options
 * @param {string} options.messageId
 * @param {string} options.replyType - "replyToSender" or "replyToAll"
 * @param {{file: File, name: string}[]} options.attachments
 * @param {object} logger
 * @returns {Promise<object|undefined>} the compose tab
 */
export async function beginReplyWithAttachments({
  messageId,
  replyType,
  attachments,
  logger,
}) {
  const wanted = attachments || [];
  let tab;

  if (wanted.length) {
    try {
      tab = await browser.compose.beginReply(messageId, replyType, {
        attachments: wanted.map(({ file, name }) => ({ file, name })),
      });
    } catch (error) {
      logger?.warn?.("beginReply() refused the attachments, retrying without them", error);
      tab = undefined;
    }
  }

  if (!tab) {
    tab = await browser.compose.beginReply(messageId, replyType);
  }

  await ensureAttachments(tab, wanted, logger);
  return tab;
}

/**
 * Add any attachment that did not make it into the compose window.
 *
 * @param {object|undefined} tab - the compose tab returned by beginReply()
 * @param {{file: File, name: string}[]} wanted
 * @param {object} logger
 */
async function ensureAttachments(tab, wanted, logger) {
  if (!wanted.length || !tab || typeof tab.id !== "number") {
    return;
  }

  let present = [];
  try {
    present = await browser.compose.listAttachments(tab.id);
  } catch (error) {
    logger?.warn?.("could not list the attachments of the reply", error);
  }

  logger?.debug?.("reply has", present.length, "attachment(s), wanted", wanted.length);

  // If the host applied everything we asked for, there is nothing to do.
  if (present.length >= wanted.length) {
    return;
  }

  if (!present.length) {
    // Worth saying out loud: it means either the host dropped the attachments we
    // passed to beginReply(), or they could not be read at all.
    logger?.warn?.(
      "the reply came up empty although", wanted.length, "attachment(s) were requested; adding them now"
    );
  }

  const presentNames = new Set(present.map((attachment) => attachment.name));
  for (const attachment of wanted) {
    if (presentNames.has(attachment.name)) {
      continue;
    }
    try {
      await browser.compose.addAttachment(tab.id, {
        file: attachment.file,
        name: attachment.name,
      });
    } catch (error) {
      logger?.error?.("could not add attachment to the reply", attachment.name, error);
    }
  }
}
