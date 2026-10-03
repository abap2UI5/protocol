/*
 * The scripted backend the frontend suite plays: one HTTP server, one
 * endpoint per check ("run"), answering the frontend's roundtrips from a
 * script the check writes - recorded responses from traffic/ or synthetic
 * ones - and recording every request it receives.
 *
 *   const mock = await startMock({ statics });
 *   const run = mock.run();            // a fresh endpoint: run.url
 *   run.reply({ body: response });     // the answer to the next POST
 *   ... the frontend posts ...
 *   run.posts()                        // what it sent
 *
 * Every run has an endpoint path of its own, so a request a page of an
 * earlier check still sends (a timer, a retry) never lands in the script of
 * the next one: it is answered 410 and counted as stray.
 *
 * A POST nothing was scripted for is answered 500 `conformance mock: no
 * scripted response` and recorded as unexpected - the runner fails a check
 * whose frontend sent more than the script expected (spec/transport.md,
 * "Client behaviour": a frontend does not retry a 500 by itself).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".properties": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

export const ENDPOINT_TAIL = "/sap/bc/z2ui5";

const lower = (headers) => Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v]));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** A scripted reply: { status, headers, body (object -> JSON, string -> text), delayMs }. */
function normalizeReply(r) {
  const out = { status: 200, headers: {}, delayMs: 0, ...r };
  out.headers = lower(out.headers || {});
  if (out.body !== undefined && typeof out.body !== "string") {
    out.text = JSON.stringify(out.body);
    if (!out.headers["content-type"]) out.headers["content-type"] = "application/json; charset=utf-8";
  } else {
    out.text = out.body === undefined ? "" : out.body;
    if (!out.headers["content-type"] && out.text) out.headers["content-type"] = "text/plain; charset=utf-8";
  }
  if (out.headers["cache-control"] === undefined) out.headers["cache-control"] = "no-cache, no-store, must-revalidate";
  return out;
}

class Run {
  constructor(mock, index) {
    this.mock = mock;
    this.index = index;
    this.path = `/run/${index}${ENDPOINT_TAIL}`;
    this.url = `${mock.origin}${this.path}`;
    this.requests = [];
    this.unexpected = [];
    this.script = [];
    this.csrf = null;
    this.inflight = 0;
    this.closed = false;
    this.page = null;
    this._waiters = [];
  }

  /** Queue the answer to the next POST. */
  reply(r) {
    this.script.push({ reply: normalizeReply(r) });
    return this;
  }

  /** Queue an answer that is held back until release() - for "while a
   *  roundtrip is in flight" scenarios. `received` resolves with the request. */
  replyHeld(r) {
    let release;
    let received;
    const gate = new Promise((res) => { release = res; });
    const got = new Promise((res) => { received = res; });
    this.script.push({ reply: normalizeReply(r), gate, onReceive: received });
    return { received: got, release: () => release() };
  }

  /** A CSRF token layer in front of the endpoint: a POST without
   *  `X-CSRF-Token: <token>` is refused 403 + `X-CSRF-Token: Required`, a
   *  HEAD with `X-CSRF-Token: Fetch` answers the token. `final`: refuse with
   *  a plain 403 (no Required) instead - the backend's own gate. */
  requireCsrf(token, { final = false } = {}) {
    this.csrf = { token, final };
    return this;
  }

  posts() {
    return this.requests.filter((r) => r.method === "POST");
  }

  heads() {
    return this.requests.filter((r) => r.method === "HEAD");
  }

  /** Resolves once `n` POSTs arrived (rejects after `ms`). */
  waitPosts(n, ms = 10_000) {
    if (this.posts().length >= n) return Promise.resolve(this.posts());
    return new Promise((resolve, reject) => {
      const w = { n, resolve, timer: null };
      w.timer = setTimeout(() => {
        this._waiters = this._waiters.filter((x) => x !== w);
        reject(new Error(`expected ${n} roundtrip POST(s) within ${ms} ms, got ${this.posts().length}`));
      }, ms);
      w.timer.unref?.();
      this._waiters.push(w);
    });
  }

  /** Scripted replies not consumed yet. */
  pending() {
    return this.script.length;
  }

  _notify() {
    const count = this.posts().length;
    for (const w of [...this._waiters]) {
      if (count >= w.n) {
        clearTimeout(w.timer);
        this._waiters = this._waiters.filter((x) => x !== w);
        w.resolve(this.posts());
      }
    }
  }

