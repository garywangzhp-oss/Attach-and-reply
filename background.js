/**
 * Entry points.
 *
 * All listeners are registered on the top level, which is required because
 * Manifest V3 background pages in Thunderbird are limited event pages: the page
 * is torn down when idle and restarted when one of these events fires.
 *
 * Note for MV3: `mailTabs.getCurrent()` and `messageDisplay.getDisplayedMessage()`
 * are MV2-only, so this add-on uses `mailTabs.getSelectedMessages()` and
 * `messageDisplay.getDisplayedMessages()` (which return a MessageList).
 */

import { log } from "./lib/log.js";
import { replyWithAttachments } from "./lib/actions.js";
import { REPLY_TYPE_ALL, REPLY_TYPE_SENDER } from "./lib/reply.js";
import { clearNotice } from "./lib/notify.js";

const MENU_REPLY = "attach-and-reply-menu-reply";
const MENU_REPLY_ALL = "attach-and-reply-menu-reply-all";
const COMMAND_REPLY = "reply-with-attachments";

function message(key, substitutions) {
  return globalThis.browser.i18n.getMessage(key, substitutions) || key;
}

/** Normalise whatever the host returned into a plain array of message headers. */
function toMessages(result) {
  if (!result) {
    return [];
  }
  if (Array.isArray(result)) {
    return result;
  }
  return result.messages || [];
}

async function getDisplayedMessage(tabId) {
  try {
    return toMessages(await browser.messageDisplay.getDisplayedMessages(tabId))[0] || null;
  } catch (error) {
    log.warn("could not read the displayed message", error);
    return null;
  }
}

async function getSelectedMessage() {
  try {
    return toMessages(await browser.mailTabs.getSelectedMessages())[0] || null;
  } catch (error) {
    log.warn("could not read the selected message", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Context menu of the message list
// ---------------------------------------------------------------------------

// Creating the items is idempotent: an MV3 event page can be restarted at any
// time while the items created by a previous run still exist, so they are
// removed first instead of tripping over a duplicate id.
async function installMenuItems() {
  await browser.menus.removeAll();
  await browser.menus.create({
    id: MENU_REPLY,
    title: message("menuReply"),
    contexts: ["message_list"],
  });
  await browser.menus.create({
    id: MENU_REPLY_ALL,
    title: message("menuReplyAll"),
    contexts: ["message_list"],
  });
}

installMenuItems().catch((error) => log.error("could not create the menu items", error));

// Replying only makes sense for exactly one message: grey the items out for a
// multi-selection. This only looks at the selection, it never touches the
// attachments, so it stays free of any message download.
browser.menus.onShown.addListener((info) => {
  if (!info.contexts || !info.contexts.includes("message_list")) {
    return;
  }

  const single = toMessages(info.selectedMessages).length === 1;
  Promise.allSettled([
    browser.menus.update(MENU_REPLY, { enabled: single }),
    browser.menus.update(MENU_REPLY_ALL, { enabled: single }),
  ]).then(() => {
    try {
      browser.menus.refresh();
    } catch (error) {
      log.debug("menus.refresh() is unavailable", error);
    }
  });
});

browser.menus.onClicked.addListener((info) => {
  const replyType =
    info.menuItemId === MENU_REPLY_ALL
      ? REPLY_TYPE_ALL
      : info.menuItemId === MENU_REPLY
        ? REPLY_TYPE_SENDER
        : null;

  if (!replyType) {
    return;
  }

  const selected = toMessages(info.selectedMessages);
  if (selected.length !== 1 || !selected[0].id) {
    log.warn("expected exactly one selected message, got", selected.length);
    return;
  }

  return replyWithAttachments(
    { messageId: selected[0].id, replyType },
    browser,
    log
  );
});

// ---------------------------------------------------------------------------
// Toolbar button in the message display area
// ---------------------------------------------------------------------------

browser.messageDisplayAction.onClicked.addListener(async (tab) => {
  const displayed = await getDisplayedMessage(tab?.id);
  if (!displayed) {
    log.warn("no message is displayed, nothing to do");
    return;
  }

  await replyWithAttachments(
    { messageId: displayed.id, replyType: REPLY_TYPE_SENDER },
    browser,
    log
  );
});

// ---------------------------------------------------------------------------
// Keyboard shortcut
// ---------------------------------------------------------------------------

browser.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND_REPLY) {
    return;
  }

  const selected = (await getSelectedMessage()) || (await getDisplayedMessage());
  if (!selected) {
    log.warn("no message selected or displayed, nothing to do");
    return;
  }

  await replyWithAttachments(
    { messageId: selected.id, replyType: REPLY_TYPE_SENDER },
    browser,
    log
  );
});

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

// A badge left over from a previous message would be confusing.
browser.mailTabs.onSelectedMessagesChanged?.addListener?.(() => {
  clearNotice({ browser, log });
});
