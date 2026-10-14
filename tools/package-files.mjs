/**
 * Which files make up the .xpi.
 *
 * Shared by the build and the package check so the two can never disagree about
 * what belongs inside the add-on.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Development-only directories: never shipped inside the .xpi. */
export const EXCLUDED_DIRS = new Set([
  ".git",
  ".github",
  "dist",
  "docs",
  "test",
  "tools",
]);

/** Development-only files: never shipped inside the .xpi. */
export const EXCLUDED_FILES = new Set([
  ".gitattributes",
  ".gitignore",
  "build.ps1",
  "package.json",
  "package-lock.json",
]);

/**
 * @param {string} root repository root
 * @returns {{name: string, data: Buffer}[]} sorted by name, ready to be zipped
 */
export function collectPackageFiles(root) {
  const found = [];

  const walk = (dir, prefix) => {
    const items = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    );
    for (const item of items) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) {
        if (!EXCLUDED_DIRS.has(name)) {
          walk(join(dir, item.name), name);
        }
      } else if (!EXCLUDED_FILES.has(name) && !name.endsWith(".xpi")) {
        found.push({ name, data: readFileSync(join(dir, item.name)) });
      }
    }
  };

  walk(root, "");
  return found;
}