  async handle(req, res, record) {
    const method = req.method;
    if (method === "GET") {
      if (!this.page) return send(res, { status: 404, text: "no page" });
      const html = await this.page(this, record);
      return send(res, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, text: html });
    }
    if (method === "HEAD") {
      this.requests.push(record);
      const h = record.headers;
      if (this.csrf && !this.csrf.final && String(h["x-csrf-token"] || "").toLowerCase() === "fetch") {
        return send(res, { status: 200, headers: { "x-csrf-token": this.csrf.token }, text: "" });
      }
      return send(res, { status: 200, text: "" });
    }
    if (method !== "POST") return send(res, { status: 405, text: "Method Not Allowed" });
    this.requests.push(record);
    this._notify();
    if (this.csrf && record.headers["x-csrf-token"] !== this.csrf.token) {
      record.refusedCsrf = true;
      const headers = this.csrf.final ? {} : { "x-csrf-token": "Required" };
      return send(res, { status: 403, headers: { "content-type": "text/plain", ...headers }, text: "CSRF token validation failed" });
    }
    const step = this.script.shift();
    if (!step) {
      record.unexpected = true;
      this.unexpected.push(record);
      return send(res, { status: 500, text: "conformance mock: no scripted response for this request" });
    }
    record.reply = step.reply;
    this.inflight += 1;
    try {
      if (step.onReceive) step.onReceive(record);
      if (step.gate) await step.gate;
      if (step.reply.delayMs) await new Promise((r) => setTimeout(r, step.reply.delayMs));
      record.answeredAt = Date.now();
      return send(res, step.reply);
    } finally {
      this.inflight -= 1;
    }
  }
}

function send(res, { status, headers = {}, text = "" }) {
  if (res.headersSent || res.destroyed) return undefined;
  res.writeHead(status, headers);
  res.end(text);
  return undefined;
}

/**
 * Start the mock.
 *   statics  [{ prefix: "/resources/", roots: [dir...], maxAge? }] - static trees
 *   routes   { "/path": (req, res) => {} } - extra handlers
 * Resolves { origin, run(), close(), stray }.
 */
export async function startMock({ host = "127.0.0.1", port = 0, statics = [], routes = {} } = {}) {
  const runs = new Map();
  const stray = [];
  let next = 0;
  const mock = { origin: "", stray, runs };

  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://x");
      if (routes[u.pathname]) return routes[u.pathname](req, res);
      const m = /^\/run\/(\d+)(\/.*)$/.exec(u.pathname);
      if (m) {
        const run = runs.get(Number(m[1]));
        const text = req.method === "GET" || req.method === "HEAD" ? "" : await readBody(req);
        const record = {
          method: req.method,
          path: u.pathname,
          search: u.search,
          headers: lower(req.headers),
          text,
          json: undefined,
          at: Date.now(),
        };
        try {
          record.json = text ? JSON.parse(text) : undefined;
        } catch {
          record.json = undefined;
        }
        if (!run || run.closed || m[2] !== ENDPOINT_TAIL) {
          stray.push(record);
          return send(res, { status: 410, text: "conformance mock: this run is over" });
        }
        return await run.handle(req, res, record);
      }
      for (const s of statics) {
        if (!u.pathname.startsWith(s.prefix)) continue;
        const rel = decodeURIComponent(u.pathname.slice(s.prefix.length));
        for (const root of s.roots) {
          const full = path.resolve(root, rel);
          if (!full.startsWith(path.resolve(root) + path.sep)) continue;
          let stat;
          try {
            stat = fs.statSync(full);
          } catch {
            continue;
          }
          if (!stat.isFile()) continue;
          res.writeHead(200, {
            "content-type": MIME[path.extname(full)] || "application/octet-stream",
            "cache-control": s.maxAge ? `public, max-age=${s.maxAge}` : "no-cache",
          });
          if (req.method === "HEAD") return res.end();
          return fs.createReadStream(full).pipe(res);
        }
        if (s.fallback) {
          const r = s.fallback(rel);
          if (r) return send(res, r);
        }
        return send(res, { status: 404, text: "not found" });
      }
      return send(res, { status: 404, text: "not found" });
    } catch (e) {
      return send(res, { status: 500, text: `conformance mock: ${e && e.message}` });
    }
  });
  server.keepAliveTimeout = 1000;
  await new Promise((resolve) => server.listen(port, host, resolve));
  mock.origin = `http://${host}:${server.address().port}`;
  mock.run = () => {
    for (const r of runs.values()) r.closed = true;
    next += 1;
    const run = new Run(mock, next);
    runs.set(next, run);
    return run;
  };
  mock.addStatic = (s) => statics.push(s);
  mock.close = () => new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
  return mock;
}
