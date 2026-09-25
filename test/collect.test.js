import test from "node:test";
import assert from "node:assert/strict";

import {
  SKIP,
  classifyAttachment,
  collectReferencedContentIds,
  fetchAttachments,
  normalizeContentId,
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
  const image = part({ contentId: "image1@example", contentDisposition: "inline" });
  // referenced by the body, and declaring itself inline
  assert.equal(classifyAttachment(image, new Set(["image1@example"])), SKIP.INLINE);
  // body unreadable, but the part still says inline
  assert.equal(classifyAttachment(image, null), SKIP.INLINE);
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

  // The body references cid1, so that part is embedded content.
  const { keep, skipped } = splitAttachments(listed, new Set(["cid1"]));

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
        // An embedded image: it declares itself inline *and* the body references it.
        part({
          partName: "3",
          name: "logo.png",
          contentId: "cid1",
          contentDisposition: "inline",
        }),
        part({ partName: "4", name: "notes.txt" }),
      ],
      getFull: async () => ({
        parts: [{ contentType: "text/html", body: '<img src="cid:cid1">' }],
      }),
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


test("a content id alone does not make a part inline", () => {
  // Regression: a PDF called Contract.pdf carried a Content-ID, was treated as
  // embedded content and silently vanished from the reply.
  const pdf = part({ name: "Contract.pdf", contentType: "application/pdf", contentId: "<abc@example>" });
  assert.equal(classifyAttachment(pdf, new Set()), null);
});

test("a part the body references is inline", () => {
  const logo = part({ name: "logo.png", contentType: "image/png", contentId: "<logo@example>" });
  assert.equal(classifyAttachment(logo, new Set(["logo@example"])), SKIP.INLINE);
});

test("when the body cannot be read, the part's own disposition decides", () => {
  const explicit = part({ contentId: "<x@y>", contentDisposition: "attachment" });
  const undeclared = part({ contentId: "<x@y>", contentDisposition: undefined });
  assert.equal(classifyAttachment(explicit, null), null);
  assert.equal(classifyAttachment(undeclared, null), SKIP.INLINE);
});

test("normalizeContentId copes with the spellings hosts use", () => {
  assert.equal(normalizeContentId("<part1.abc@example>"), "part1.abc@example");
  assert.equal(normalizeContentId("cid:part1.abc%40example"), "part1.abc@example");
  assert.equal(normalizeContentId("CID:Part1.ABC@Example"), "part1.abc@example");
  assert.equal(normalizeContentId(""), "");
  assert.equal(normalizeContentId(undefined), "");
});

test("collectReferencedContentIds only finds referenced ids", async () => {
  const browser = {
    messages: {
      getFull: async () => ({
        contentType: "multipart/related",
        parts: [
          { contentType: "text/html", body: '<img src="cid:logo%40example"> and <img src="cid:footer@example">' },
          { contentType: "text/plain", body: "no references here" },
        ],
      }),
    },
  };

  const referenced = await collectReferencedContentIds("m1", browser, {});

  assert.deepEqual([...referenced].sort(), ["footer@example", "logo@example"]);
});

test("collectReferencedContentIds reports an unreadable body as null", async () => {
  const browser = { messages: { getFull: async () => { throw new Error("offline"); } } };
  assert.equal(await collectReferencedContentIds("m1", browser, {}), null);
});

test("fetchAttachments keeps an attachment that merely carries a content id", async () => {
  const requested = [];
  const browser = {
    messages: {
      listAttachments: async () => [
        part({ partName: "2", name: "Contract.pdf", contentType: "application/pdf", contentId: "<contract@example>" }),
        part({ partName: "3", name: "logo.png", contentType: "image/png", contentId: "<logo@example>" }),
      ],
      getFull: async () => ({
        parts: [{ contentType: "text/html", body: '<img src="cid:logo@example">' }],
      }),
      getAttachmentFile: async (messageId, partName) => {
        requested.push(partName);
        return { name: partName, size: 1 };
      },
    },
  };

  const { files, skipped } = await fetchAttachments("m1", browser, {});

  assert.deepEqual(requested, ["2"]);
  assert.deepEqual(files.map((f) => f.name), ["Contract.pdf"]);
  assert.deepEqual(skipped, [{ name: "logo.png", reason: SKIP.INLINE }]);
});
