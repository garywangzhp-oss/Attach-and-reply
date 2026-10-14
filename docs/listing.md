# addons.thunderbird.net listing

Copy for the submission form at
<https://addons.thunderbird.net/en-US/developers/addon/submit/>.

## Fields

Three lengths. The **Summary** is what the search results show; the English one is
well under the 250 character limit.

The pitch, in one sentence: *you choose whether to reply with attachments, and
that choice happens before the reply exists* - which is also why nothing stalls.

### One-liner (GitHub repository description, release notes)

**EN** (93 chars)

    Reply with the original attachments when you choose to - the choice happens before the reply.

**ZH** (30 chars)

    要不要带附件回复，由你自己选——而且这个选择发生在回复之前。

### Summary (the ATN "Summary" field)

**EN** (201 chars)

    Reply with the original attachments when you choose to - nothing is automatic. Pick "Reply with Attachments" first and the reply opens with the files already attached: no waiting, no dialog afterwards.

**ZH** (84 chars)

    带附件回复与否由你决定，不是自动的：普通「回复」保持原样，需要时先选「带附件回复」。因为这个动作发生在回复之前，回复窗口打开时附件已经在里面了——不用等、不会事后弹窗。

### Description / 概述 (the ATN description field)

**EN**

Attaching the original files is your choice, and you make it before the reply exists.

If you just want to answer, reply the way you always do - nothing changes and no attachments are added. When you do want the original files along, pick the action first:

* Right-click a message in the message list: "Reply with Attachments" or "Reply All with Attachments"
* Toolbar button in the message display area - Shift+click replies to the sender only
* Press Ctrl+Shift+U

Because the action comes first, the reply opens with the attachments already in place. There is nothing to wait for: no polling to find out which message is being replied to, no dialog asking whether to attach, no second step afterwards. That is also why it feels instant - add-ons that work the other way round only discover and attach after the compose window is already open, which stalls for seconds.

Attachments keep their original order and their original file names, including non-ASCII ones. Anything that is not a real file is left where it is: images embedded in the body stay in the body, web links and cloud attachments are not files, deleted attachments are placeholders. If the original mail had attachments and all of them were filtered out, the toolbar button shows how many were skipped and why.

Attach & Reply is free, has no ads and no tracking, and never asks for anything inside the application. It uses three permissions: read your messages, compose messages, and add two items to the message list context menu.

**ZH**

要不要带上原邮件的附件，由你自己决定——而且这个决定发生在回复出现之前。

只想正常回信时，照平常那样回复就行：什么都不变，也不会多出附件。需要把原文件一起带上时，先选动作：

* 在邮件列表里右键，选「带附件回复」或「带附件全部回复」
* 点消息区工具栏上的 Attach & Reply 按钮（按住 Shift 点击 = 仅回复发件人）
* 按 Ctrl+Shift+U

因为动作在前，回复窗口打开时附件就已经在里面了。不用等任何东西：不用轮询去问你回复的是哪封邮件，不会弹框问你要不要带附件，也没有事后第二步。这也是它感觉很快的原因——反过来做的那种插件，要等回复窗口已经打开之后才去发现和附上文件，于是卡上好几秒。

附件会保持原有顺序和文件名，中文文件名不会乱码。不是文件的东西一律不动：正文内嵌图片留在正文里，网页链接附件和云附件不是文件，已删除的附件只是占位。如果原邮件有附件但全被过滤掉了，工具栏按钮上会显示跳过几个以及原因。

带附件回复免费、无广告、不追踪，在应用里也不会向你要任何东西。只用三个权限：读取邮件、撰写邮件、在邮件列表右键菜单里加两项。

### Name

    Attach & Reply

### Notes on the description

- The short comparison at the end of the third paragraph is factual and names
  nobody. Drop it if you would rather not compare at all.
- Plain text with `*` bullets renders fine in the listing.

## Donate URL (`contributions_url` on the ATN form)

    https://garywangzhp-oss.github.io/Attach-and-reply/

Keep it identical to the constant in `lib/config.js` so the listing and the in-app
Donate button never drift apart. The page in `docs/index.html` lists the payment
options; only mainland Chinese ones are offered there for now.

## Source code field: leave it empty

**Do not attach a source archive.** The .xpi ships plain, commented source, so the
add-on is reviewed directly - and Thunderbird's own review tooling says so in as
many words:

> "If the XPI can be reviewed directly, submit just the XPI (which is reviewed
> considerably faster)."

The 0.2.1 submission was rejected because a source archive was attached to readable
code: inside such an archive, what ATN looks for is the *input* of a build
(package.json, a committed lock file, a build command), and any archive holding a
copy of the .xpi itself is flagged as unnecessary.

The repository is still set up as a reproducible npm project, in case a build step
is ever introduced:

    npm ci          # installs nothing - the project has no dependencies
    npm run build   # writes dist/attach-and-reply-<version>.xpi deterministically

## Notes for the reviewer

- Single purpose: reply to a message with the original attachments, and only when
  the user picks that action. Nothing is automatic; the normal Reply buttons are
  untouched.
- **No source archive is submitted, and none is needed**: there is no minifier, no
  bundler, no transpiler and no third-party library. Every one of the 20 files in
  the .xpi is byte-identical to the file in the public repository at tag `v0.2.3`,
  so what a reviewer reads is exactly what a user runs. All API calls are plain
  `browser.*` usages.
- No network access at all: the add-on never calls `fetch` or `XMLHttpRequest`, and
  it has no remote code, no `eval` and no obfuscation.
- No data collection
  (`browser_specific_settings.gecko.data_collection_permissions` is `none`).
- Permissions, all three used:

  | Permission | Used for |
  |---|---|
  | `compose` | `compose.beginReply()` to open the reply, `compose.addAttachment()` / `compose.listAttachments()` in `lib/reply.js` |
  | `messagesRead` | `messages.listAttachments()`, `messages.getAttachmentFile()`, `messages.getFull()` in `lib/collect.js` |
  | `menus` | the two entries in the message list context menu |

  Every call behind those permissions is a direct call on the global `browser`
  object - `browser.compose.*` in `lib/reply.js`, and `browser.menus.*`,
  `browser.messageDisplay.*`, `browser.mailTabs.*` in `background.js` - so static
  analysis can attribute each one. (`lib/collect.js` keeps the API object as a
  parameter so its tests can pass a fake; the `messages.*` calls there need
  `messagesRead`, which the calls above already require.)
- About the Firefox validator: `web-ext lint` (addons.mozilla.org's validator, which
  Thunderbird shares) reports our Thunderbird-only permissions and APIs as unknown -
  `compose`, `messagesRead`, `messageDisplay.*`, `mailTabs.*`, `messages.*`. That
  validator checks against **Firefox**'s schema, which has no mail APIs. It reports
  them as *warnings*, never errors, and Thunderbird's own linter - same file, same
  review, Thunderbird's annotated schema - passes every one of those calls and even
  confirms the permission mapping (`messageDisplay.getDisplayedMessages needs
  'messagesRead'`). Run it with
  `node verify.js <xpi>` from <https://github.com/thunderbird/webext-linter>:
  XPI-only review reports 0 errors, 0 warnings, 0 holds.
- The badge notice is deliberate: at most one API call after the compose window
  opens, no loops. Threads are never polled; the message id is known before the
  reply is created.
- SHA-256 of the submitted file: `6bb5785513e8fa79a119cbf5d48891e901ba699495178a30fece42f4ec0fa160` (published next to the file on GitHub).
- The options page has no settings: it carries one passive donation block, which
  the user can hide for 90 days. Donations are voluntary and unlock nothing.

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
