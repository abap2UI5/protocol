// The conformance apps: every ABAP class is abapGit-clean and has its cap2UI5
// twin, and conformance/apps/README.md describes every one.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { DEFAULT_APPS } from "../conformance/backend/lib/runner.mjs";
import { ROOT } from "./lib/traffic.mjs";

const ABAP = path.join(ROOT, "conformance/apps/abap");
const JS = path.join(ROOT, "conformance/apps/cap2ui5");
const classes = Object.values(DEFAULT_APPS);

test("every conformance app exists as ABAP class with an abapGit sidecar", () => {
  for (const cls of classes) {
    const base = path.join(ABAP, cls.toLowerCase());
    const abap = fs.readFileSync(`${base}.clas.abap`, "utf8");
    const xml = fs.readFileSync(`${base}.clas.xml`);
    assert.match(abap, new RegExp(`^CLASS ${cls.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC\\.$`, "m"), cls);
    assert.match(abap, /INTERFACES z2ui5_if_app\./, cls);
    // abapGit's byte format (abap-check skill): BOM on the XML, never on the
    // ABAP, LF only, a terminating newline, no trailing blanks, 255 columns
    assert.deepEqual([...xml.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${cls}.clas.xml starts with the BOM`);
    assert.notEqual(abap.charCodeAt(0), 0xfeff, `${cls}.clas.abap has no BOM`);
    for (const [name, text] of [["abap", abap], ["xml", xml.toString("utf8")]]) {
      assert.ok(!text.includes("\r"), `${cls}.${name}: LF only`);
      assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"), `${cls}.${name}: one terminating newline`);
      text.split("\n").forEach((l, i) => {
        assert.ok(!/[ \t]$/.test(l), `${cls}.${name}:${i + 1} trailing whitespace`);
        assert.ok(l.length <= 255, `${cls}.${name}:${i + 1} longer than 255`);
        assert.ok(/^[\x00-\x7e﻿]*$/.test(l), `${cls}.${name}:${i + 1} non-ASCII`);
      });
    }
    assert.match(xml.toString("utf8"), new RegExp(`<CLSNAME>${cls}</CLSNAME>`), cls);
    assert.ok(!/<DESCRIPT>[^<]*'/.test(xml.toString("utf8")), `${cls}: a raw apostrophe in DESCRIPT`);
  }
});

test("no stray ABAP objects besides the conformance apps", () => {
  const objects = new Set(fs.readdirSync(ABAP).map((f) => f.split(".")[0].toUpperCase()));
  assert.deepEqual([...objects].sort(), [...classes].sort());
});

test("every conformance app has a cap2UI5 twin registered under the same name", () => {
  const source = fs.readdirSync(JS).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(JS, f), "utf8")).join("\n");
  const defined = [...source.matchAll(/defineApp\(\s*("([A-Z0-9_]+)"|([A-Z_]+))/g)].map((m) => m[2] || m[3]);
  const names = defined.map((d) => (d === "TARGET" ? "Z2UI5_CL_CONF_NAV_TGT" : d));
  assert.deepEqual([...names].sort(), [...classes].sort());
});

test("conformance/apps/README.md has a section for every app", () => {
  const readme = fs.readFileSync(path.join(ROOT, "conformance/apps/README.md"), "utf8");
  for (const cls of classes) assert.ok(readme.includes(cls), cls);
});
