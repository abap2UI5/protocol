#!/usr/bin/env node
/*
 * Build the ABAP conformance apps (conformance/apps/abap) for
 * @abap2ui5/node-runtime - the recipe of the package's README, "Your own
 * apps", and nothing else:
 *
 *   1. open-abap-core at the commit the package records
 *      (abap2ui5.openAbapCore), fetched with git into .cache/ - or the
 *      checkout OPEN_ABAP_CORE_DIR names (the MCP server's workspace keeps
 *      one under ~/.abap2ui5-mcp/open-abap-core/<sha>);
 *   2. abap_transpile with the package's downport/ and open-abap-core as
 *      libraries (type-checked, ignoreSyntaxCheck off);
 *   3. abap2ui5-own-apps: the conformance classes alone, their imports
 *      pointed at the package's output/ - so the framework exists once.
 *
 * Result: .build/node-runtime/apps/index.mjs, which serve.mjs imports after
 * the runtime has booted. Usage: node conformance/hosts/node-runtime/build.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(path.join(ROOT, "package.json"));
const PKG = "@abap2ui5/node-runtime";

export const BUILD_DIR = path.join(ROOT, ".build", "node-runtime");
export const APPS_DIR = path.join(BUILD_DIR, "apps");
const INPUT_DIR = path.join(ROOT, "conformance", "apps", "abap");

function log(line) {
  process.stderr.write(`[build node-runtime] ${line}\n`);
}

function runtimeMeta() {
  return JSON.parse(fs.readFileSync(require.resolve(`${PKG}/package.json`), "utf8"));
}

/** open-abap-core at `sha`: OPEN_ABAP_CORE_DIR, the MCP workspace's copy, or a fetch into .cache/. */
export function ensureOpenAbapCore(sha) {
  const candidates = [
    process.env.OPEN_ABAP_CORE_DIR,
    path.join(os.homedir(), ".abap2ui5-mcp", "open-abap-core", sha),
    path.join(ROOT, ".cache", "open-abap-core", sha),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "src"))) return dir;
  }
  const dir = path.join(ROOT, ".cache", "open-abap-core", sha);
  const tmp = `${dir}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  log(`fetching open-abap-core ${sha.slice(0, 12)}`);
  const git = (...args) => execFileSync("git", args, { cwd: tmp, stdio: ["ignore", "ignore", "inherit"] });
  git("init", "--quiet");
  git("fetch", "--quiet", "--depth", "1", "https://github.com/open-abap/open-abap-core", sha);
  git("checkout", "--quiet", "--detach", "FETCH_HEAD");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  return dir;
}

export function build() {
  const meta = runtimeMeta();
  const sha = meta.abap2ui5 && meta.abap2ui5.openAbapCore;
  if (!sha) throw new Error(`${PKG}@${meta.version} records no abap2ui5.openAbapCore`);
  const core = ensureOpenAbapCore(sha);
  const downport = path.join(path.dirname(require.resolve(`${PKG}/package.json`)), "downport");

  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  const output = path.join(BUILD_DIR, "output");
  // the transpiler joins a library folder onto its cwd - relative to the build dir
  const rel = (p) => "/" + path.relative(BUILD_DIR, p).split(path.sep).join("/");
  const config = {
    input_folder: path.relative(BUILD_DIR, INPUT_DIR).split(path.sep).join("/"),
    input_filter: ["[\\\\/][a-z0-9_]+\\.(clas|intf)\\.[a-z_.]*(abap|xml)$"],
    output_folder: "output",
    libs: [
      { folder: rel(downport), files: "/**/*.*" },
      { folder: rel(core) },
    ],
    write_unit_tests: false,
    options: { ignoreSyntaxCheck: false, addFilenames: true, addCommonJS: true, unknownTypes: "runtimeError" },
  };
  fs.writeFileSync(path.join(BUILD_DIR, "abap_transpile.json"), JSON.stringify(config, null, 2) + "\n");
  log(`transpiling ${INPUT_DIR} against ${PKG} ${meta.version}`);
  const transpiler = require.resolve("@abaplint/transpiler-cli/build/bundle.js");
  execFileSync(process.execPath, [transpiler, "abap_transpile.json"], { cwd: BUILD_DIR, stdio: ["ignore", "ignore", "inherit"] });
  const ownApps = require.resolve(`${PKG}/setup/own-apps.mjs`);
  execFileSync(process.execPath, [ownApps, output, APPS_DIR], { cwd: BUILD_DIR, stdio: ["ignore", "inherit", "inherit"] });
  fs.rmSync(output, { recursive: true, force: true });
  log(`apps ready in ${path.relative(ROOT, APPS_DIR)}`);
  return { appsDir: APPS_DIR, runtime: meta.version };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    build();
  } catch (e) {
    process.stderr.write(`${e.stack || e}\n`);
    process.exit(1);
  }
}
