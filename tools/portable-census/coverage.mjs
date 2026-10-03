import fs from 'fs';
const c = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const proposal = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const FREE = new Set(['sap.ui.core.mvc.View', 'sap.ui.core.FragmentDefinition']);
const CORE = ['samples', 'stack', 'addons'];
const apps = c.apps.map((a) => ({ ...a, need: a.controls.filter((x) => !FREE.has(x)) }));
const core = apps.filter((a) => CORE.includes(a.corpus));
const ctrlApps = apps.filter((a) => a.corpus === 'controls');

const freq = (list) => { const f = {}; for (const a of list) for (const x of a.need) f[x] = (f[x] || 0) + 1; return f; };
const fCore = freq(core), fCtl = freq(ctrlApps);
const rankCore = Object.keys({ ...fCore }).sort((a, b) => fCore[b] - fCore[a] || (fCtl[b] || 0) - (fCtl[a] || 0) || a.localeCompare(b));
const rankCtl = Object.keys(fCtl).sort((a, b) => fCtl[b] - fCtl[a] || (fCore[b] || 0) - (fCore[a] || 0) || a.localeCompare(b));

const covered = (list, set) => list.filter((a) => a.need.every((x) => set.has(x))).length;
const pct = (n, d) => Math.round((1000 * n) / d) / 10;
const NS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120, 150];

function curve(rank, lists) {
  const rows = [];
  for (const n of NS) {
    const s = new Set(rank.slice(0, n));
    const row = { N: n, lastAdded: rank[n - 1] };
    for (const [k, l] of Object.entries(lists)) { const k2 = covered(l, s); row[k] = { apps: k2, of: l.length, pct: pct(k2, l.length) }; }
    rows.push(row);
  }
  return rows;
}
const lists = {
  core: core, samples: core.filter((a) => a.corpus === 'samples'), stack: core.filter((a) => a.corpus === 'stack'),
  addons: core.filter((a) => a.corpus === 'addons'), controls: ctrlApps,
};
// greedy: repeatedly add the missing-set of the app that completes most apps per added control
function greedy(list, maxN = 150) {
  const chosen = new Set(); const order = []; const steps = [];
  while (chosen.size < maxN) {
    const unc = list.filter((a) => !a.need.every((x) => chosen.has(x)));
    if (!unc.length) break;
    const cands = new Map();
    for (const a of unc) { const miss = a.need.filter((x) => !chosen.has(x)).sort(); cands.set(miss.join('|'), miss); }
    let best = null, bestScore = -1;
    for (const miss of cands.values()) {
      const s = new Set([...chosen, ...miss]);
      const gain = unc.filter((a) => a.need.every((x) => s.has(x))).length;
      const score = gain / miss.length + gain * 1e-6;
      if (score > bestScore) { bestScore = score; best = miss; }
    }
    for (const x of best) { chosen.add(x); order.push(x); }
    steps.push({ size: chosen.size, covered: covered(list, chosen), added: best });
  }
  return { order, steps };
}
const g = greedy(core);
const gCtl = greedy(ctrlApps, 400);

function blockers(list, set) {
  const unc = list.filter((a) => !a.need.every((x) => set.has(x)));
  const any = {}, single = {};
  for (const a of unc) {
    const miss = a.need.filter((x) => !set.has(x));
    for (const x of miss) any[x] = (any[x] || 0) + 1;
    if (miss.length === 1) single[miss[0]] = (single[miss[0]] || 0) + 1;
  }
  const missDist = {};
  for (const a of unc) { const m = a.need.filter((x) => !set.has(x)).length; const k = m >= 5 ? '5+' : String(m); missDist[k] = (missDist[k] || 0) + 1; }
  const sort = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 25);
  return { uncovered: unc.length, missingCountDistribution: missDist, blockingApps: sort(any), soleBlocker: sort(single), uncoveredApps: unc.map((a) => ({ file: a.file, missing: a.need.filter((x) => !set.has(x)) })) };
}

const out = {
  appCounts: Object.fromEntries(Object.entries(lists).map(([k, l]) => [k, l.length])),
  distinctControls: { core: rankCore.length, controls: rankCtl.length },
  rankCore: rankCore.map((x) => [x, fCore[x], fCtl[x] || 0]),
  rankControlsCorpus: rankCtl.slice(0, 150).map((x) => [x, fCtl[x], fCore[x] || 0]),
  curveByCoreRank: curve(rankCore, lists),
  curveControlsByOwnRank: curve(rankCtl, { controls: ctrlApps }),
  greedyCore: g.steps.slice(0, 60),
  greedyCoreCurve: NS.map((n) => { const s = new Set(g.order.slice(0, n)); return { N: n, core: pct(covered(core, s), core.length), controls: pct(covered(ctrlApps, s), ctrlApps.length) }; }),
  greedyControlsCurve: NS.concat([200, 250, 300]).map((n) => { const s = new Set(gCtl.order.slice(0, n)); return { N: n, controls: pct(covered(ctrlApps, s), ctrlApps.length) }; }),
  blockersAtTop40: blockers(core, new Set(rankCore.slice(0, 40))),
};
if (proposal) {
  const s = new Set(proposal);
  out.proposal = {
    size: proposal.length,
    notInCorpus: proposal.filter((x) => !fCore[x] && !fCtl[x]),
    coverage: Object.fromEntries(Object.entries(lists).map(([k, l]) => [k, { apps: covered(l, s), of: l.length, pct: pct(covered(l, s), l.length) }])),
    blockersCore: blockers(core, s),
    blockersControls: (() => { const b = blockers(ctrlApps, s); delete b.uncoveredApps; return b; })(),
  };
}
fs.writeFileSync(process.argv[4] || 'coverage.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.appCounts), JSON.stringify(out.distinctControls));
for (const r of out.curveByCoreRank) console.log(r.N, r.lastAdded, 'core', r.core.pct, 'samples', r.samples.pct, 'stack', r.stack.pct, 'addons', r.addons.pct, 'controls', r.controls.pct);
console.log('controls own rank'); for (const r of out.curveControlsByOwnRank) console.log(r.N, r.controls.pct);
console.log('greedy core', JSON.stringify(out.greedyCoreCurve));
console.log('greedy ctl', JSON.stringify(out.greedyControlsCurve));
if (out.proposal) console.log('proposal', JSON.stringify(out.proposal.coverage), out.proposal.notInCorpus, JSON.stringify(out.proposal.blockersCore.blockingApps.slice(0, 15)), JSON.stringify(out.proposal.blockersCore.soleBlocker.slice(0, 15)), JSON.stringify(out.proposal.blockersControls.blockingApps.slice(0, 20)));
