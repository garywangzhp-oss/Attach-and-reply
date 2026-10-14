/**
 * Minimal zip reader: the entry names out of an archive's central directory.
 *
 * Only what the checks need - the package must be a zip with manifest.json at
 * its root - and deliberately dependency-free, like everything else here.
 */

import { readFileSync } from "node:fs";

export function readZipEntryNames(path) {
  const buffer = readFileSync(path);

  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error(`${path} is not a zip archive`);
  }

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`${path}: broken central directory at entry ${i}`);
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    names.push(buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
