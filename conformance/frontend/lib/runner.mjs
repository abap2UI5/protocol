/*
 * The frontend suite's runner: plays the backend for one frontend (through
 * its adapter), check by check, and reports every check as pass, fail (a
 * MUST that does not hold), warn (a SHOULD that does not hold) or skip (the
 * check is outside the requested profile, needs a capability the adapter
 * does not have, or asked for an interaction the frontend cannot perform).
 *
 * Every POST the scripted backend receives is validated against
 * schema/request.schema.json; a check whose frontend sent a body that does
 * not match fails even if its own assertions held. A POST nothing was
 * scripted for fails the check as well (the script says what a conforming
 * frontend sends - one more is a retry, a duplicate or a stray event).
 */
import { validate, formatErrors } from "../../backend/lib/schema.mjs";
import { canonical } from "../../backend/lib/runner.mjs";
import { Unsupported } from "../adapters/base.mjs";
import { createAdapter } from "../adapters/index.mjs";
import { ALL_FRONTEND_CHECKS } from "./checks/index.mjs";
import { startMock } from "./mock.mjs";

/** Which check profiles a requested profile runs. */
export const FRONTEND_PROFILES = Object.freeze({
  core: ["core"],
  portable: ["core", "portable"],
  ui5: ["core", "portable", "ui5"],
  semantic: ["core", "semantic"],
});

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

const short = (v, n = 300) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? String(v) : (s.length > n ? `${s.slice(0, n)}...` : s);
};

/** The payload of a recorded POST: the envelope's value, or the bare body. */
export const payloadOf = (record) => {
  const j = record && record.json;
  if (j && typeof j === "object" && !Array.isArray(j) && "value" in j && Object.keys(j).length === 1) return j.value || {};
  return j || {};
};

function makeContext(adapter, run) {
  const t = {
    adapter,
    mock: run,
    caps: adapter.capabilities,
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
      if (canonical(actual) !== canonical(expected)) throw new CheckFailure(`${what}: expected ${short(expected)}, got ${short(actual)}`);
    },
    includes(text, part, what) {
      if (!String(text || "").includes(part)) throw new CheckFailure(`${what}: expected it to contain ${short(part)}, got ${short(text)}`);
    },
    needs(...caps) {
      for (const c of caps) if (!adapter.capabilities.has(c)) throw new Skip(`the ${adapter.name} adapter has no capability "${c}"`);
    },
    /** The i-th POST's payload (envelope removed); negative counts from the end. */
    post(i) {
      const posts = run.posts();
      const r = posts[i < 0 ? posts.length + i : i];
      if (!r) throw new CheckFailure(`expected roundtrip POST #${i + 1}, the frontend sent ${posts.length}`);
      return payloadOf(r);
    },
    front(i) {
      return t.post(i).S_FRONT || {};
    },
    posts: () => run.posts(),
    count: () => run.posts().length,
    async start(app, opts = {}) {
      await adapter.start(run, { app, ...opts });
      return adapter.state();
    },
    async fill(target, value) {
      await adapter.fill(target, value);
    },
    async press(target, opts) {
      await adapter.press(target, opts);
    },
    async closeBox(action) {
      if (!adapter.closeBox) throw new Unsupported("no closeBox");
      await adapter.closeBox(action);
    },
    async back() {
      await adapter.back();
    },
    async setModel(p, value, slot) {
      t.needs("modelEdit");
      await adapter.setModel(p, value, slot);
    },
    async settle() {
      await adapter.settle();
    },
    state: () => adapter.state(),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    /** Wait until `n` POSTs arrived. */
    async posted(n, ms = 10_000) {
      try {
        await run.waitPosts(n, ms);
      } catch (e) {
        throw new CheckFailure(e.message);
      }
    },
  };
  return t;
}

/** The first problem with what the frontend sent in a check, or "". */
function trafficProblems(run, check) {
  for (const r of run.posts()) {
    if (r.json === undefined) return `a roundtrip POST is not JSON: ${short(r.text, 200)}`;
    const v = validate("request", r.json);
    if (!v.valid) return `a roundtrip POST does not match schema/request.schema.json: ${formatErrors(v.errors)} - ${short(r.text, 300)}`;
  }
  if (!check.allowUnexpected && run.unexpected.length) {
    const r = run.unexpected[0];
    return `the frontend sent ${run.unexpected.length} roundtrip POST(s) more than the script expected, first: ${short(r.text, 300)}`;
  }
  return "";
}

