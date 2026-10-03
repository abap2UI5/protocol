#!/usr/bin/env node
/*
 * Serve @abap2ui5/node-runtime with the conformance apps built by build.mjs:
 * boot the runtime, import .build/node-runtime/apps/index.mjs (each class
 * registers itself in the running runtime), listen.
 *
 *   node conformance/hosts/node-runtime/serve.mjs [--port 3000] [--build]
 *
 * --build runs build.mjs first. Prints "listening <url>" once it answers.
 * Also a module: startNodeRuntime({ port, host, build }) -> { url, close }.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { APPS_DIR, build as buildApps } from "./build.mjs";

export async function startNodeRuntime({ port = 0, host = "127.0.0.1", build = false } = {}) {
  if (build || !fs.existsSync(path.join(APPS_DIR, "index.mjs"))) buildApps();
  const runtime = await import("@abap2ui5/node-runtime");
  await runtime.initialize();
  await import(pathToFileURL(path.join(APPS_DIR, "index.mjs")).href);
  const server = await runtime.serve({ port, host });
  const address = server.address();
  const url = `http://${host}:${address.port}/`;
  return {
    url,
    close: () => new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const portAt = args.indexOf("--port");
  const port = portAt >= 0 ? Number(args[portAt + 1]) : 3000;
  startNodeRuntime({ port, build: args.includes("--build") }).then(({ url }) => {
    process.stdout.write(`listening ${url}\n`);
  }, (e) => {
    process.stderr.write(`${e.stack || e}\n`);
    process.exit(1);
  });
}
