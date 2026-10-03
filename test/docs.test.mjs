// The documents hold together: every check (backend and frontend suite)
// cites an existing section, every relative link in a Markdown file
// resolves, every check id the spec names exists, and the check lists in
// conformance/backend/README.md and conformance/frontend/README.md are the
// suites'.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ALL_CHECKS } from "../conformance/backend/lib/checks/index.mjs";
import { ALL_FRONTEND_CHECKS } from "../conformance/frontend/lib/checks/index.mjs";
import { renderCheckList, renderFrontendCheckList } from "../scripts/gen-check-list.mjs";
import { ROOT } from "./lib/traffic.mjs";

/** GitHub's heading anchors. */
function anchors(file) {
  const out = new Set();
  const seen = new Map();
  let fence = false;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith("```")) fence = !fence;
    const m = !fence && /^#{1,6} (.+)$/.exec(line);
    if (!m) continue;
    let a = m[1].trim().toLowerCase().replace(/[`*]/g, "").replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
    const n = seen.get(a) || 0;
    seen.set(a, n + 1);
    if (n) a = `${a}-${n}`;
    out.add(a);
  }
  return out;
}

function markdownFiles(dir = ROOT) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".build", ".cache", "deps", "test-results"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...markdownFiles(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function resolveLink(from, target) {
  const [file, anchor] = target.split("#");
  const p = file ? path.resolve(path.dirname(from), file) : from;
  return { p, anchor };
}

test("every check cites an existing file and section", () => {
  for (const c of [...ALL_CHECKS, ...ALL_FRONTEND_CHECKS]) {
    const { p, anchor } = resolveLink(path.join(ROOT, "x"), c.spec);
    assert.ok(fs.existsSync(p), `${c.id}: ${c.spec}`);
    if (anchor) assert.ok(anchors(p).has(anchor), `${c.id}: no section #${anchor} in ${c.spec.split("#")[0]}`);
  }
});

test("check ids are unique and every check has a level and a profile", () => {
  const ids = ALL_CHECKS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of ALL_CHECKS) {
    assert.ok(["MUST", "SHOULD"].includes(c.level), c.id);
    assert.ok(["core", "ui5"].includes(c.profile), c.id);
  }
});

test("every relative Markdown link resolves, anchors included", () => {
  for (const file of markdownFiles()) {
    if (file.includes(`${path.sep}tools${path.sep}`)) continue;
    let text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^[a-z]+:/i.test(target)) continue;
      const { p, anchor } = resolveLink(file, target);
      assert.ok(fs.existsSync(p), `${path.relative(ROOT, file)}: ${target}`);
      if (anchor && p.endsWith(".md")) assert.ok(anchors(p).has(anchor), `${path.relative(ROOT, file)}: ${target} - no such section`);
    }
  }
});

test("every check id named in the spec exists", () => {
  const ids = new Set(ALL_CHECKS.map((c) => c.id));
  for (const file of markdownFiles(path.join(ROOT, "spec"))) {
    for (const m of fs.readFileSync(file, "utf8").matchAll(/\*Checked by:\*([^.]*(?:\.[a-z][^.]*)*)/g)) {
      for (const id of m[1].matchAll(/`([a-z0-9]+\.[a-z0-9-]+)`/g)) assert.ok(ids.has(id[1]), `${path.relative(ROOT, file)}: ${id[1]}`);
    }
  }
});

test("every frontend check id named in the spec and the profiles exists", () => {
  const ids = new Set(ALL_FRONTEND_CHECKS.map((c) => c.id));
  let named = 0;
  for (const file of [...markdownFiles(path.join(ROOT, "spec")), ...markdownFiles(path.join(ROOT, "profiles"))]) {
    for (const m of fs.readFileSync(file, "utf8").matchAll(/\*[Ff]rontend checks?:\*([\s\S]*?)(?:\.(?:\s|$)|\||$)/g)) {
      for (const id of m[1].matchAll(/`([a-z0-9]+\.[a-z0-9-]+)`/g)) {
        named += 1;
        assert.ok(ids.has(id[1]), `${path.relative(ROOT, file)}: ${id[1]}`);
      }
    }
  }
  assert.ok(named > 40, `only ${named} frontend check ids named in the spec`);
});

test("conformance/frontend/README.md lists exactly the frontend suite's checks (node scripts/gen-check-list.mjs)", () => {
  const readme = fs.readFileSync(path.join(ROOT, "conformance/frontend/README.md"), "utf8");
  const m = /<!-- checks:begin[^>]*-->([\s\S]*?)<!-- checks:end -->/.exec(readme);
  assert.ok(m, "markers");
  assert.equal(m[1].trim(), renderFrontendCheckList(ALL_FRONTEND_CHECKS).trim());
});

test("conformance/backend/README.md lists exactly the suite's checks (node scripts/gen-check-list.mjs)", () => {
  const readme = fs.readFileSync(path.join(ROOT, "conformance/backend/README.md"), "utf8");
  const m = /<!-- checks:begin[^>]*-->([\s\S]*?)<!-- checks:end -->/.exec(readme);
  assert.ok(m, "markers");
  assert.equal(m[1].trim(), renderCheckList(ALL_CHECKS).trim());
});
