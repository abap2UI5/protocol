#!/usr/bin/env node
/*
 * abap2ui5-conformance - run a conformance suite of the abap2UI5 protocol.
 *
 *   abap2ui5-conformance backend --url <endpoint> [--profile core|ui5]
 *                                [--header "Name: value"]... [--only <id part>]...
 *                                [--app KEY=CLASS]... [--json] [--verbose]
 *   abap2ui5-conformance frontend --adapter ui5|agent|webcomponent|adaptive-cards|headless
 *                                [--profile core|portable|ui5|semantic]
 *                                [--only <id part>]... [--json] [--verbose]
 *
 * Exit code 0: no MUST check failed. 1: at least one did. 2: usage error, or
 * the frontend adapter could not start.
 */
import { runBackendSuite, DEFAULT_APPS } from "../index.mjs";
import { formatResult, formatSummary } from "../lib/report.mjs";

const USAGE = `usage: abap2ui5-conformance backend --url <endpoint> [options]
       abap2ui5-conformance frontend --adapter <name> [options]

backend - plays the frontend against a backend:

  --url <endpoint>        the roundtrip endpoint (the URL the page is served from)
  --profile core|ui5      core (default): the core protocol; ui5: plus the UI5 profile
  --header "Name: value"  an extra request header, e.g. Authorization (repeatable)
  --only <id part>        run only the checks whose id contains it (repeatable)
  --app KEY=CLASS         use another class for a conformance app (${Object.keys(DEFAULT_APPS).join(", ")})
  --json                  print the report as JSON
  --verbose               show skipped checks' reasons and the traffic of failures

The backend has to serve the conformance apps - conformance/apps/README.md.

frontend - plays the backend (a scripted server) for a frontend:
  --adapter <name>        ui5 (the UI5 SPA in Chromium), agent (mcp-server's agent
                          client), webcomponent (frontend-webcomponent),
                          adaptive-cards (the Adaptive Cards renderer of this
                          package, in process), headless (stub)
  --profile <profile>     core | portable | ui5 | semantic (default: the adapter's widest)
  --only, --json, --verbose  as above

The ui5 adapter needs an abap2UI5 checkout (ABAP2UI5_HOME) and a Chromium;
see conformance/frontend/README.md.`;

function parse(argv) {
  const o = { headers: {}, only: [], apps: {}, profile: undefined, json: false, verbose: false };
  const [command, ...rest] = argv;
  o.command = command;
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    const next = () => {
      if (i + 1 >= rest.length) throw new Error(`${a} needs a value`);
      i += 1;
      return rest[i];
    };
    if (a === "--url") o.url = next();
    else if (a === "--adapter") o.adapter = next();
    else if (a === "--profile") o.profile = next();
    else if (a === "--header") {
      const h = next();
      const at = h.indexOf(":");
      if (at <= 0) throw new Error(`--header "${h}": expected "Name: value"`);
      o.headers[h.slice(0, at).trim()] = h.slice(at + 1).trim();
    } else if (a === "--only") o.only.push(next());
    else if (a === "--app") {
      const [k, v] = next().split("=");
      if (!k || !v || !(k in DEFAULT_APPS)) throw new Error(`--app ${k}=${v}: KEY is one of ${Object.keys(DEFAULT_APPS).join(", ")}`);
      o.apps[k] = v;
    } else if (a === "--json") o.json = true;
    else if (a === "--verbose") o.verbose = true;
    else if (a === "--help" || a === "-h") o.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

async function main() {
  if (process.argv.slice(2).some((a) => a === "--help" || a === "-h")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  let o;
  try {
    o = parse(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (o.help || !o.command) {
    process.stdout.write(`${USAGE}\n`);
    return o.help ? 0 : 2;
  }
  if (o.command === "frontend") return frontend(o);
  if (o.command !== "backend") {
    process.stderr.write(`unknown suite "${o.command}"\n\n${USAGE}\n`);
    return 2;
  }
  if (!o.url) {
    process.stderr.write(`--url is required\n\n${USAGE}\n`);
    return 2;
  }
  const report = await runBackendSuite({
    url: o.url, profile: o.profile || "core", headers: o.headers, apps: o.apps, only: o.only.length ? o.only : undefined,
    onResult: o.json ? undefined : (r) => {
      if (r.status !== "skip" || o.verbose) process.stdout.write(`${formatResult(r, { verbose: o.verbose })}\n`);
    },
  });
  if (o.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`\n${formatSummary(report)}\n`);
  return report.ok ? 0 : 1;
}

async function frontend(o) {
  const { runFrontendSuite, ADAPTERS } = await import("../../frontend/index.mjs");
  if (!o.adapter || !ADAPTERS[o.adapter]) {
    process.stderr.write(`--adapter is one of ${Object.keys(ADAPTERS).join(", ")}\n\n${USAGE}\n`);
    return 2;
  }
  const report = await runFrontendSuite({
    adapter: o.adapter, profile: o.profile,
    only: o.only.length ? o.only : undefined,
    onResult: o.json ? undefined : (r) => {
      if (r.status !== "skip" || o.verbose) process.stdout.write(`${formatResult(r, { verbose: o.verbose })}\n`);
    },
  });
  if (o.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    if (report.error) process.stdout.write(`\nthe ${report.adapter} adapter could not start: ${report.error}\n`);
    process.stdout.write(`\n${formatSummary({ ...report, url: `${report.adapter} - ${report.version || report.description}` })}\n`);
  }
  if (report.error) return 2;
  return report.ok ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }, (e) => {
  process.stderr.write(`${e.stack || e}\n`);
  process.exitCode = 2;
});
