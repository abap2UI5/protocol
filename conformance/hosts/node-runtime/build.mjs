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
 *
 * The app WINDOW is written for the app-driven window
 * (window_bind_tab( val total event window ), abap2UI5 main 694fb262 on); a
 * runtime before it - the released 1.150.0 - does not compile it, and the
 * transpile would fail for every app. On such a runtime the app is left
 * out (appDrivenWindow( ), said on stderr): its start then fails, and the
 * checks of the windowed tables with it, as test/lib/expected.mjs pins.
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

/** The ABAP apps that need the app-driven window, by file name prefix. */
export const APP_DRIVEN_APPS = Object.freeze(["z2ui5_cl_conf_window."]);

/** Whether the installed @abap2ui5/node-runtime has the app-driven window:
 *  its client interface declares cs_window_reason (abap2UI5 main 694fb262,
 *  #3032, on). */
export function appDrivenWindow() {
  const intf = path.join(path.dirname(require.resolve(`${PKG}/package.json`)), "downport", "02", "z2ui5_if_client.intf.abap");
  return fs.existsSync(intf) && /\bcs_window_reason\b/i.test(fs.readFileSync(intf, "utf8"));
}

/** The file `name` below `dir`, wherever the package keeps it, or null. */
function findBelow(dir, name) {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const hit = findBelow(p, name);
      if (hit) return hit;
    } else if (e.name === name) {
      return p;
    }
  }
  return null;
}

/** The protocol number a @abap2ui5/node-runtime package speaks: c_protocol
 *  of its z2ui5_if_ui5_types (spec/versioning.md), 0 when it declares none.
 *  `from` is a package.json the package is resolved from - this repository's
 *  by default, the plugin's of the cap2UI5 host for the runtime it hosts -
 *  and `within` a directory the package has to be found below (0 otherwise:
 *  a host that is not installed must not answer with this repository's). */
export function runtimeProtocol(from = path.join(ROOT, "package.json"), within = ROOT) {
  let dir;
  try {
    dir = path.dirname(createRequire(from).resolve(`${PKG}/package.json`));
  } catch {
    return 0;
  }
  if (path.relative(within, dir).startsWith("..")) return 0;
  const intf = findBelow(path.join(dir, "downport"), "z2ui5_if_ui5_types.intf.abap");
  const m = intf && /\bc_protocol\s+TYPE\s+i\s+VALUE\s+(\d+)/i.exec(fs.readFileSync(intf, "utf8"));
  return m ? Number(m[1]) : 0;
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
  let input = INPUT_DIR;
  if (!appDrivenWindow()) {
    input = path.join(BUILD_DIR, "apps");
    fs.mkdirSync(input, { recursive: true });
    for (const f of fs.readdirSync(INPUT_DIR)) {
      if (!APP_DRIVEN_APPS.some((p) => f.startsWith(p))) fs.copyFileSync(path.join(INPUT_DIR, f), path.join(input, f));
    }
    log(`${PKG} ${meta.version} has no app-driven window (cs_window_reason): ${APP_DRIVEN_APPS.join(", ")} left out`);
  }
  log(`transpiling ${PKG} ${meta.version} and ${rel(input)}`);
  const transpile = require.resolve(`${PKG}/setup/transpile.mjs`);
  // the command's own summary goes to stderr like its progress: stdout is the caller's (reports, --json)
  execFileSync(process.execPath, [transpile, rel(input), rel(OUTPUT_DIR)], { cwd: ROOT, stdio: ["ignore", 2, "inherit"] });
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
