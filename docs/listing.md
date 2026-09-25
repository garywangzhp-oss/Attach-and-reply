# addons.thunderbird.net listing

Copy for the submission form at
<https://addons.thunderbird.net/en-US/developers/addon/submit/>.

## Fields

Three lengths to choose from. The **Summary** is what search results and the
listing list show, so keep it to the one that fits the form's character limit
(both are well under 250).

### One-liner (GitHub repository description, release notes)

**EN** (63 chars)

    Reply to a mail with its original attachments already attached.

**ZH** (17 chars)

    回复邮件时，原邮件的附件已经挂好。

### Summary (the ATN "Summary" field)

**EN** (191 chars)

    Reply with the attachments of the original mail already in place. Pick it from the message list, a toolbar button or the Ctrl+Shift+U shortcut. No waiting, no dialog, no re-attaching by hand.

**ZH** (69 chars)

    回复时原邮件的附件已经就位。邮件列表右键、工具栏按钮或 Ctrl+Shift+U 快捷键都能触发。不用等、不弹窗，也不用再手动挂一遍附件。

### Description / 概述 (the ATN description field)

**EN**

Every mail client quotes the original message when you reply, but none of them brings the attachments along. So you re-attach the same PDF by hand, every single time.

Attach & Reply does one thing: it opens the reply with the attachments of the original mail already attached.

Three ways to use it:
* Right-click a message in the message list and choose "Reply with Attachments" or "Reply All with Attachments"
* Click the Attach & Reply button in the message display toolbar - Shift+click replies to the sender only
* Press Ctrl+Shift+U

Attachments keep their original order and their original file names, including non-ASCII ones. Anything that is not a real file is left where it is: images embedded in the body stay in the body, web links and cloud attachments are not files, deleted attachments are placeholders. If the original mail had attachments and all of them were filtered out, the toolbar button shows how many were skipped and why.

Why is it faster than the older add-on that does something similar? That one works the other way around: it only finds out which message you are replying to after the compose window exists, so it polls the host, retries, and finally asks a question in a dialog - a visible multi-second stall. Attach & Reply starts from the message you selected, so the message is known before the reply is created and the files are handed over at creation time.

Attach & Reply is free, has no ads and no tracking, and never asks for anything inside the application. It uses three permissions: read your messages, compose messages, and add two items to the message list context menu.

**ZH**

所有邮件客户端在回复时都会引用原文，但没有一个会带上原来的附件——同一个 PDF，每次都还得手动再挂一遍。

带附件回复只做一件事：回复时，把原邮件的附件提前挂好。

三种用法：
* 在邮件列表里右键，选「带附件回复」或「带附件全部回复」
* 点消息区工具栏上的 Attach & Reply 按钮（按住 Shift 点击 = 仅回复发件人）
* 按 Ctrl+Shift+U

附件会保持原有顺序和文件名，中文文件名不会乱码。不是文件的东西一律不动：正文内嵌图片留在正文里，网页链接附件和云附件不是文件，已删除的附件只是占位。如果原邮件有附件但全被过滤掉了，工具栏按钮上会显示跳过几个以及原因。

为什么比那个老的同类插件快？因为它是反着做的：要等回复窗口出现之后才知道你回复的是哪封邮件，于是轮询、重试，最后再弹个框问你——所以你能感觉到好几秒的卡顿。带附件回复从你选中的那封邮件出发，创建回复之前就已经知道是哪封，附件是随窗口一起给过去的。

带附件回复免费、无广告、不追踪，在应用里也不会向你要任何东西。只用三个权限：读取邮件、撰写邮件、在邮件列表右键菜单里加两项。

### Name

    Attach & Reply

### Notes on the description

- The paragraph explaining why it is faster than the older add-on is factual and
  names nobody. Drop it if you would rather not compare at all.
- Plain text with `*` bullets renders fine in the listing.

**Donate URL** (`contributions_url` on the ATN form)

    https://garywangzhp-oss.github.io/Attach-and-reply/

Keep it identical to the constant in `lib/config.js` so the listing and the
in-app Donate button never drift apart. It points at the support page in
`docs/index.html`, which is published through GitHub Pages. Only mainland
Chinese payment options are offered there for now; see README.md ("Donate").

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
**Source code (fill this in anyway, it costs nothing)**

    https://github.com/garywangzhp-oss/Attach-and-reply/archive/refs/tags/v0.2.0.zip

    Build instructions: no build step. The .xpi is a plain zip of the files in
    this archive. All 20 shipped files are byte-identical to their counterparts
    in the archive - unzip and compare, there are no differences. The archive
    additionally contains development-only files (test/, tools/, docs/, .github/,
    package.json, build.ps1) which are not part of the package.

- **No build process at all**: no minifier, no bundler, no transpiler and no third-party library. Every
  one of the 20 files in the submitted archive is **byte-identical** to the file
  in the public repository at tag `v0.2.0`, so what a reviewer reads is exactly
  what a user runs. Reproduce with a plain zip; `build.ps1` only packages, it does
  not transform anything.
- SHA-256 of the submitted file: `af2fecd4d69c30a2c881697e684fb401c98d28a5b935230bf3b4ab70269373a9` (published next to the file on GitHub).
- The badge notice is deliberate: at most one API call after the compose window
  opens, no loops.
- Works on plain Thunderbird 140+ as well; nothing Betterbird-specific is used.
- The options page contains no settings, only a passive donation block the user
  can hide for 90 days. It uses the extension's own `localStorage`, so the
  permission list stays at three.

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
