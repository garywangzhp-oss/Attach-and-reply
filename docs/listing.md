# addons.thunderbird.net listing

Copy for the submission form at
<https://addons.thunderbird.net/en-US/developers/addon/submit/>.

## Fields

**Name**

    Attach & Reply

**Summary** (English, 2 lines, keep it under ~200 characters)

    Reply with the attachments of the original mail already in place. Pick it from
    the message list, a toolbar button or a shortcut - no waiting, no dialog.

**Summary** (Simplified Chinese)

    回复时原邮件的附件已经就位。邮件列表右键、工具栏按钮或快捷键都能触发，不用等、不弹窗。

**Description** (English)

    Every mail client copies the quoted text when you reply. None of them copies
    the attachments, so you re-attach the same PDF by hand, every single time.

    Attach & Reply does one thing: it opens the reply with the attachments of the
    original mail already attached.

    Three ways to use it:

    * Right-click a message in the message list and choose "Reply with
      Attachments" or "Reply All with Attachments"
    * Click the Attach & Reply button in the message display toolbar (Shift+click
      replies to the sender only)
    * Press Ctrl+Shift+U

    Regular attachments are copied in their original order with their original
    file names, including non-ASCII names. Everything that is not a real file is
    left alone: images embedded in the body stay in the body, web links and cloud
    attachments are not files, deleted attachments are placeholders. If the
    original mail had attachments and all of them were filtered out, the toolbar
    button shows how many and why.

    Why another add-on for this? Because the established one works the other way
    around: it only learns that you replied after the compose window exists, so it
    polls the host, retries, and finally asks a question in a dialog. That is a
    visible multi-second stall. Attach & Reply starts from the message you
    selected, so the message id is known before the compose window opens - the
    attachments are handed over at creation time.

    No data collection, no network requests, no options page. Three permissions:
    read messages, compose messages, and add two items to the message list
    context menu.

**Description** (Simplified Chinese)

    所有邮件客户端在回复时都会引用原文，但没有一个会带上原来的附件——同一个 PDF，
    每次都得手动再挂一遍。

    Attach & Reply 只做一件事：回复时，把原邮件的附件提前挂好。

    三种用法：

    * 在邮件列表里右键，选“带附件回复”或“带附件全部回复”
    * 点消息区工具栏上的 Attach & Reply 按钮（按住 Shift 点击 = 仅回复发件人）
    * 按 Ctrl+Shift+U

    普通附件会按原顺序、原名带过来，中文文件名不会乱码。不是文件的东西一律不动：
    正文内嵌图片留在正文里，网页链接附件和云附件不是文件，已删除的附件只是占位。
    如果原邮件有附件但全被过滤掉了，工具栏按钮上会显示数量和原因。

    为什么还要再写一个？因为现有的那个是反着做的：它要等回复窗口出现之后才知道你
    回复了哪封邮件，于是轮询、重试，最后再弹个框问你要不要带附件——所以你会看到
    好几秒的卡顿。Attach & Reply 从你选中的那封邮件出发，创建回复窗口之前就已经知道
    邮件 ID，附件是随窗口一起给过去的。

    不收集数据、不联网、没有设置页。只用三个权限：读取邮件、撰写邮件、往邮件列表
    右键菜单加两项。

**Categories / tags**

    Pick the composition / message-reading categories the form offers; suitable
    keywords are: reply, attachment, attachments, compose, productivity.

## Permission justification (for the reviewer)

| Permission | Why it is needed |
|---|---|
| `compose` | to open the reply and to hand the attachments to it |
| `messagesRead` | to read the attachment list of the selected message and to fetch the attachment contents |
| `menus` | to add the two entries to the message list context menu |

## Notes for the reviewer

- Single purpose: reply to a message with the original attachments.
- No remote code, no `eval`, no obfuscation, no build step - the files in the
  archive are the sources.
- No network access at all: the add-on never calls `fetch`/`XMLHttpRequest`.
- No data collection (`browser_specific_settings.gecko.data_collection_permissions`
  is `none`).
- The badge notice is deliberate: at most one API call after the compose window
  opens, no loops.
- Works on plain Thunderbird 140+ as well; nothing Betterbird-specific is used.

## Screenshots to capture

Capture these in Betterbird with a mail that has two PDFs, one inline image and
one non-ASCII file name. Suggested captions in brackets.

1. The message list context menu open, showing both entries
   [*Both entries in the message list context menu*]
2. The compose window right after the click, attachment pane expanded with the
   files already there [*The reply arrives with the attachments already attached*]
3. The toolbar button with a badge from a mail whose attachments were all
   filtered out, tooltip visible [*Says what it skipped instead of failing silently*]
4. Optional: the Permissions page of the add-on showing exactly three entries
   [*Three permissions*]

AMO/ATN wants screenshots at 1280x800 or smaller; take them at 100% scaling if
possible, and crop out everything that is not the feature.

## Icon

Shipped icon is the flat placeholder from `tools/make-icons.py`. Replace it if a
proper mark exists; the file names must stay `icons/icon-{16,48,128}.png`.
