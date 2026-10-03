#!/usr/bin/env node
/*
 * Vendors the agent client of abap2UI5/mcp-server - lib/appclient.mjs and
 * the two pure modules it imports (lib/snapshot.mjs, lib/viewxml.mjs) -
 * into conformance/frontend/adapters/vendor/mcp-server/, unchanged plus a
 * header, at one recorded commit. The frontend suite's `agent` adapter runs
 * it; a vendored copy keeps the suite runnable without an mcp-server
 * checkout and without the server's dependencies (the MCP SDK, Playwright).
 * Same scheme as abap2UI5/frontend-webcomponent scripts/vendor-agent.mjs.
 *
 *   node scripts/vendor-agent-client.mjs [/path/to/mcp-server] [--ref <rev>]
 *   node scripts/vendor-agent-client.mjs [/path/to/mcp-server] --check
 *
 * source.json records the commit and the sha256 of every vendored file;
 * test/frontend.test.mjs fails when a copy was edited by hand.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VENDOR_DIR = path.join(ROOT, "conformance/frontend/adapters/vendor/mcp-server");
export const FILES = ["lib/appclient.mjs", "lib/snapshot.mjs", "lib/viewxml.mjs"];

export const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const header = (file, commit) => "/*\n"
  + ` * VENDORED - do not edit. abap2UI5/mcp-server ${file} at commit ${commit},\n`
  + " * copied unchanged by scripts/vendor-agent-client.mjs. Change it upstream,\n"
  + " * then re-vendor; test/frontend.test.mjs fails when this copy drifts.\n"
  + " */\n";

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const refAt = args.indexOf("--ref");
  const home = args.find((a, i) => !a.startsWith("--") && i !== refAt + 1) || process.env.MCP_SERVER_HOME || path.resolve(ROOT, "../mcp-server");
  const record = path.join(VENDOR_DIR, "source.json");
  const prev = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, "utf8")) : null;
  const ref = refAt >= 0 ? args[refAt + 1] : (check && prev ? prev.commit : "HEAD");
  const commit = execFileSync("git", ["-C", home, "rev-parse", ref], { encoding: "utf8" }).trim();
  const files = {};
  let drift = 0;
  for (const f of FILES) {
    const text = header(f, commit) + execFileSync("git", ["-C", home, "show", `${commit}:${f}`], { encoding: "utf8", maxBuffer: 64 << 20 }).replace(/\r\n/g, "\n");
    const out = path.join(VENDOR_DIR, path.basename(f));
    files[path.basename(f)] = { from: f, sha256: sha256(text) };
    if (check) {
      if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== text) {
        process.stderr.write(`drift: ${path.relative(ROOT, out)} is not ${f}@${commit.slice(0, 7)}\n`);
        drift += 1;
      }
    } else {
      fs.mkdirSync(VENDOR_DIR, { recursive: true });
      fs.writeFileSync(out, text);
    }
  }
  if (check) {
    process.exitCode = drift ? 1 : 0;
    return;
  }
  fs.writeFileSync(record, `${JSON.stringify({ repository: "abap2UI5/mcp-server", commit, files }, null, 2)}\n`);
  process.stderr.write(`vendored ${FILES.length} files of abap2UI5/mcp-server@${commit.slice(0, 7)}\n`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
