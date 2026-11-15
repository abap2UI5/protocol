#!/usr/bin/env node
/*
 * Build the reference backend with the ABAP conformance apps
 * (conformance/apps/abap) - the recipe of @abap2ui5/node-runtime's README,
 * "Your own apps" (from 1.148.0 on), and nothing else: the package's
 * abap2ui5-transpile (setup/transpile.mjs) transpiles the framework's
 * sources (the package's downport/), open-abap-core and express-icf-shim at
 * the commits the package records (abap2ui5.openAbapCore,
 * abap2ui5.expressIcfShim; fetched with git once into
 * node_modules/.cache/abap2ui5-node-runtime/, or the checkouts
 * ABAP2UI5_OPEN_ABAP_CORE and ABAP2UI5_EXPRESS_ICF_SHIM name, below this
 * repository) and the conformance classes in ONE run, type-checked, with the
 * transpiler the package names (abap2ui5.transpiler - the
 * @abaplint/transpiler-cli pinned in package.json has to be that version,
 * the command refuses another).
 *
 * Result: .build/node-runtime/abap2ui5/ - a complete runtime with the
 * conformance classes in it and a host.mjs, the package's exports running on
 * that output, which serve.mjs imports instead of the package.
 * Usage: node conformance/hosts/node-runtime/build.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(path.join(ROOT, "package.json"));
const PKG = "@abap2ui5/node-runtime";

export const BUILD_DIR = path.join(ROOT, ".build", "node-runtime");
export const OUTPUT_DIR = path.join(BUILD_DIR, "abap2ui5");
export const HOST_ENTRY = path.join(OUTPUT_DIR, "host.mjs");
const INPUT_DIR = path.join(ROOT, "conformance", "apps", "abap");

function log(line) {
  process.stderr.write(`[build node-runtime] ${line}\n`);
}

function runtimeMeta() {
  return JSON.parse(fs.readFileSync(require.resolve(`${PKG}/package.json`), "utf8"));
}

export function build() {
  const meta = runtimeMeta();
  const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
  // an output of the recipe before 1.148.0 (apps/index.mjs) is no transpile
  // output the command would empty
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  log(`transpiling ${PKG} ${meta.version} and ${rel(INPUT_DIR)}`);
  const transpile = require.resolve(`${PKG}/setup/transpile.mjs`);
  // the command's own summary goes to stderr like its progress: stdout is the caller's (reports, --json)
  execFileSync(process.execPath, [transpile, rel(INPUT_DIR), rel(OUTPUT_DIR)], { cwd: ROOT, stdio: ["ignore", 2, "inherit"] });
  log(`runtime ready in ${rel(OUTPUT_DIR)}`);
  return { outputDir: OUTPUT_DIR, hostEntry: HOST_ENTRY, runtime: meta.version };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    build();
  } catch (e) {
    process.stderr.write(`${e.stack || e}\n`);
    process.exit(1);
  }
}
