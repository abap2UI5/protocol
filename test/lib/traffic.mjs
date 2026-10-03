// Helpers over the recorded traffic in traffic/<backend>/*.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TRAFFIC = path.join(ROOT, "traffic");

export const backends = () => (fs.existsSync(TRAFFIC) ? fs.readdirSync(TRAFFIC).filter((d) => fs.statSync(path.join(TRAFFIC, d)).isDirectory()) : []);

export function load(backend, file) {
  const p = path.join(TRAFFIC, backend, file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

/** Every recorded exchange of a backend: { source, label, malformed?, request, response }. */
export function exchanges(backend) {
  const out = [];
  const suite = load(backend, "suite.json");
  for (const c of (suite && suite.checks) || []) {
    for (const x of c.exchanges) out.push({ source: `suite ${c.id}`, ...x });
  }
  for (const f of ["ui5-frontend.json", "agent-client.json"]) {
    const d = load(backend, f);
    for (const x of (d && d.exchanges) || []) out.push({ source: f, ...x });
  }
  return out;
}

/** Draft ids (32 upper-case hex) replaced by <ID1>, <ID2>, ... in order of appearance. */
export function normalizeIds(value) {
  const seen = new Map();
  const text = JSON.stringify(value);
  return JSON.parse(text.replace(/\b[0-9A-F]{32}\b/g, (m) => {
    if (!seen.has(m)) seen.set(m, `<ID${seen.size + 1}>`);
    return seen.get(m);
  }));
}

/** What a check's traffic looks like with the backend-specific parts taken out:
 *  per exchange the status, the media type, and - for a JSON response - the body. */
export function comparable(check) {
  return normalizeIds(check.exchanges.map((x) => ({
    label: x.label,
    status: x.response.status,
    type: String(x.response.headers["content-type"] || "").split(";")[0].trim().toLowerCase(),
    body: typeof x.response.body === "object" ? x.response.body : undefined,
  })));
}
