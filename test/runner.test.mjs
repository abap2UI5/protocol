// The runner and the CLI without a backend: results are classified by level,
// schema problems in a check's traffic fail it, profiles filter, and the CLI
// says how to use it.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { runBackendSuite, ALL_CHECKS, ProtocolClient, displays, routerOptions, canonical } from "../conformance/backend/index.mjs";
import { ROOT } from "./lib/traffic.mjs";

const answer = (body, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), {
  status, headers: { "content-type": typeof body === "string" ? "text/plain" : "application/json" },
});
const OK = { S_FRONT: { ID: "A".repeat(32), APP: "Z2UI5_CL_CONF_ECHO", PROTOCOL: 2 } };

test("pass, fail, warn and skip are told apart by level and profile", async () => {
  const checks = [
    { id: "x.pass", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => t.ok(true, "") },
    { id: "x.fail", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => t.fail("broken") },
    { id: "x.warn", title: "", level: "SHOULD", profile: "core", spec: "", run: async (t) => t.equal(1, 2, "one") },
    { id: "x.skip", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => t.skip("not here") },
    { id: "x.ui5", title: "", level: "MUST", profile: "ui5", spec: "", run: async (t) => t.fail("never") },
  ];
  const r = await runBackendSuite({ url: "http://localhost/", checks });
  assert.deepEqual(r.results.map((x) => x.status), ["pass", "fail", "warn", "skip", "skip"]);
  assert.deepEqual(r.counts, { pass: 1, fail: 1, warn: 1, skip: 2 });
  assert.equal(r.ok, false);
  assert.match(r.results[2].message, /one: expected 2, got 1/);
});

test("a response that does not match the schema fails the check even when its assertions held", async () => {
  const checks = [{ id: "x.schema", title: "", level: "MUST", profile: "core", spec: "", run: async (t) => { await t.client.start("Z"); } }];
  const fetch = async () => answer({ S_FRONT: { ID: "X", APP: "Z" } });
  const r = await runBackendSuite({ url: "http://localhost/", checks, fetch });
  assert.equal(r.results[0].status, "fail");
  assert.match(r.results[0].message, /PROTOCOL/);
});

test("the client sends what the UI5 frontend sends", async () => {
  const seen = [];
  const fetch = async (url, init) => { seen.push({ url, init }); return answer(OK); };
  const c = new ProtocolClient({ url: "http://host:1/sap/bc/z2ui5?sap-client=001", fetch, headers: { authorization: "Basic x" } });
  await c.start("Z2UI5_CL_CONF_ECHO");
  await c.event("ID1", "SAVE", { args: ["a"], model: { NAME: "x" } });
  assert.deepEqual(JSON.parse(seen[0].init.body), { value: { S_FRONT: { ORIGIN: "http://host:1", PATHNAME: "/sap/bc/z2ui5", SEARCH: "?app_start=Z2UI5_CL_CONF_ECHO" } } });
  assert.deepEqual(JSON.parse(seen[1].init.body), { value: { S_FRONT: { ID: "ID1", EVENT: "SAVE", T_EVENT_ARG: ["a"] }, MODEL: { NAME: "x" } } });
  assert.equal(seen[1].init.headers["content-type"], "application/json");
  assert.equal(seen[1].init.headers["sap-contextid-accept"], "header");
  assert.equal(seen[1].init.headers.authorization, "Basic x");
});

test("response readers", () => {
  const r = { json: { S_FRONT: { S_ACTION: { T_SYSTEM: [["VIEW_SLOTS", "display", "MAIN", "<v/>"], ["ROUTER", "sync", { setNavRouting: "KEEP" }]] } } } };
  assert.equal(displays(r).length, 1);
  assert.deepEqual(routerOptions(r), { setNavRouting: "KEEP" });
  assert.equal(canonical({ b: 1, a: [{ d: 1, c: 2 }] }), '{"a":[{"c":2,"d":1}],"b":1}');
});

test("the suite has core and ui5 checks, MUST and SHOULD", () => {
  assert.ok(ALL_CHECKS.length >= 70, `${ALL_CHECKS.length}`);
  assert.ok(ALL_CHECKS.some((c) => c.profile === "ui5"));
  assert.ok(ALL_CHECKS.some((c) => c.level === "SHOULD"));
});

const CLI = path.join(ROOT, "conformance/backend/bin/abap2ui5-conformance.mjs");

test("the CLI prints its usage and refuses bad arguments with exit code 2", () => {
  assert.match(execFileSync(process.execPath, [CLI, "--help"], { encoding: "utf8" }), /abap2ui5-conformance backend --url/);
  assert.equal(spawnSync(process.execPath, [CLI, "backend"]).status, 2);
  assert.equal(spawnSync(process.execPath, [CLI, "backend", "--url", "http://x", "--bogus"]).status, 2);
  const fe = spawnSync(process.execPath, [CLI, "frontend"], { encoding: "utf8" });
  assert.equal(fe.status, 2);
  assert.match(fe.stderr, /--adapter is one of ui5, agent, webcomponent, headless/);
});

test("the CLI against an unreachable backend reports failures with exit code 1", () => {
  const r = spawnSync(process.execPath, [CLI, "backend", "--url", "http://127.0.0.1:9/", "--only", "transport.post-json"], { encoding: "utf8" });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL\s+MUST\s+transport\.post-json/);
});
