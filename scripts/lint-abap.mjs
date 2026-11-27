#!/usr/bin/env node
/*
 * abaplint over the ABAP conformance apps (conformance/apps/abaplint.jsonc),
 * against the framework of the installed @abap2ui5/node-runtime.
 *
 * The app WINDOW is written for the app-driven window (abap2UI5 main
 * 694fb262 on, released with 1.151.0); on a runtime before it - 1.150.0
 * and older, or a build packed before 694fb262 - it cannot
 * pass the syntax check, so it is left out there and the run says so, as
 * the node-runtime host leaves it out of its build
 * (conformance/hosts/node-runtime/build.mjs). Every other app is checked.
 *
 *   node scripts/lint-abap.mjs        (npm run lint:abap)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { appDrivenWindow, APP_DRIVEN_APPS } from "../conformance/hosts/node-runtime/build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = path.join(ROOT, "conformance", "apps");
const require = createRequire(path.join(ROOT, "package.json"));
const abaplint = path.join(path.dirname(require.resolve("@abaplint/cli/package.json")), "abaplint");

let config = "abaplint.jsonc";
let temp = null;
if (!appDrivenWindow()) {
  // the comments of the config are whole lines; drop them, then exclude the apps
  const text = fs.readFileSync(path.join(APPS, config), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const json = JSON.parse(text);
  json.global.exclude = [...(json.global.exclude || []), ...APP_DRIVEN_APPS.map((p) => p.replace(/\./g, "\\."))];
  temp = path.join(APPS, ".abaplint.released.json");
  fs.writeFileSync(temp, JSON.stringify(json, null, 2));
  config = path.basename(temp);
  process.stderr.write(`[lint:abap] the installed @abap2ui5/node-runtime has no app-driven window: ${APP_DRIVEN_APPS.join(", ")} left out\n`);
}
try {
  const r = spawnSync(process.execPath, [abaplint, config], { cwd: APPS, stdio: "inherit" });
  process.exitCode = r.status ?? 1;
} finally {
  if (temp) fs.rmSync(temp, { force: true });
}
