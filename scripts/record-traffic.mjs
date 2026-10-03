#!/usr/bin/env node
/*
 * Record real traffic against a backend into traffic/<backend>/:
 *
 *   suite.json         every exchange of a full backend-suite run (ui5 profile)
 *   ui5-frontend.json  the UI5 frontend's own core/Server.js + Session.js + Lib.js
 *                      (from an abap2UI5 checkout: ABAP2UI5_HOME, else ../abap2UI5)
 *                      driving the conformance apps - the CONFIG block, HASH and
 *                      MS_CLIENT_PREV the suite's own client never sends
 *   agent-client.json  abap2UI5/mcp-server's lib/appclient.mjs (MCP_SERVER_HOME,
 *                      else ../mcp-server) driving them, with the agent snapshots
 *                      it built from each answer
 *
 *   node scripts/record-traffic.mjs node-runtime|cap2ui5
 *
 * The two optional sources are skipped (and say so) when the checkout is not
 * there. test/traffic.test.mjs validates every recorded message against the
 * schemas, and compares the two backends' suite traffic.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runBackendSuite } from "../conformance/backend/index.mjs";
import { createUi5Frontend, locateWebapp } from "./lib/ui5-frontend.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEEP_HEADERS = ["content-type", "cache-control", "x-content-type-options", "sap-contextid", "sap-contextid-accept", "sap-terminate", "origin", "if-none-match", "etag"];

const pick = (headers = {}) => Object.fromEntries(
  Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]).filter(([k]) => KEEP_HEADERS.includes(k)),
);
const parse = (text) => {
  if (typeof text !== "string" || text === "") return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
const responseBody = (text, headers) => (/html/i.test(headers["content-type"] || "") ? `<${text.length} characters of HTML>` : parse(text));

async function startBackend(name) {
  if (name === "node-runtime") {
    const { startNodeRuntime } = await import("../conformance/hosts/node-runtime/serve.mjs");
    const s = await startNodeRuntime({ build: true });
    const req = createRequire(path.join(ROOT, "package.json"));
    return { ...s, version: `@abap2ui5/node-runtime ${req("@abap2ui5/node-runtime/package.json").version}` };
  }
  if (name === "cap2ui5") {
    const { startCap2ui5 } = await import("../conformance/hosts/cap2ui5/serve.mjs");
    const s = await startCap2ui5();
    const req = createRequire(path.join(ROOT, "conformance/hosts/cap2ui5/package.json"));
    return { ...s, version: `@cap2ui5/cds-plugin ${req("@cap2ui5/cds-plugin/package.json").version} on @abap2ui5/node-runtime ${req("@abap2ui5/node-runtime/package.json").version}` };
  }
  throw new Error(`unknown backend "${name}" - node-runtime or cap2ui5`);
}

function write(dir, file, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), `${JSON.stringify(data, null, 2)}\n`);
  process.stderr.write(`[record] ${path.relative(ROOT, path.join(dir, file))}\n`);
}

async function recordSuite(backend, dir) {
  const report = await runBackendSuite({ url: backend.url, profile: "ui5", record: true });
  const checks = report.results.map((r) => ({
    id: r.id,
    status: r.status,
    exchanges: (r.exchanges || []).map((x) => ({
      label: x.label,
      ...(x.malformed ? { malformed: true } : {}),
      request: { method: x.method, headers: pick(x.requestHeaders), body: x.request === undefined ? undefined : (typeof x.request === "string" ? parse(x.request) : x.request) },
      response: { status: x.response.status, headers: pick(x.response.headers), body: responseBody(x.response.text, x.response.headers) },
    })),
  }));
  write(dir, "suite.json", { source: "the backend suite's client (conformance/backend/lib/client.mjs)", backend: backend.version, counts: report.counts, checks });
  return report;
}

async function recordUi5Frontend(backend, dir) {
  const home = process.env.ABAP2UI5_HOME || path.resolve(ROOT, "../abap2UI5");
  const webapp = locateWebapp(home);
  if (!webapp) {
    process.stderr.write(`[record] ui5-frontend skipped - no abap2UI5 checkout at ${home} (ABAP2UI5_HOME)\n`);
    return;
  }
  const exchanges = [];
  const u = new URL(backend.url);
  const scenarios = [];
  const session = (search, hash = "") => createUi5Frontend({
    webapp, url: backend.url,
    location: { origin: u.origin, pathname: u.pathname, search, hash },
    record: (x) => exchanges.push({
      label: scenarios[scenarios.length - 1],
      request: { method: x.method, headers: pick(x.requestHeaders), body: parse(x.body) },
      response: { status: x.status, headers: pick(x.responseHeaders), body: responseBody(x.text, x.responseHeaders) },
    }),
  });
  const step = async (label, fn) => {
    scenarios.push(label);
    const r = await fn();
    if (!r) throw new Error(`ui5-frontend: ${label} failed`);
    return r;
  };

  let f = session("?app_start=Z2UI5_CL_CONF_BIND");
  await step("BIND: page load", () => f.start());
  await step("BIND: CHECK with a scalar, a structure and a table cell edited", () => f.fire("CHECK", [], {
    "/NAME": "Ada", "/S_ADDR/CITY": "Paris", "/T_ITEMS/1/TEXT": "zwei", "/T_ITEMS/1/DONE": true,
  }));
  await step("BIND: ADD_ROW", () => f.fire("ADD_ROW"));

  f = session("?app_start=Z2UI5_CL_CONF_ECHO");
  await step("ECHO: page load", () => f.start());
  const echoed = await step("ECHO: ECHO with arguments", () => f.fire("ECHO", ["alpha", 2, true, { k: "v" }]));
  await step("ECHO: NOOP", () => f.fire("NOOP"));
  await step("ECHO: restore via the app-state hash", () => f.restore(`#/z2ui5-xapp-state=${echoed.ID}`));

  f = session("?app_start=Z2UI5_CL_CONF_ROUTE");
  await step("ROUTE: page load", () => f.start());
  const counted = await step("ROUTE: COUNT", () => f.fire("COUNT"));
  await step("ROUTE: CALL", () => f.fire("CALL"));
  await step("ROUTE: browser Back to the route of the caller", () => f.restore(`#/app/Z2UI5_CL_CONF_ROUTE/${counted.ID}`));

  f = session("?app_start=Z2UI5_CL_CONF_SLOTS");
  await step("SLOTS: page load", () => f.start());
  await step("SLOTS: POPUP_OPEN", () => f.fire("POPUP_OPEN"));
  await step("SLOTS: POPOVER_OPEN", () => f.fire("POPOVER_OPEN"));

  const pkg = JSON.parse(fs.readFileSync(path.join(home, "package.json"), "utf8"));
  write(dir, "ui5-frontend.json", {
    source: `app/webapp/core/Server.js, Session.js, Lib.js of abap2UI5 ${pkg.version} (${path.basename(home)}), run in Node by scripts/lib/ui5-frontend.mjs - device values stubbed`,
    backend: backend.version,
    exchanges,
  });
}

async function recordAgentClient(backend, dir) {
  const home = process.env.MCP_SERVER_HOME || path.resolve(ROOT, "../mcp-server");
  const file = path.join(home, "lib", "appclient.mjs");
  if (!fs.existsSync(file)) {
    process.stderr.write(`[record] agent-client skipped - no mcp-server checkout at ${home} (MCP_SERVER_HOME)\n`);
    return;
  }
  const { createAppClient } = await import(pathToFileURL(file).href);
  const exchanges = [];
  const snapshots = [];
  let label = "";
  const fetchImpl = async (u, init) => {
    const res = await fetch(u, init);
    const text = await res.text();
    exchanges.push({
      label,
      request: { method: init.method, headers: pick(init.headers), body: parse(init.body) },
      response: { status: res.status, headers: pick(Object.fromEntries(res.headers.entries())), body: parse(text) },
    });
    return new Response(text, { status: res.status, headers: res.headers });
  };
  const client = createAppClient({ baseUrl: backend.url, fetchImpl, backendHint: "" });
  const snap = async (l, fn) => {
    label = l;
    const s = await fn();
    snapshots.push({ label: l, snapshot: s });
    return s;
  };
  let s = await snap("BIND: app_start", () => client.start("Z2UI5_CL_CONF_BIND"));
  s = await snap("BIND: act - fill NAME and a cell, fire CHECK", () => client.act(s.session, { values: { "/NAME": "Ada", "/T_ITEMS/1/TEXT": "zwei" }, event: "CHECK" }));
  s = await snap("MSG: app_start", () => client.start("Z2UI5_CL_CONF_MSG"));
  s = await snap("MSG: act - BOX_CONFIRM", () => client.act(s.session, { event: "BOX_CONFIRM" }));
  s = await snap("SLOTS: app_start", () => client.start("Z2UI5_CL_CONF_SLOTS"));
  s = await snap("SLOTS: act - POPUP_OPEN", () => client.act(s.session, { event: "POPUP_OPEN" }));
  s = await snap("NAV: app_start", () => client.start("Z2UI5_CL_CONF_NAV"));
  s = await snap("NAV: act - CALL", () => client.act(s.session, { event: "CALL" }));
  s = await snap("NAV: act - DONE", () => client.act(s.session, { event: "DONE" }));
  const pkg = JSON.parse(fs.readFileSync(path.join(home, "package.json"), "utf8"));
  write(dir, "agent-client.json", {
    source: `lib/appclient.mjs of ${pkg.name} ${pkg.version} (${path.basename(home)})`,
    backend: backend.version,
    exchanges,
    snapshots,
  });
}

async function main() {
  const name = process.argv[2];
  const backend = await startBackend(name);
  const dir = path.join(ROOT, "traffic", name);
  try {
    const report = await recordSuite(backend, dir);
    await recordUi5Frontend(backend, dir);
    await recordAgentClient(backend, dir);
    process.stderr.write(`[record] ${name}: suite ${report.counts.pass} passed, ${report.counts.fail} failed, ${report.counts.warn} warning(s)\n`);
  } finally {
    await backend.close();
  }
}

main().then(() => process.exit(0), (e) => {
  process.stderr.write(`${e.stack || e}\n`);
  process.exit(1);
});