function trafficSummary(run) {
  return run.requests.slice(-4).map((r) => ({
    method: r.method,
    headers: Object.fromEntries(Object.entries(r.headers).filter(([k]) => /^(content-type|sap-contextid|sap-contextid-accept|x-csrf-token)$/.test(k))),
    request: r.text ? short(r.text, 400) : undefined,
    status: r.reply ? r.reply.status : (r.unexpected ? 500 : undefined),
  }));
}

/**
 * Run the frontend suite.
 *   adapter    "ui5" | "agent" | "webcomponent" | "headless" | an adapter object
 *   adapterOptions  passed to the adapter factory
 *   profile    core | portable | ui5 | semantic (default: the adapter's widest)
 *   only       a filter: a check runs when its id contains one of these strings
 *   onResult   called with each result as it is known
 * Resolves { adapter, version, profile, results, counts, ok }.
 */
export async function runFrontendSuite({
  adapter: which = "ui5", adapterOptions = {}, profile, only, onResult = () => {}, checks = ALL_FRONTEND_CHECKS,
} = {}) {
  const adapter = typeof which === "string" ? await createAdapter(which, adapterOptions) : which;
  const widest = ["ui5", "portable", "semantic", "core"].find((p) => adapter.profiles.includes(p)) || "core";
  const prof = profile || widest;
  if (!FRONTEND_PROFILES[prof]) throw new Error(`unknown profile "${prof}" - core, portable, ui5 or semantic`);
  const profiles = FRONTEND_PROFILES[prof];
  const filters = only ? [].concat(only) : null;
  const mock = await startMock();
  const results = [];
  const push = (r) => {
    results.push(r);
    onResult(r);
  };
  let openError = null;
  try {
    try {
      await adapter.open({ mock });
    } catch (e) {
      openError = e;
    }
    for (const check of checks) {
      const base = { id: check.id, title: check.title, level: check.level, profile: check.profile, spec: check.spec };
      if (filters && !filters.some((f) => check.id.includes(f))) continue;
      if (!profiles.includes(check.profile)) {
        push({ ...base, status: "skip", message: `profile ${check.profile} not requested` });
        continue;
      }
      if (openError) {
        push({ ...base, status: "skip", message: `adapter ${adapter.name} could not start: ${openError.message}` });
        continue;
      }
      const missing = (check.needs || []).filter((c) => !adapter.capabilities.has(c));
      if (missing.length) {
        push({ ...base, status: "skip", message: `the ${adapter.name} adapter has no capability "${missing.join('", "')}"` });
        continue;
      }
      const run = mock.run();
      const t = makeContext(adapter, run);
      const started = Date.now();
      let status = "pass";
      let message = "";
      try {
        await check.run(t);
        const bad = trafficProblems(run, check);
        if (bad) {
          status = "fail";
          message = bad;
        }
      } catch (e) {
        if (e instanceof Skip || e instanceof Unsupported) {
          status = "skip";
          message = e.message;
        } else {
          status = check.level === "MUST" ? "fail" : "warn";
          message = e instanceof CheckFailure ? e.message : `${e && e.name ? e.name : "Error"}: ${(e && e.message) || e}`;
        }
      }
      try {
        await adapter.stop();
      } catch { /* the next check starts fresh anyway */ }
      const r = { ...base, status, message, ms: Date.now() - started, roundtrips: run.posts().length };
      if (status === "fail" || status === "warn") r.traffic = trafficSummary(run);
      push(r);
    }
  } finally {
    try {
      await adapter.close();
    } finally {
      await mock.close();
    }
  }
  const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const r of results) counts[r.status] += 1;
  return {
    adapter: adapter.name,
    version: adapter.version || "",
    description: adapter.description || "",
    profile: prof,
    url: `frontend:${adapter.name}`,
    results,
    counts,
    ok: counts.fail === 0 && !openError,
    ...(openError ? { error: openError.message } : {}),
  };
}
