#!/usr/bin/env node
/*
 * The 7.02 downport of the ABAP conformance apps - every repository of the
 * abap2UI5 ecosystem downports to 7.02, these apps included.
 *
 * `abaplint --fix` rewrites every file it downports, so this never runs on
 * the tree you commit: it copies conformance/apps/abap and its 7.02 config
 * (conformance/apps/abap_702.jsonc) into a temporary folder, downports the
 * copy, lints the result at v702 against abap2UI5's downported release and
 * throws the copy away. 0 issues or exit 1.
 *
 *   node scripts/check-702.mjs        (npm run lint:abap:702)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = path.join(ROOT, "conformance", "apps");
const CONFIG = "abap_702.jsonc";
const require = createRequire(path.join(ROOT, "package.json"));
const abaplint = path.join(path.dirname(require.resolve("@abaplint/cli/package.json")), "abaplint");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "protocol-702-"));
let status = 1;
try {
  fs.cpSync(path.join(APPS, "abap"), path.join(dir, "abap"), { recursive: true });
  fs.cpSync(path.join(APPS, CONFIG), path.join(dir, CONFIG));
  const run = (args) => spawnSync(process.execPath, [abaplint, ...args], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 });
  // --fix lowers what it can; what it cannot stays an issue for the lint below
  run(["--fix", CONFIG]);
  const lint = run([CONFIG]);
  process.stdout.write(`${lint.stdout}${lint.stderr}`.split("\n").filter((l) => /\[E\]|\[W\]|issue\(s\) found/.test(l)).join("\n") + "\n");
  status = lint.status ?? 1;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
if (status !== 0) {
  process.stderr.write("[lint:abap:702] the downported conformance apps do not lint at v702 - see above\n");
}
process.exitCode = status;
