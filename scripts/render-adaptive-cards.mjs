#!/usr/bin/env node
/*
 * Render the mapping table of renderers/adaptive-cards/README.md - every
 * control of portable profile v1, by category, with the card element(s) it
 * becomes - from the renderer's own table (renderers/adaptive-cards/
 * mapping.mjs), between the <!-- adaptive-cards:mapping:begin/end -->
 * markers.
 *
 *   node scripts/render-adaptive-cards.mjs           # rewrite the README
 *   node scripts/render-adaptive-cards.mjs --check   # exit 1 when it is out of date
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTROLS } from "../renderers/adaptive-cards/mapping.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const README = path.join(ROOT, "renderers", "adaptive-cards", "README.md");
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
    out.push(`### ${cat}`, "", "| Control | Adaptive Card | Notes |", "|---|---|---|");
    for (const n of names) {
      const m = controls[n];
      if (m) mapped += 1;
      out.push(`| ${n} | ${m ? cell(m.card) : "**not mapped**"} | ${m ? cell(m.note) || "-" : "-"} |`);
    }
    out.push("");
  }
  const total = Object.keys(profile.controls).length;
  out.unshift(`${mapped} of ${total} controls of portable profile v1 mapped.`, "");
  return out.join("\n").trim();
}

export function apply(md, body) {
  const re = /(<!-- adaptive-cards:mapping:begin[^>]*-->)[\s\S]*?(<!-- adaptive-cards:mapping:end -->)/;
  if (!re.test(md)) throw new Error("renderers/adaptive-cards/README.md has no adaptive-cards:mapping markers");
  return md.replace(re, (m, a, b) => `${a}\n\n${body}\n\n${b}`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const md = fs.readFileSync(README, "utf8");
  const next = apply(md, renderMapping());
  if (process.argv.includes("--check")) {
    if (next !== md) {
      process.stderr.write("renderers/adaptive-cards/README.md is out of date - run node scripts/render-adaptive-cards.mjs\n");
      process.exit(1);
    }
  } else {
    fs.writeFileSync(README, next);
  }
}
