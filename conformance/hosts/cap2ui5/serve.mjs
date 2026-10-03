#!/usr/bin/env node
/*
 * Serve the cap2UI5 conformance apps (conformance/apps/cap2ui5) in the
 * minimal CAP project next to this file: copy the app modules into
 * srv/apps (git-ignored), start `cds-serve` as a child process on a port of
 * its own, wait for "server listening".
 *
 *   npm ci --prefix conformance/hosts/cap2ui5        # once
 *   node conformance/hosts/cap2ui5/serve.mjs [--port 4004]
 *
 * Prints "listening <url>" with the roundtrip route (/rest/root/z2ui5).
 * Also a module: startCap2ui5({ port }) -> { url, close }.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPS_SRC = path.resolve(HERE, "../../apps/cap2ui5");
const APPS_DST = path.join(HERE, "srv", "apps");
export const ROUTE = "/rest/root/z2ui5";

export function prepareApps() {
  fs.rmSync(APPS_DST, { recursive: true, force: true });
  fs.mkdirSync(APPS_DST, { recursive: true });
  for (const f of fs.readdirSync(APPS_SRC)) {
    if (f.endsWith(".js")) fs.copyFileSync(path.join(APPS_SRC, f), path.join(APPS_DST, f));
  }
}

function freePort() {
  // fetch() refuses a handful of ports in this range ("bad port"), see
  // cap2UI5's examples/bookshop/test/server.mjs
  const bad = new Set([5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697]);
  for (;;) {
    const p = 5000 + Math.floor(Math.random() * 2000);
    if (!bad.has(p)) return p;
  }
}

export async function startCap2ui5({ port = freePort(), timeoutMs = 120_000 } = {}) {
  let serveJs;
  try {
    serveJs = createRequire(path.join(HERE, "package.json")).resolve("@sap/cds/bin/serve.js");
  } catch {
    throw new Error(`the cap2UI5 host is not installed - run: npm ci --prefix ${path.relative(process.cwd(), HERE) || "."}`);
  }
  prepareApps();
  const child = spawn(process.execPath, [serveJs], {
    cwd: HERE,
    env: { ...process.env, PORT: String(port), NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  const kill = () => {
    try {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    } catch { /* gone */ }
  };
  const started = Date.now();
  while (!out.includes("server listening")) {
    if (child.exitCode !== null) throw new Error(`cds-serve exited ${child.exitCode}:\n${out.slice(-2000)}`);
    if (Date.now() - started > timeoutMs) {
      kill();
      throw new Error(`cds-serve did not start within ${timeoutMs} ms:\n${out.slice(-2000)}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    url: `http://127.0.0.1:${port}${ROUTE}`,
    log: () => out,
    close: async () => { kill(); },
  };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const portAt = args.indexOf("--port");
  startCap2ui5(portAt >= 0 ? { port: Number(args[portAt + 1]) } : {}).then(({ url }) => {
    process.stdout.write(`listening ${url}\n`);
  }, (e) => {
    process.stderr.write(`${e.stack || e}\n`);
    process.exit(1);
  });
}
