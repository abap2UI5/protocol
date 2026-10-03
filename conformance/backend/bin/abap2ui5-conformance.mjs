#!/usr/bin/env node
/*
 * abap2ui5-conformance - run a conformance suite of the abap2UI5 protocol.
 *
 *   abap2ui5-conformance backend --url <endpoint> [--profile core|ui5]
 *                                [--header "Name: value"]... [--only <id part>]...
 *                                [--app KEY=CLASS]... [--json] [--verbose]
 *
 * Exit code 0: no MUST check failed. 1: at least one did. 2: usage error.
 */
import { runBackendSuite, DEFAULT_APPS } from "../index.mjs";
import { formatResult, formatSummary } from "../lib/report.mjs";

const USAGE = `usage: abap2ui5-conformance backend --url <endpoint> [options]

  --url <endpoint>        the roundtrip endpoint (the URL the page is served from)
  --profile core|ui5      core (default): the core protocol; ui5: plus the UI5 profile
  --header "Name: value"  an extra request header, e.g. Authorization (repeatable)
  --only <id part>        run only the checks whose id contains it (repeatable)
  --app KEY=CLASS         use another class for a conformance app (${Object.keys(DEFAULT_APPS).join(", ")})
  --json                  print the report as JSON
  --verbose               show skipped checks' reasons and the traffic of failures

The backend has to serve the conformance apps - conformance/apps/README.md.
The frontend suite is not implemented yet (conformance/frontend/README.md).`;

function parse(argv) {
  const o = { headers: {}, only: [], apps: {}, profile: "core", json: false, verbose: false };
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
  if (o.command === "frontend") {
    process.stderr.write("the frontend suite is not implemented yet - see conformance/frontend/README.md\n");
    return 2;
  }
  if (o.command !== "backend") {
    process.stderr.write(`unknown suite "${o.command}"\n\n${USAGE}\n`);
    return 2;
  }
  if (!o.url) {
    process.stderr.write(`--url is required\n\n${USAGE}\n`);
    return 2;
  }
  const report = await runBackendSuite({
    url: o.url, profile: o.profile, headers: o.headers, apps: o.apps, only: o.only.length ? o.only : undefined,
    onResult: o.json ? undefined : (r) => {
      if (r.status !== "skip" || o.verbose) process.stdout.write(`${formatResult(r, { verbose: o.verbose })}\n`);
    },
  });
  if (o.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`\n${formatSummary(report)}\n`);
  return report.ok ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }, (e) => {
  process.stderr.write(`${e.stack || e}\n`);
  process.exitCode = 2;
});
