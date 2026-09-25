import test from "node:test";
import assert from "node:assert/strict";

import {
  SKIP,
  classifyAttachment,
  fetchAttachments,
  splitAttachments,
} from "../lib/collect.js";
import { summarizeSkipped } from "../lib/notify.js";

/** A plain, attachable part. */
const part = (over = {}) => ({
  type: "normal",
  partName: "2",
  name: "report.pdf",
  contentType: "application/pdf",
  contentDisposition: "attachment",
  size: 1024,
  ...over,
});

const fakeBrowser = {
  i18n: { getMessage: (key) => key },
};

test("keeps a regular attachment", () => {
  assert.equal(classifyAttachment(part()), null);
});

test("keeps an attachment that merely carries a content type we do not know", () => {
  assert.equal(classifyAttachment(part({ contentType: "application/octet-stream" })), null);
});

test("skips parts that are shown inline in the body", () => {
  assert.equal(classifyAttachment(part({ contentId: "image1@example" })), SKIP.INLINE);
});

test("skips web links that are not files", () => {
  assert.equal(classifyAttachment(part({ type: "linked" })), SKIP.LINKED);
  assert.equal(
    classifyAttachment(part({ linkUrl: "https://example.com/page" })),
    SKIP.LINKED
  );
});

test("skips cloud attachments", () => {
  assert.equal(classifyAttachment(part({ type: "cloudFile" })), SKIP.CLOUD);
  assert.equal(classifyAttachment(part({ cloudFileUrl: "https://x/y" })), SKIP.CLOUD);
});

test("skips deleted attachments", () => {
  assert.equal(classifyAttachment(part({ type: "deleted" })), SKIP.DELETED);
  assert.equal(
    classifyAttachment(part({ contentType: "text/x-moz-deleted" })),
    SKIP.DELETED
  );
});

test("skips attachments whose content lives outside the message", () => {
  assert.equal(classifyAttachment(part({ type: "detached" })), SKIP.DETACHED);
});

test("skips parts without a MIME location", () => {
  assert.equal(classifyAttachment(part({ partName: undefined })), SKIP.UNKNOWN);
  assert.equal(classifyAttachment(null), SKIP.UNKNOWN);
});

test("splitAttachments keeps the original order and reports what it dropped", () => {
  const listed = [
    part({ partName: "2", name: "one.pdf" }),
    part({ partName: "3", name: "logo.png", contentId: "cid1" }),
    part({ partName: "4", name: "合同.pdf" }),
    part({ partName: "5", name: "link", type: "linked" }),
    part({ partName: "6", name: "two.pdf" }),
  ];

  const { keep, skipped } = splitAttachments(listed);

  assert.deepEqual(
    keep.map((attachment) => attachment.name),
    ["one.pdf", "合同.pdf", "two.pdf"]
  );
  assert.deepEqual(skipped, [
    { name: "logo.png", reason: SKIP.INLINE },
    { name: "link", reason: SKIP.LINKED },
  ]);
});

test("splitAttachments tolerates an empty or missing list", () => {
  assert.deepEqual(splitAttachments([]), { keep: [], skipped: [] });
  assert.deepEqual(splitAttachments(undefined), { keep: [], skipped: [] });
});

test("fetchAttachments only reads the parts it keeps and preserves display names", async () => {
  const requested = [];
  const browser = {
    messages: {
      listAttachments: async () => [
        part({ partName: "2", name: "合同.pdf" }),
        part({ partName: "3", name: "logo.png", contentId: "cid1" }),
        part({ partName: "4", name: "notes.txt" }),
      ],
      getAttachmentFile: async (messageId, partName) => {
        requested.push(partName);
        return { name: "transport-name", size: 4 };
      },
    },
  };

  const { files, skipped } = await fetchAttachments("message-1", browser, {});

  assert.deepEqual(requested, ["2", "4"]);
  assert.deepEqual(
    files.map((entry) => entry.name),
    ["合同.pdf", "notes.txt"]
  );
  assert.deepEqual(skipped, [{ name: "logo.png", reason: SKIP.INLINE }]);
});

test("fetchAttachments reports an attachment it cannot read instead of failing", async () => {
  const browser = {
    messages: {
      listAttachments: async () => [part({ partName: "2", name: "broken.pdf" })],
      getAttachmentFile: async () => {
        throw new Error("offline");
      },
    },
  };

  const { files, skipped } = await fetchAttachments("message-1", browser, {});

  assert.deepEqual(files, []);
  assert.deepEqual(skipped, [{ name: "broken.pdf", reason: SKIP.UNREADABLE }]);
});

test("summarizeSkipped explains every reason in the user's language", () => {
  const summary = summarizeSkipped(fakeBrowser, [
    { name: "logo.png", reason: SKIP.INLINE },
    { name: "site", reason: SKIP.LINKED },
  ]);

  assert.equal(summary, "logo.png (reasonInline), site (reasonLinked)");
});
