#!/usr/bin/env python3
"""Check the add-on before it is packaged.

Everything here is a cheap, deterministic check of things that have actually
gone wrong or would break the package silently:

* an invalid `suggested_key` (Thunderbird accepts one or two modifiers only, and
  one of them has to be a primary modifier)
* a `__MSG_...__` reference without a matching string
* a message key used in code that is missing from a locale
* locale files that drifted apart
* a file referenced by the manifest that does not exist
* a built archive without `manifest.json` at its root, or one that smuggled in
  development files

Run it directly, or let build.ps1 do it:

    python tools/check-package.py [--xpi dist/attach-and-reply-0.1.0.xpi]
"""

import argparse
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PRIMARY_MODIFIERS = {"Ctrl", "Alt", "Command", "MacCtrl"}
MAX_MODIFIERS = 2

# Anything that must never end up inside the .xpi.
NOT_SHIPPED = (
    "package.json",
    "build.ps1",
    ".gitattributes",
    ".gitignore",
    ".github/",
    "docs/",
    "test/",
    "tools/",
    ".git/",
)


def check_shortcut(value, problems):
    parts = [part.strip() for part in value.split("+") if part.strip()]
    if len(parts) < 2:
        problems.append("suggested_key %r has no modifiers" % value)
        return
    if len(parts) - 1 > MAX_MODIFIERS:
        problems.append(
            "suggested_key %r uses %d modifiers, at most %d are allowed"
            % (value, len(parts) - 1, MAX_MODIFIERS)
        )
    modifiers = parts[:-1]
    if not any(modifier in PRIMARY_MODIFIERS for modifier in modifiers):
        problems.append("suggested_key %r has no primary modifier" % value)


def check_manifest(root, problems):
    manifest = json.load(open(os.path.join(root, "manifest.json"), encoding="utf-8"))

    for name, command in (manifest.get("commands") or {}).items():
        shortcut = ((command.get("suggested_key") or {}).get("default"))
        if shortcut:
            check_shortcut(shortcut, problems)

    raw = open(os.path.join(root, "manifest.json"), encoding="utf-8").read()
    locales = {}
    for locale in sorted(os.listdir(os.path.join(root, "_locales"))):
        path = os.path.join(root, "_locales", locale, "messages.json")
        locales[locale] = json.load(open(path, encoding="utf-8"))
    if not locales:
        problems.append("no locales found")

    default_locale = manifest.get("default_locale") or sorted(locales)[0]
    default = locales.get(default_locale, {})

    for key in sorted(set(re.findall(r"__MSG_([A-Za-z0-9_]+)__", raw))):
        if key not in default:
            problems.append("manifest references %s, missing in %s" % (key, default_locale))

    keys = set(locales)
    if keys:
        first = locales[sorted(keys)[0]]
        for locale, table in sorted(locales.items()):
            if set(table) != set(first):
                only_here = sorted(set(table) - set(first))
                only_there = sorted(set(first) - set(table))
                problems.append(
                    "locale %s differs from %s (extra: %s, missing: %s)"
                    % (locale, sorted(keys)[0], only_here, only_there)
                )

    used = set()
    for rel in ("background.js", "lib/collect.js", "lib/reply.js", "lib/notify.js", "lib/actions.js"):
        source = open(os.path.join(root, rel), encoding="utf-8").read()
        used |= set(re.findall(r'message\(\s*(?:browser,\s*)?"([A-Za-z0-9_]+)"', source))
        # Only the reason -> message key table, not every string in the file.
        used |= set(re.findall(r':\s*"(reason[A-Za-z0-9_]+)"', source))
    for key in sorted(used):
        if key not in default:
            problems.append("code uses message key %s, missing in %s" % (key, default_locale))

    referenced = list((manifest.get("icons") or {}).values())
    referenced += list((manifest.get("message_display_action") or {}).get("default_icon", {}).values())
    background = manifest.get("background") or {}
    if background.get("page"):
        referenced.append(background["page"])
    for rel in referenced:
        if not os.path.isfile(os.path.join(root, rel.replace("/", os.sep))):
            problems.append("manifest references missing file %s" % rel)

    return manifest


def check_archive(path, problems):
    if not os.path.isfile(path):
        problems.append("archive not found: %s" % path)
        return
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if "manifest.json" not in names:
            problems.append("manifest.json is not at the root of %s" % path)
        for required in ("background.html", "_locales/en/messages.json"):
            if required not in names:
                problems.append("%s misses %s" % (path, required))
        for bad in NOT_SHIPPED:
            if bad.endswith("/"):
                hit = any(name.startswith(bad) for name in names)
            else:
                hit = bad in names
            if hit:
                problems.append("%s should not contain %s" % (path, bad))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--xpi", help="also check this built archive")
    args = parser.parse_args()

    problems = []
    manifest = check_manifest(ROOT, problems)
    if args.xpi:
        check_archive(args.xpi, problems)

    if problems:
        print("check-package: %d problem(s)" % len(problems))
        for problem in problems:
            print("  - %s" % problem)
        return 1

    print("check-package: OK (version %s)" % manifest.get("version"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
