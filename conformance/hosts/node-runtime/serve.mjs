#!/usr/bin/env node
/*
 * Serve @abap2ui5/node-runtime with the conformance apps built by build.mjs:
 * import .build/node-runtime/abap2ui5/host.mjs - the package's exports,
 * running on the output that holds the framework and the conformance
 * classes - boot it, listen. (The package itself is not imported: a process
 * runs one output.)
 *
 *   node conformance/hosts/node-runtime/serve.mjs [--port 3000] [--build]
 *
 * --build runs build.mjs first. Prints "listening <url>" once it answers.
 * Also a module: startNodeRuntime({ port, host, build, allowedHosts }) ->
 * { url, close }.
 *
 * allowedHosts is serve()'s: from 1.147.0 on serve() puts a Host/Origin
 * guard of the host's own (srv/hostguard.mjs) in front of the framework,
 * which answers a foreign Origin with its own 403 before the framework's
 * CSRF gate ([HTTP], spec/transport.md#csrf-and-origin) sees the request.
 * The suite runs and the recorder pass "*" - the guard off, on a loopback
 * port of their own that lives for the run - so that what answers, and what
 * traffic/ records, is the framework. The CLI below keeps the guard.
 */
import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { HOST_ENTRY, build as buildApps } from "./build.mjs";

export async function startNodeRuntime({ port = 0, host = "127.0.0.1", build = false, allowedHosts } = {}) {
  if (build || !fs.existsSync(HOST_ENTRY)) buildApps();
  const runtime = await import(pathToFileURL(HOST_ENTRY).href);
  await runtime.initialize();
  const server = await runtime.serve({ port, host, ...(allowedHosts ? { allowedHosts } : {}) });
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
