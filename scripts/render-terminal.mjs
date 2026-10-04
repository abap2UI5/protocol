#!/usr/bin/env node
/*
 * Render the mapping table of renderers/terminal/README.md - every control
 * of portable profile v1, by category, with what it becomes on screen -
 * from the renderer's own table (renderers/terminal/mapping.mjs), between
 * the <!-- terminal:mapping:begin/end --> markers.
 *
 *   node scripts/render-terminal.mjs           # rewrite the README
 *   node scripts/render-terminal.mjs --check   # exit 1 when it is out of date
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTROLS } from "../renderers/terminal/mapping.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const README = path.join(ROOT, "renderers", "terminal", "README.md");
const PROFILE = JSON.parse(fs.readFileSync(path.join(ROOT, "profiles", "portable-v1.json"), "utf8"));

const cell = (s) => String(s || "").replace(/\|/g, "\\|");

export function renderMapping(controls = CONTROLS, profile = PROFILE) {
  const byCat = new Map();
  for (const [name, c] of Object.entries(profile.controls)) {
    if (!byCat.has(c.category)) byCat.set(c.category, []);
    byCat.get(c.category).push(name);
  }
  const out = [];
  let mapped = 0;
  for (const [cat, names] of byCat) {
    out.push(`### ${cat}`, "", "| Control | Terminal | Notes |", "|---|---|---|");
    for (const n of names) {
      const m = controls[n];
      if (m) mapped += 1;
      out.push(`| ${n} | ${m ? cell(m.terminal) : "**not mapped**"} | ${m ? cell(m.note) || "-" : "-"} |`);
    }
    out.push("");
  }
  const total = Object.keys(profile.controls).length;
  out.unshift(`${mapped} of ${total} controls of portable profile v1 mapped.`, "");
  return out.join("\n").trim();
}

export function apply(md, body) {
  const re = /(<!-- terminal:mapping:begin[^>]*-->)[\s\S]*?(<!-- terminal:mapping:end -->)/;
  if (!re.test(md)) throw new Error("renderers/terminal/README.md has no terminal:mapping markers");
  return md.replace(re, (m, a, b) => `${a}\n\n${body}\n\n${b}`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const md = fs.readFileSync(README, "utf8");
  const next = apply(md, renderMapping());
  if (process.argv.includes("--check")) {
    if (next !== md) {
      process.stderr.write("renderers/terminal/README.md is out of date - run node scripts/render-terminal.mjs\n");
      process.exit(1);
    }
  } else {
    fs.writeFileSync(README, next);
  }
}
