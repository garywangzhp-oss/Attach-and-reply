/**
 * Collecting the attachments of the original message.
 *
 * The interesting part of this file is `classifyAttachment()`, which is a pure
 * function and therefore unit-tested (see test/collect.test.js). Everything the
 * Thunderbird API reports about an attachment is turned into either "keep" or a
 * concrete skip reason, so the caller can explain a partly (or fully) skipped
 * result to the user instead of silently doing nothing.
 */

export const SKIP = Object.freeze({
  INLINE: "inline",
  LINKED: "linked",
  CLOUD: "cloud",
  DELETED: "deleted",
  DETACHED: "detached",
  UNREADABLE: "unreadable",
  UNKNOWN: "unknown",
});

const DELETED_CONTENT_TYPE = "text/x-moz-deleted";

/**
 * Decide what to do with one attachment of the original message.
 *
 * @param {object} attachment - a messages.MessageAttachment
 * @returns {string|null} a SKIP reason, or null when the attachment should be kept
 */
export function classifyAttachment(attachment) {
  if (!attachment) {
    return SKIP.UNKNOWN;
  }

  // Permanently deleted attachments are placeholders only.
  if (attachment.contentType === DELETED_CONTENT_TYPE || attachment.type === "deleted") {
    return SKIP.DELETED;
  }

  // Content that is not part of the message at all. Both the `type` and the
  // accompanying URL are checked, so the classification survives a host that
  // only reports one of them.
  if (attachment.linkUrl || attachment.type === "linked") {
    return SKIP.LINKED;
  }
  if (attachment.cloudFileUrl || attachment.type === "cloudFile") {
    return SKIP.CLOUD;
  }
  if (attachment.type === "detached") {
    return SKIP.DETACHED;
  }

  // Related parts (e.g. an image embedded in the quoted body) stay in the body;
  // they must not show up a second time in the attachment pane.
  if (attachment.contentId) {
    return SKIP.INLINE;
  }

  if (!attachment.partName) {
    return SKIP.UNKNOWN;
  }

  return null;
}

/**
 * Split a list of attachments into the ones to keep and the ones to skip.
 * The order of the kept attachments is the order reported by the host.
 *
 * @param {object[]} attachments
 * @returns {{keep: object[], skipped: {name: string, reason: string}[]}}
 */
export function splitAttachments(attachments) {
  const keep = [];
  const skipped = [];

  for (const attachment of attachments || []) {
    const reason = classifyAttachment(attachment);
    if (reason) {
      skipped.push({ name: attachment.name || "", reason });
    } else {
      keep.push(attachment);
    }
  }

  return { keep, skipped };
}

/**
 * Fetch the attachment list of a message and turn every kept attachment into a
 * File object the compose window can attach.
 *
 * @param {string} messageId
 * @param {object} browser - the WebExtension API object (injected for testability)
 * @param {object} logger
 * @returns {Promise<{files: {file: File, name: string}[], skipped: {name: string, reason: string}[]}>}
 */
export async function fetchAttachments(messageId, browser, logger) {
  const listed = await browser.messages.listAttachments(messageId);
  const { keep, skipped } = splitAttachments(listed);

  const files = [];
  for (const attachment of keep) {
    try {
      const file = await browser.messages.getAttachmentFile(messageId, attachment.partName);
      if (!file) {
        skipped.push({ name: attachment.name || "", reason: SKIP.UNREADABLE });
        continue;
      }
      // Use the name the host displays. This also keeps non-ASCII file names
      // intact instead of relying on the File object's own name.
      files.push({ file, name: attachment.name || file.name || "attachment" });
    } catch (error) {
      logger?.warn?.("could not read attachment", attachment.partName, error);
      skipped.push({ name: attachment.name || "", reason: SKIP.UNREADABLE });
    }
  }

  return { files, skipped };
}
