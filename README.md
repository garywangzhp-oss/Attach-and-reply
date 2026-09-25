# Attach & Reply

Reply to an e-mail **with the attachments of the original mail already in place**.
Pick "Reply with Attachments" from the message list context menu, click the
toolbar button, or press a shortcut - the compose window opens with the files
attached. No waiting, no dialog, no second step.

Works in Betterbird and Thunderbird 140 or later.

## Why this exists

The established add-on for this job ("Reply with Attachments") works *after the
fact*: it does not know that you clicked Reply until the compose window exists,
so it polls `compose.getComposeDetails()` waiting for the host to reveal which
message is being replied to, retries the attachment list, and only then asks a
question in a dialog. On a local mailbox that is a multi-second stall and a
visibly janky compose window.

This add-on inverts that. The action starts **before** a reply exists, so the
message id is already known: read the attachment list, turn the parts into
`File` objects, and hand them to `compose.beginReply()`. No polling, no
post-reply dialog, and three permissions instead of six.

| | Reply with Attachments | Attach & Reply |
|---|---|---|
| When it runs | after the compose window opened | before, from the message list |
| Finds the original by | polling compose details | the message you clicked |
| Asks a question | dialog after the fact | never |
| Permissions | `compose`, `messagesRead`, `scripting`, `sessions`, `storage`, `tabs` | `compose`, `messagesRead`, `menus` |

## Install

### Permanent (from a built .xpi)

1. `powershell -ExecutionPolicy Bypass -File build.ps1`
2. In Betterbird/Thunderbird open **Tools > Add-ons and Themes**
3. Gear icon > **Install Add-on From File...** > pick `dist/attach-and-reply-<version>.xpi`

This build of Betterbird ships with `xpinstall.signatures.required = false`, so
an unsigned .xpi can be installed permanently. Official Thunderbird builds do
require a signature - use the ATN unlisted channel for that (see *Publishing*).

### Development (temporary)

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on...** > select `manifest.json`
3. After editing the code press **Reload**

A temporary add-on disappears when the application is restarted. That is normal.

## How it behaves

Entry points:

- **Message list context menu**: *Reply with Attachments*, *Reply All with Attachments*.
  Both are greyed out unless exactly one message is selected.
- **Toolbar button** in the message display area: the button reads *Attach & Reply*
  (`default_label`), the tooltip on hover reads *Click: reply all with attachments.
  Shift+click: reply to the sender only.* (`default_title`). Clicking replies to
  **everyone**, holding **Shift** replies to the sender only.

  Note: with the toolbar set to *text only*, Thunderbird uses the title as the
  label - switch the toolbar to icons+text if you want the short label there.
- **Keyboard shortcut**: `Ctrl+Shift+U` by default, replies to everyone too;
  changeable under
  *Add-ons and Themes > gear > Manage Extension Shortcuts*.
  Thunderbird's `commands` API allows at most two modifiers, and the three
  default Reply shortcuts are taken, so the key is a compromise rather than a
  mnemonic. Command shortcuts are application-wide, so while a compose window
  is focused the shortcut still acts on the message selected in the mail tab.

What is copied: every MIME part of the original mail that is a regular
attachment, in the original order, keeping the file name the host displays
(so non-ASCII names stay intact).

What is deliberately **not** copied:

| Part | Why |
|---|---|
| Inline/related images (`contentId`) | They stay in the quoted body; copying them would duplicate content |
| Web link attachments (`linkUrl`) | The content is not part of the message |
| Cloud attachments (`cloudFileUrl`) | The content is not part of the message |
| Deleted attachments (`text/x-moz-deleted`) | Only a placeholder remains |
| Detached attachments | The content lives outside the message |

If the original mail had attachments but **all** of them were skipped, the
toolbar button gets a badge with the number and a tooltip listing what was
skipped and why, and the same list goes to the Error Console. There is no
popup - see *Known limitations* if you would rather have one.

Replying to a mail without attachments simply opens a normal reply.

## Permissions

| Permission | Needed for |
|---|---|
| `compose` | opening the reply and adding attachments |
| `messagesRead` | reading the attachment list and the attachment contents |
| `menus` | the two entries in the message list context menu |

Nothing else. The add-on makes no network requests, collects no data and has no
options page (`data_collection_permissions` is declared as `none`).

## Repository layout

```
manifest.json          MV3 manifest
background.html/.js    event page: registers the three entry points
lib/collect.js         attachment classification (pure) + fetching
lib/reply.js           compose.beginReply() and the verify-and-repair step
lib/notify.js          badge + console notice for skipped attachments
lib/actions.js         the single action all entry points call
lib/log.js             logging (flip DEBUG while developing)
_locales/              en + zh_CN
icons/                 generated by tools/make-icons.py
test/collect.test.js   node --test
build.ps1              builds dist/attach-and-reply-<version>.xpi
tools/make-icons.py    regenerates the icons (standard library only)
```

