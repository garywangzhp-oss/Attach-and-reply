# Changelog

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
