#!/usr/bin/env node
/**
 * Build the .xpi - the command reviewers run (`npm run build`).
 *
 * It only packages files that are already in the repository: no transpiling, no
 * bundling, no minifying. What a reviewer rebuilds is what users run.
 *
 * The archive is written deterministically - entries sorted, timestamps fixed,
 * compression level pinned - so the same sources produce the same bytes on any
 * platform and the published SHA-256 is reproducible.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import { collectPackageFiles } from "./package-files.mjs";
import { readZipEntryNames } from "./zip-read.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Fixed DOS timestamp: 1980-01-01 00:00:00, the earliest the format allows.
const DOS_TIME = 0;
const DOS_DATE = 0x21;

function localFileHeader(name, size, method, crc, compressedLength) {
  const nameBytes = Buffer.from(name, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed: 2.0 (deflate)
  header.writeUInt16LE(0x0800, 6); // UTF-8 file names
  header.writeUInt16LE(method, 8);
  header.writeUInt16LE(DOS_TIME, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressedLength, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28); // no extra field
  return Buffer.concat([header, nameBytes]);
}

function centralDirectoryHeader(entry) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x031e, 4); // made by: unix, version 3.0
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt16LE(DOS_TIME, 12);
  header.writeUInt16LE(DOS_DATE, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressedLength, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(Buffer.byteLength(entry.name, "utf8"), 28);
  header.writeUInt16LE(0, 30); // extra
  header.writeUInt16LE(0, 32); // comment
  header.writeUInt16LE(0, 34); // disk number
  header.writeUInt16LE(0, 36); // internal attributes
  header.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external: regular file, mode 0644
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, Buffer.from(entry.name, "utf8")]);
}

function endOfCentralDirectory(count, size, offset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(count, 8);
  record.writeUInt16LE(count, 10);
  record.writeUInt32LE(size, 12);
  record.writeUInt32LE(offset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

function buildZip(files) {
  const parts = [];
  const entries = [];
  let offset = 0;

  for (const { name, data } of files) {
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    const header = localFileHeader(name, data.length, method, crc, body.length);

    parts.push(header, body);
    entries.push({
      name,
      method,
      crc,
      size: data.length,
      compressedLength: body.length,
      offset,
    });
    offset += header.length + body.length;
  }

  const centralParts = [];
  let centralSize = 0;
  for (const entry of entries) {
    const record = centralDirectoryHeader(entry);
    centralParts.push(record);
    centralSize += record.length;
  }

  return Buffer.concat([
    ...parts,
    ...centralParts,
    endOfCentralDirectory(entries.length, centralSize, offset),
  ]);
}

const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;
const distDir = join(ROOT, "dist");
mkdirSync(distDir, { recursive: true });

const archivePath = join(distDir, `attach-and-reply-${version}.xpi`);
const checksumPath = `${archivePath}.sha256`;
for (const path of [archivePath, checksumPath]) {
  if (existsSync(path)) rmSync(path);
}

const files = collectPackageFiles(ROOT);
if (!files.some((file) => file.name === "manifest.json")) {
  throw new Error("refusing to build: manifest.json is not part of the package");
}

const archive = buildZip(files);
writeFileSync(archivePath, archive);

// Verify what was written, so a broken writer cannot ship a broken package.
const required = ["manifest.json", "background.html", "options.html", "_locales/en/messages.json"];
const names = readZipEntryNames(archivePath);
for (const needed of required) {
  if (!names.includes(needed)) {
    throw new Error(`the built archive is missing ${needed}`);
  }
}
const allowedDevDirs = [];
for (const name of names) {
  if (["test/", "tools/", "docs/", ".github/"].some((dir) => name.startsWith(dir))) {
    allowedDevDirs.push(name);
  }
}
if (allowedDevDirs.length) {
  throw new Error(`the built archive carries development files: ${allowedDevDirs.join(", ")}`);
}

const digest = createHash("sha256").update(archive).digest("hex");
writeFileSync(checksumPath, `${digest}  ${basename(archivePath)}\n`, "ascii");

console.log(`Built ${archivePath}`);
console.log(`files  ${files.length}`);
console.log(`sha256 ${digest}`);
