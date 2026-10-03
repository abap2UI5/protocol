#!/usr/bin/env node
/*
 * Render the generated sections of profiles/portable.md - the control list
 * (section 3), the client API's actions against what a renderer receives
 * (section 6), the v1.1 candidates (section 9) and the Web Components
 * mapping (Appendix A) - from profiles/portable-v1.json, between their
 * <!-- portable:<name>:begin/end --> markers.
 *
 *   node scripts/render-portable.mjs           # rewrite profiles/portable.md
 *   node scripts/render-portable.mjs --check   # exit 1 when it is out of date
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MD = path.join(ROOT, "profiles", "portable.md");
const JSON_FILE = path.join(ROOT, "profiles", "portable-v1.json");

const list = (ms) => (ms.length ? ms.map((m) => `\`${m.name}\` (${m.core}/${m.controls})`).join(", ") : "-");

export function render(profile) {
  const byCat = new Map();
  for (const [name, c] of Object.entries(profile.controls)) {
    if (!byCat.has(c.category)) byCat.set(c.category, []);
    byCat.get(c.category).push([name, c]);
  }
  const controls = [];
  const mapping = [];
  for (const [cat, entries] of byCat) {
    controls.push(`### ${cat}`, "", "| Control | Core / samples-controls apps | Properties | Aggregations | Events |", "|---|---:|---|---|---|");
    for (const [name, c] of entries) {
      const agg = list(c.aggregations) + (c.defaultAggregation ? ` (default: \`${c.defaultAggregation}\`)` : "");
      controls.push(`| ${name}${c.tolerated ? " *(tolerated)*" : ""} | ${c.usage.coreApps} / ${c.usage.samplesControlsApps} | ${list(c.properties)} | ${agg} | ${list(c.events)} |`);
    }
    controls.push("");
    mapping.push(`### ${cat}`, "");
    for (const [name, c] of entries) {
      mapping.push(`- **${name}** -> ${c.webComponent} (*${c.fit}*). ${c.mapping}`);
      if (c.notInV1.length) {
        mapping.push(`  Not in v1: ${c.notInV1.map((m) => `${m.kind} \`${m.name}\` (${m.core}/${m.controls})`).join(", ")}.`);
      }
    }
    mapping.push("");
  }
  const { api, wire } = profile.actions;
  const code = (xs) => xs.map((x) => `\`${x}\``).join(", ");
  const actions = ["| Client API (`actions.api`) | What the renderer receives (`actions.wire`) |", "|---|---|"];
  for (const a of api) {
    const opt = wire.foldedIntoRouter[a];
    actions.push(`| \`${a}\` | ${opt ? `the \`ROUTER\` option \`${opt}\` - never \`${a}\` itself` : (wire.custom.includes(a) ? `\`${a}\` (\`T_CUSTOM\`, \`.eF\`)` : "-")} |`);
  }
  for (const [g, methods] of Object.entries(wire.customGlobals)) actions.push(`| (\`${g}\`) | \`${g}\` ${methods.join(" / ")} (\`T_CUSTOM\` or \`.eF\`, directly or as a \`CONTROL_GLOBAL\` target) |`);
  actions.push("", `System actions (\`T_SYSTEM\`): ${Object.entries(wire.system).map(([k, m]) => `\`${k}\` ${m.join(" / ")}`).join(", ")}; the \`ROUTER\` options: ${code(wire.routerOptions)}. MAY be a no-op where the platform has no counterpart: ${code(wire.noOpAllowed || [])}.`);
  const v11 = ["| Family | Controls | Core apps blocked in v1 | Web Component | Fit / note |", "|---|---|---:|---|---|"];
  for (const r of profile.v11Candidates) v11.push(`| ${r.family} | ${r.controls} | ${r.coreAppsBlocked} | ${r.webComponent} | ${r.note} |`);
  return { controls: controls.join("\n").trim(), actions: actions.join("\n"), v11: v11.join("\n"), mapping: mapping.join("\n").trim() };
}

export function apply(md, parts) {
  let out = md;
  for (const [name, body] of Object.entries(parts)) {
    const re = new RegExp(`(<!-- portable:${name}:begin[^>]*-->)[\\s\\S]*?(<!-- portable:${name}:end -->)`);
    if (!re.test(out)) throw new Error(`profiles/portable.md has no portable:${name} markers`);
    out = out.replace(re, (m, a, b) => `${a}\n\n${body}\n\n${b}`);
  }
  return out;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const md = fs.readFileSync(MD, "utf8");
  const next = apply(md, render(JSON.parse(fs.readFileSync(JSON_FILE, "utf8"))));
  if (process.argv.includes("--check")) {
    if (next !== md) {
      process.stderr.write("profiles/portable.md is out of date - run node scripts/render-portable.mjs\n");
      process.exit(1);
    }
  } else {
    fs.writeFileSync(MD, next);
  }
}
