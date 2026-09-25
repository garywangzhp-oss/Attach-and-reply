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
 * Content-IDs arrive in several spellings: the body may reference
 * `cid:part1.abc%40example`, while the part header says `<part1.abc@example>`.
 * Normalise both sides before comparing.
 *
 * @param {string} value
 * @returns {string} comparable form (lower case, no angle brackets, no cid: prefix)
 */
export function normalizeContentId(value) {
  if (!value) {
    return "";
  }
  let id = String(value).trim();
  if (id.toLowerCase().startsWith("cid:")) {
    id = id.slice(4);
  }
  try {
    id = decodeURIComponent(id);
  } catch (error) {
    // Not percent-encoded after all - keep the literal value.
  }
  return id.replace(/^</, "").replace(/>$/, "").trim().toLowerCase();
}

/**
 * Decide what to do with one attachment of the original message.
 *
 * @param {object} attachment - a messages.MessageAttachment
 * @param {Set<string>|null} [referencedContentIds] - Content-IDs the body actually
 *   references, or null when the body could not be read
 * @returns {string|null} a SKIP reason, or null when the attachment should be kept
 */
export function classifyAttachment(attachment, referencedContentIds) {
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

  // A Content-ID does not make a part inline: plenty of clients stamp one on
  // ordinary attachments, and treating that as "embedded" silently drops real
  // files (a PDF "Contract.pdf" did exactly that in the field). Only a part the
  // body actually references is embedded content.
  if (attachment.contentId) {
    if (referencedContentIds) {
      const id = normalizeContentId(attachment.contentId);
      return referencedContentIds.has(id) ? SKIP.INLINE : null;
    }
    // The body could not be read, so trust what the part says about itself.
    return attachment.contentDisposition === "attachment" ? null : SKIP.INLINE;
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
export function splitAttachments(attachments, referencedContentIds) {
  const keep = [];
  const skipped = [];

  for (const attachment of attachments || []) {
    const reason = classifyAttachment(attachment, referencedContentIds);
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
  // Logged unconditionally: when the original message is not fully downloaded the
  // host reports an empty list, which is indistinguishable from "no attachments"
  // unless we write down what it actually returned.
  logger?.debug?.("listAttachments() returned", Array.isArray(listed) ? listed.length : listed);
  logger?.debug?.("raw attachment metadata", listed);

  // Only read the MIME structure when something claims to be a related part -
  // that is the only case where the body decides whether it is inline.
  const needsReferences = (listed || []).some(
    (attachment) => attachment && attachment.contentId
  );
  const referencedContentIds = needsReferences
    ? await collectReferencedContentIds(messageId, browser, logger)
    : null;

  const { keep, skipped } = splitAttachments(listed, referencedContentIds);
  for (const entry of skipped) {
    logger?.debug?.("skipping", entry.name, "because", entry.reason);
  }

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

/**
 * Collect the Content-IDs the message body actually points at (`cid:` URLs).
 *
 * @param {string} messageId
 * @param {object} browser
 * @param {object} logger
 * @returns {Promise<Set<string>|null>} null when the body could not be read
 */
export async function collectReferencedContentIds(messageId, browser, logger) {
  let full;
  try {
    full = await browser.messages.getFull(messageId);
  } catch (error) {
    logger?.warn?.("could not read the MIME structure of the original message", error);
    return null;
  }

  const referenced = new Set();
  const visit = (part) => {
    if (!part) {
      return;
    }
    if (typeof part.body === "string") {
      for (const match of part.body.matchAll(/cid:([^"'\s>)]+)/gi)) {
        const id = normalizeContentId(match[1]);
        if (id) {
          referenced.add(id);
        }
      }
    }
    for (const child of part.parts || []) {
      visit(child);
    }
  };
  visit(full);

  logger?.debug?.("the body references", referenced.size, "content id(s)", [...referenced]);
  return referenced;
}
