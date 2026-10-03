/*
 * The backend suite's runner: plays the frontend against one backend over
 * HTTP, check by check, and reports every check as pass, fail (a MUST that
 * does not hold), warn (a SHOULD that does not hold) or skip.
 *
 * Every 2xx JSON response a check receives is validated against
 * schema/response.schema.json, and every well-formed request the suite sends
 * against schema/request.schema.json - a check whose traffic does not match
 * fails even if its own assertions held.
 */
import { ProtocolClient } from "./client.mjs";
import { validate, formatErrors } from "./schema.mjs";
import { ALL_CHECKS } from "./checks/index.mjs";

export const DEFAULT_APPS = Object.freeze({
  ECHO: "Z2UI5_CL_CONF_ECHO",
  BIND: "Z2UI5_CL_CONF_BIND",
  MSG: "Z2UI5_CL_CONF_MSG",
  SLOTS: "Z2UI5_CL_CONF_SLOTS",
  NAV: "Z2UI5_CL_CONF_NAV",
  NAV_TGT: "Z2UI5_CL_CONF_NAV_TGT",
  ROUTE: "Z2UI5_CL_CONF_ROUTE",
  ERROR: "Z2UI5_CL_CONF_ERROR",
  ACTIONS: "Z2UI5_CL_CONF_ACTIONS",
});

export const PROFILES = Object.freeze({ core: ["core"], ui5: ["core", "ui5"] });

export class CheckFailure extends Error {
  constructor(message) {
    super(message);
    this.name = "CheckFailure";
  }
}

class Skip extends Error {
  constructor(message) {
    super(message);
    this.name = "Skip";
  }
}

/** JSON with object keys sorted - key order carries no meaning on the wire. */
export function canonical(v) {
  return JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]]))
    : x));
}

const short = (v, n = 300) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? String(v) : (s.length > n ? `${s.slice(0, n)}...` : s);
};

/** The assertion helpers a check receives (besides the client). */
function makeContext(client, apps) {
  const t = {
    client,
    apps,
    fail(message) {
      throw new CheckFailure(message);
    },
    skip(reason) {
      throw new Skip(reason);
    },
    ok(cond, message) {
      if (!cond) throw new CheckFailure(message);
    },
    equal(actual, expected, what) {
      if (actual !== expected) throw new CheckFailure(`${what}: expected ${short(expected)}, got ${short(actual)}`);
    },
    deepEqual(actual, expected, what) {
      if (canonical(actual) !== canonical(expected)) {
        throw new CheckFailure(`${what}: expected ${short(expected)}, got ${short(actual)}`);
      }
    },
    /** A response that must be a 2xx roundtrip answer with S_FRONT. */
    roundtrip(r, what) {
      if (!(r.status >= 200 && r.status < 300)) {
        throw new CheckFailure(`${what}: expected a 2xx roundtrip answer, got HTTP ${r.status}: ${short(r.text, 200)}`);
      }
      if (!r.json || !r.json.S_FRONT) throw new CheckFailure(`${what}: the answer is no roundtrip response: ${short(r.text, 200)}`);
      return r;
    },
    /** Start `appKey` (a key of apps) and require a roundtrip answer. */
    async start(appKey, opts = {}) {
      return t.roundtrip(await client.start(apps[appKey] || appKey, opts), `start ${apps[appKey] || appKey}`);
    },
    async event(r, event, opts = {}) {
      const id = r.json.S_FRONT.ID;
      return t.roundtrip(await client.event(id, event, opts), `event ${event}`);
    },
  };
  return t;
}

/**
 * Run the backend suite.
 *   url        the roundtrip endpoint
 *   profile    "core" (default) or "ui5"
 *   headers    extra request headers (authentication)
 *   apps       overrides of the conformance app class names (DEFAULT_APPS keys)
 *   only       a filter: a check runs when its id contains one of these strings
 *   onResult   called with each result as it is known
 *   record     true: every result carries its full traffic as `exchanges`
 * Resolves { profile, url, results, counts, ok }.
 */
export async function runBackendSuite({
  url, profile = "core", headers = {}, apps = {}, only, fetch: fetchImpl, timeoutMs, onResult = () => {},
  checks = ALL_CHECKS, record = false,
} = {}) {
  if (!PROFILES[profile]) throw new Error(`unknown profile "${profile}" - core or ui5`);
  const names = { ...DEFAULT_APPS, ...apps };
  const profiles = PROFILES[profile];
  const filters = only ? [].concat(only) : null;
  const results = [];
  for (const check of checks) {
    const base = { id: check.id, title: check.title, level: check.level, profile: check.profile, spec: check.spec };
    if (filters && !filters.some((f) => check.id.includes(f))) continue;
    if (!profiles.includes(check.profile)) {
      const r = { ...base, status: "skip", message: `profile ${check.profile} not requested` };
      results.push(r);
      onResult(r);
      continue;
    }
    const client = new ProtocolClient({ url, headers, fetch: fetchImpl, timeoutMs });
    const t = makeContext(client, names);
    const started = Date.now();
    let status = "pass";
    let message = "";
    try {
      await check.run(t);
      const bad = schemaProblems(client.exchanges);
      if (bad) {
        status = "fail";
        message = bad;
      }
    } catch (e) {
      if (e instanceof Skip) {
        status = "skip";
        message = e.message;
      } else if (e instanceof CheckFailure) {
        status = check.level === "MUST" ? "fail" : "warn";
        message = e.message;
      } else {
        status = check.level === "MUST" ? "fail" : "warn";
        message = `${e && e.name ? e.name : "Error"}: ${(e && e.message) || e}`;
      }
    }
    const r = { ...base, status, message, ms: Date.now() - started, roundtrips: client.exchanges.length };
    if (status === "fail" || status === "warn") r.traffic = client.exchanges.slice(-3).map(trafficSummary);
    if (record) r.exchanges = client.exchanges;
    results.push(r);
    onResult(r);
  }
  const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const r of results) counts[r.status] += 1;
  return { url, profile, results, counts, ok: counts.fail === 0 };
}

function trafficSummary(x) {
  return {
    label: x.label,
    method: x.method,
    request: x.request === undefined ? undefined : short(x.request, 400),
    status: x.response.status,
    response: short(x.response.text, 400),
  };
}

/** The first schema problem in a check's traffic, or "". */
function schemaProblems(exchanges) {
  for (const x of exchanges) {
    if (x.method !== "POST") continue;
    if (x.request && typeof x.request === "object" && !x.malformed) {
      const req = validate("request", x.request);
      if (!req.valid) return `the suite's own request (${x.label}) does not match schema/request.schema.json: ${formatErrors(req.errors)}`;
    }
    const res = x.response;
    if (res.status >= 200 && res.status < 300 && res.json !== undefined) {
      const v = validate("response", res.json);
      if (!v.valid) return `response to "${x.label}" does not match schema/response.schema.json: ${formatErrors(v.errors)}`;
    }
  }
  return "";
}