No build step and no dependencies: the source you edit is the code that runs.

## Development

```powershell
node --test                # unit tests for the pure logic
python tools/make-icons.py # regenerate the icons
powershell -ExecutionPolicy Bypass -File build.ps1
```

Debugging: set `DEBUG = true` in `lib/log.js` and watch the Error Console
(`Ctrl+Shift+J`). Uncaught errors are logged there even with `DEBUG = false`.

`package.json` exists only so Node treats `lib/*.js` as ES modules. It is not part
of the .xpi.

## Verification checklist

- [ ] Message list context menu shows both entries; both grey out on a multi-selection
- [ ] Toolbar button appears in the message display area and replies to everyone
- [ ] Shift+click on the toolbar button replies to the sender only
- [ ] Keyboard shortcut works (assign it manually if the default is taken)
- [ ] Click to compose window: **under a second** with a local mailbox and <10MB of attachments
- [ ] Regular attachments are present the moment the window appears
- [ ] A Chinese file name arrives unchanged
- [ ] An inline image stays in the body and does not appear in the attachment pane
- [ ] Link attachments are skipped and announced once
- [ ] Attachment order matches the original
- [ ] A mail without attachments opens a normal reply, no error, no notice
- [ ] "Reply All with Attachments" produces the same recipients as the native Reply All
- [ ] Error Console stays clean
- [ ] Installing asks for exactly `compose`, `messagesRead`, `menus`
- [ ] With the other add-on disabled, attachments appear exactly once

## Publishing

The plan is: local .xpi during development -> ATN *unlisted* (self-distribution)
signing with the signed file published on GitHub Releases -> ATN *listed*.

What is verified so far (checked against the live service):

- The submission form lives at
  <https://addons.thunderbird.net/en-US/developers/addon/submit/> and is behind a
  Mozilla account (signed out it redirects to accounts.firefox.com).
- API credentials are at
  <https://addons.thunderbird.net/en-US/developers/addon/api/key/>, also behind
  the same account.
- ATN serves the public read API as **v4**
  (`/api/v4/addons/addon/<slug>/` answers 200) while `/api/v5/...` answers 404, and
  every `/api/vN/addons/upload/` path answers 404. `web-ext` version 7 removed
  `--api-url-prefix` and `--use-submission-api` and made `--channel` mandatory, so
  a working `web-ext sign` invocation against ATN is **not confirmed yet**. Do the
  first submission through the web form, which also hands back a signed file for
  the unlisted case, then revisit automation.

`.github/workflows/release.yml` builds, tests and checks the .xpi on a tag push and
attaches the .xpi plus its `.sha256` to the GitHub release. Signing is left out of
it on purpose until the point above is settled.

Before submitting:

- Replace the placeholder icon and add screenshots - see `docs/listing.md`, which
  also carries the summary, description, permission justification and the notes
  for the reviewer.
- The reviewers run Thunderbird, not Betterbird. Everything here uses standard
  MailExtension APIs, so keep it that way.
- Betterbird keeps a blocklist of add-ons that patch application internals at
  runtime. Never do that.
- The name must stay distinguishable from the existing "Reply with Attachments"
  add-on.
- `npx web-ext lint` validates against *Firefox* schemas, so it reports
  Thunderbird-only manifest keys such as `message_display_action` and
  `browser_specific_settings.gecko.data_collection_permissions` as unknown. Treat
  those as false positives, but do read the rest of its output.

## Known limitations

- **Memory**: `messages.getAttachmentFile()` reads a whole attachment into
  memory. Replying with a 200MB attachment will use 200MB+ of memory. There is no
  size limit and no warning; Thunderbird's own big-attachment warning still
  applies when sending.
- **Notice**: skipped attachments are reported through a toolbar badge and the
  Error Console, not a system notification, because that would need a fourth
  permission (`notifications`). Add it if the badge turns out to be too subtle.
- **No forward**: "Reply with Attachments" only. Forwarding keeps its own,
  separate behaviour.
- **No blacklist**: every regular attachment is copied. Filtering by file name
  was deliberately left out of the first version.
- **Inline images**: detection is based on `contentId`, which the host only sets
  for related parts. An image can therefore not be "un-referenced" and still be
  treated as inline.
- **Icons** are placeholders, generated by `tools/make-icons.py`.

## License

MIT - see LICENSE.
