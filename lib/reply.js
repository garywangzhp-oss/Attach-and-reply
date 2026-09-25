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

const REPLY_TYPE_SENDER = "replyToSender";
const REPLY_TYPE_ALL = "replyToAll";

export { REPLY_TYPE_SENDER, REPLY_TYPE_ALL };

/**
 * @param {object} options
 * @param {string} options.messageId
 * @param {string} options.replyType - "replyToSender" or "replyToAll"
 * @param {{file: File, name: string}[]} options.attachments
 * @param {object} browser
 * @param {object} logger
 * @returns {Promise<object|undefined>} the compose tab
 */
export async function beginReplyWithAttachments({
  messageId,
  replyType,
  attachments,
  browser,
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
    tab = await browser.compose.beginReply(
      messageId,
      replyType,
      wanted.length ? undefined : undefined
    );
  }

  await ensureAttachments(tab, wanted, browser, logger);
  return tab;
}

/**
 * Add any attachment that did not make it into the compose window.
 *
 * @param {object|undefined} tab - the compose tab returned by beginReply()
 * @param {{file: File, name: string}[]} wanted
 * @param {object} browser
 * @param {object} logger
 */
async function ensureAttachments(tab, wanted, browser, logger) {
  if (!wanted.length || !tab || typeof tab.id !== "number") {
    return;
  }

  let present = [];
  try {
    present = await browser.compose.listAttachments(tab.id);
  } catch (error) {
    logger?.warn?.("could not list the attachments of the reply", error);
  }

  // If the host applied everything we asked for, there is nothing to do.
  if (present.length >= wanted.length) {
    return;
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
