// profiles/portable-v1.json, profiles/portable.md and the census control set
// held to each other.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { validate, formatErrors } from "../conformance/backend/lib/schema.mjs";
import { render, apply } from "../scripts/render-portable.mjs";
import { ROOT } from "./lib/traffic.mjs";

const profile = JSON.parse(fs.readFileSync(path.join(ROOT, "profiles/portable-v1.json"), "utf8"));
const md = fs.readFileSync(path.join(ROOT, "profiles/portable.md"), "utf8");

test("portable-v1.json matches schema/portable-profile.schema.json", () => {
  const r = validate("portable-profile", profile);
  assert.ok(r.valid, formatErrors(r.errors));
});

test("portable-v1.json holds 61 rendered and 4 tolerated controls - the census v1 set", () => {
  const all = Object.entries(profile.controls);
  assert.equal(all.filter(([, c]) => !c.tolerated).length, 61);
  assert.equal(all.filter(([, c]) => c.tolerated).length, 4);
  const census = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/portable-census/v1.json"), "utf8"));
  assert.deepEqual(Object.keys(profile.controls).sort(), [...census].sort());
});

test("profiles/portable.md's generated sections are up to date (node scripts/render-portable.mjs)", () => {
  assert.equal(apply(md, render(profile)), md);
});

test("every control's namespace is a portable namespace", () => {
  for (const name of Object.keys(profile.controls)) {
    const ns = name.slice(0, name.lastIndexOf("."));
    assert.ok(profile.namespaces.includes(ns), `${name}: ${ns}`);
  }
});

test("event parameters name only portable controls and their v1 events", () => {
  for (const [control, events] of Object.entries(profile.eventParameters)) {
    const c = profile.controls[control];
    assert.ok(c, control);
    for (const ev of Object.keys(events)) {
      const known = c.events.some((e) => e.name === ev) || ["change", "liveChange", "submit", "suggest", "selectionChange", "tokenUpdate", "search"].includes(ev);
      assert.ok(known, `${control}.${ev}`);
    }
  }
});

test("actions.api is the client API, actions.wire what a renderer receives (open question 10)", () => {
  const { api, wire } = profile.actions;
  // the list of revision 0.2 stays for its consumers
  assert.deepEqual(profile.frontendActions.allowed, api);
  assert.deepEqual(profile.frontendActions.allowedGlobals, wire.customGlobals);
  // every api name arrives either under its own name or as a ROUTER option - never both
  for (const a of api) {
    const folded = Object.prototype.hasOwnProperty.call(wire.foldedIntoRouter, a);
    assert.notEqual(folded, wire.custom.includes(a), a);
    if (folded) assert.ok(wire.routerOptions.includes(wire.foldedIntoRouter[a]), `${a} -> ${wire.foldedIntoRouter[a]}`);
  }
  assert.deepEqual(wire.custom.filter((a) => !api.includes(a)), []);
  assert.deepEqual(Object.keys(wire.system).sort(), ["ROUTER", "VIEW_SLOTS"]);
});
