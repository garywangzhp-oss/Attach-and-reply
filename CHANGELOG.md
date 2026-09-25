# Changelog

## 0.2.0

- Added an options page. It has no settings on purpose: the only thing on it is a
  passive "Support this add-on" block.
- "I already donated" hides that block for 90 days. The timestamp lives in the
  extension's own `localStorage`, so this adds **no permission** - the permission
  list is still `compose`, `messagesRead`, `menus`.
- The donation link lives in exactly one place (`lib/config.js`) and is the same
  URL that belongs in the ATN listing's `contributions_url` field.

## 0.1.0

First working version.

- Reply with the attachments of the original mail already attached when the
  compose window opens. No polling, no dialog after the fact.
- Entry points: message list context menu (*Reply with Attachments* /
  *Reply All with Attachments*), the message display toolbar button, and the
  `Ctrl+Shift+U` keyboard shortcut.
- The toolbar button replies to everyone; holding Shift replies to the sender
  only.
- Skips inline parts (`contentId`), link attachments (`linkUrl`), cloud
  attachments (`cloudFileUrl`), deleted and detached parts. If everything was
  skipped, the button badge and the Error Console explain why.
- Permissions: `compose`, `messagesRead`, `menus`.
- English and Simplified Chinese localisation.
- Declared compatibility: Thunderbird/Betterbird 140 or later, the first
  version that supports `data_collection_permissions`.
