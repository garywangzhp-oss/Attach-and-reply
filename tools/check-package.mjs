#!/usr/bin/env node
/**
 * Quality gate, run by `npm run check` and before every build.
 *
 * Cheap, deterministic checks of things that have actually gone wrong here:
 *
 *   - the diagnostic flag left switched on in lib/log.js
 *   - an invalid `suggested_key` (Thunderbird allows one or two modifiers, and
 *     one of them has to be a primary modifier)
 *   - a `__MSG_...__` reference without a matching string
 *   - a message key used in code that is missing from a locale, or locales that
 *     drifted apart
 *   - a file referenced by the manifest that does not exist
 *   - a built archive without manifest.json at its root, or one that carries
 *     development files
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EXCLUDED_DIRS, EXCLUDED_FILES, collectPackageFiles } from "./package-files.mjs";
import { readZipEntryNames } from "./zip-read.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PRIMARY_MODIFIERS = new Set(["Ctrl", "Alt", "Command", "MacCtrl"]);
const MAX_MODIFIERS = 2;
const REQUIRED_IN_ARCHIVE = [
  "manifest.json",
  "background.html",
  "_locales/en/messages.json",
  "_locales/zh_CN/messages.json",
];
const CODE_FILES = [
  "background.js",
  "options.js",
  "lib/config.js",
  "lib/donate.js",
  "lib/collect.js",
  "lib/reply.js",
  "lib/notify.js",
  "lib/actions.js",
];

const problems = [];
const problem = (text) => problems.push(text);

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function checkDebugFlag() {
  if (/export const DEBUG = true/.test(read("lib/log.js"))) {
    problem("lib/log.js still has DEBUG = true - set it back to false before shipping");
  }
}

function checkShortcut(value) {
  const parts = value.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    problem(`suggested_key ${JSON.stringify(value)} has no modifiers`);
    return;
  }
  if (parts.length - 1 > MAX_MODIFIERS) {
    problem(
      `suggested_key ${JSON.stringify(value)} uses ${parts.length - 1} modifiers, at most ${MAX_MODIFIERS} are allowed`
    );
  }
  if (!parts.slice(0, -1).some((modifier) => PRIMARY_MODIFIERS.has(modifier))) {
    problem(`suggested_key ${JSON.stringify(value)} has no primary modifier`);
  }
}

function checkManifestAndLocales(manifest, manifestText) {
  for (const command of Object.values(manifest.commands || {})) {
    const shortcut = (command.suggested_key || {}).default;
    if (shortcut) checkShortcut(shortcut);
  }

  const defaultLocale = manifest.default_locale || "en";
  const locales = {};
  for (const locale of ["en", "zh_CN"]) {
    locales[locale] = JSON.parse(read(`_locales/${locale}/messages.json`));
  }
  const reference = locales[defaultLocale] || locales.en;

  for (const key of new Set([...manifestText.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((m) => m[1]))) {
    if (!(key in reference)) {
      problem(`manifest references ${key}, missing in ${defaultLocale}`);
    }
  }

  const names = Object.keys(locales);
  for (const locale of names) {
    const onlyHere = Object.keys(locales[locale]).filter((key) => !(key in locales[names[0]]));
    const onlyThere = Object.keys(locales[names[0]]).filter((key) => !(key in locales[locale]));
    if (onlyHere.length || onlyThere.length) {
      problem(`locale ${locale} differs from ${names[0]} (extra: ${onlyHere}, missing: ${onlyThere})`);
    }
  }

  const used = new Set();
  for (const rel of CODE_FILES) {
    const source = read(rel);
    for (const match of source.matchAll(/message\(\s*(?:browser,\s*)?"([A-Za-z0-9_]+)"/g)) {
      used.add(match[1]);
    }
    for (const match of source.matchAll(/:\s*"(reason[A-Za-z0-9_]+)"/g)) {
      used.add(match[1]);
    }
  }
  for (const key of used) {
    if (!(key in reference)) problem(`code uses message key ${key}, missing in ${defaultLocale}`);
  }

  const referenced = [
    ...Object.values(manifest.icons || {}),
    ...Object.values((manifest.message_display_action || {}).default_icon || {}),
  ];
  if (manifest.background?.page) referenced.push(manifest.background.page);
  if (manifest.options_ui?.page) referenced.push(manifest.options_ui.page);
  for (const rel of referenced) {
    if (!existsSync(join(ROOT, rel))) problem(`manifest references missing file ${rel}`);
  }
}

function checkArchive(path) {
  if (!existsSync(path)) return false;
  const names = readZipEntryNames(path);
  if (!names.includes("manifest.json")) {
    problem(`${path}: manifest.json is not at the root of the archive`);
  }
  for (const required of REQUIRED_IN_ARCHIVE) {
    if (!names.includes(required)) problem(`${path}: misses ${required}`);
  }
  for (const name of names) {
    const top = name.split("/")[0];
    if (EXCLUDED_DIRS.has(top)) problem(`${path}: carries development directory ${top}/`);
    if (EXCLUDED_FILES.has(name)) problem(`${path}: carries development file ${name}`);
  }
  return true;
}

// ---------------------------------------------------------------------------

const manifest = JSON.parse(read("manifest.json"));

checkDebugFlag();
checkManifestAndLocales(manifest, read("manifest.json"));

// The list that would be packaged, so the archive check below is not the only guard.
const files = collectPackageFiles(ROOT).map((file) => file.name);
if (!files.includes("manifest.json")) problem("manifest.json would not be packaged");
for (const required of REQUIRED_IN_ARCHIVE) {
  if (!files.includes(required)) problem(`the package would miss ${required}`);
}

const archivePath = join(ROOT, "dist", `attach-and-reply-${manifest.version}.xpi`);
const archiveChecked = checkArchive(archivePath);

if (problems.length) {
  console.error(`check-package: ${problems.length} problem(s)`);
  for (const text of problems) console.error(`  - ${text}`);
  process.exit(1);
}

console.log(
  `check-package: OK (version ${manifest.version}, ${files.length} files${archiveChecked ? ", archive verified" : ", no archive to verify"})`
);
