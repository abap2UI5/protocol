import fs from 'fs';
const c = JSON.parse(fs.readFileSync('portable-census/census.json', 'utf8'));
const cov = c.coverage;
const row = (N) => cov.curveByCoreRank.find((r) => r.N === N);
const own = (N) => cov.curveControlsByOwnRank.find((r) => r.N === N);
const g = (N) => cov.greedyCoreCurve.find((r) => r.N === N);
const gc = (N) => cov.greedyControlsCurve.find((r) => r.N === N);
const NS = [10, 20, 30, 40, 60, 80];
let t = '| top N controls | core: samples+stack+addons (247 apps) | samples (138) | stack (32) | addons (77) | samples-controls (642), same ranking | samples-controls, ranked by its own frequency | last control added at N |\n|---:|---:|---:|---:|---:|---:|---:|---|\n';
for (const N of NS) { const r = row(N); t += `| ${N} | **${r.core.pct}%** (${r.core.apps}) | ${r.samples.pct}% | ${r.stack.pct}% | ${r.addons.pct}% | ${r.controls.pct}% | ${own(N).controls.pct}% | ${r.lastAdded} |\n`; }
let fine = '| N | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 70 | 80 | 90 | 100 | 120 | 149 (all) |\n|---|' + '---:|'.repeat(18) + '\n';
fine += '| core % | ' + [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120, 150].map((N) => row(N).core.pct).join(' | ') + ' |\n';
fine += '| core apps | ' + [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120, 150].map((N) => row(N).core.apps).join(' | ') + ' |\n';
let greedy = '| N | 10 | 20 | 30 | 40 | 60 | 80 | 100 | 120 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
greedy += '| core, greedy set % | ' + [10, 20, 30, 40, 60, 80, 100, 120].map((N) => g(N).core).join(' | ') + ' |\n';
greedy += '| samples-controls, its own greedy set % | ' + [10, 20, 30, 40, 60, 80, 100, 120].map((N) => gc(N).controls).join(' | ') + ' |\n';
let rank = '| # | control | core apps | samples | stack | addons | samples-controls apps |\n|---:|---|---:|---:|---:|---:|---:|\n';
cov.rankCore.slice(0, 60).forEach(([n, core, ctl], i) => { const a = c.controls[n].appsPerCorpus; rank += `| ${i + 1} | ${n} | ${core} | ${a.samples || 0} | ${a.stack || 0} | ${a.addons || 0} | ${ctl} |\n`; });
let rankCtl = '| # | control | samples-controls apps | core apps |\n|---:|---|---:|---:|\n';
cov.rankControlsCorpus.slice(0, 40).forEach(([n, ctl, core], i) => { rankCtl += `| ${i + 1} | ${n} | ${ctl} | ${core} |\n`; });
const b = cov.blockersAtTop40;
let blk = '| control (not in top 40) | uncovered apps it blocks | apps where it is the ONLY missing control |\n|---|---:|---:|\n';
const sole = Object.fromEntries(b.soleBlocker);
const seen = new Set();
for (const [n, k] of b.blockingApps.slice(0, 22)) { blk += `| ${n} | ${k} | ${sole[n] || 0} |\n`; seen.add(n); }
for (const [n, k] of b.soleBlocker) if (!seen.has(n) && k >= 2) blk += `| ${n} | ${b.blockingApps.find((x) => x[0] === n)?.[1] ?? k} | ${k} |\n`;
const p = cov.profileV1, p11 = cov.profileV1plusV11;
let prof = '| | core | samples | stack | addons | samples-controls |\n|---|---:|---:|---:|---:|---:|\n';
const fc = p.featureCoverage;
const L = [['controls only (profile v1, 61 rendered + 4 tolerated)', 'controls'], ['+ only v1 properties/aggregations/events', 'controlsAndMembers'], ['+ only v1 binding forms', 'plusBindings'], ['+ only v1 event-argument descriptors', 'plusEventArgs'], ['+ only v1 frontend actions', 'plusFrontendActions'], ['+ only v1 client API (= runs fully on a v1 renderer)', 'plusClientApi']];
for (const [lab, k] of L) prof += `| ${lab} | **${fc.core.pct[k]}%** | ${fc.samples.pct[k]}% | ${fc.stack.pct[k]}% | ${fc.addons.pct[k]}% | ${fc.controls.pct[k]}% |\n`;
prof += `| v1 + v1.1 candidates (104 entries): controls only | **${p11.featureCoverage.core.pct.controls}%** | | | | ${p11.featureCoverage.controls.pct.controls}% |\n`;
prof += `| v1 + v1.1 candidates: everything | **${p11.featureCoverage.core.pct.plusClientApi}%** | | | | ${p11.featureCoverage.controls.pct.plusClientApi}% |\n`;
let pb = '| missing control | core apps blocked | as only blocker |\n|---|---:|---:|\n';
const ps = Object.fromEntries(p.blockersCore.soleBlocker);
for (const [n, k] of p.blockersCore.blockingApps.slice(0, 20)) pb += `| ${n} | ${k} | ${ps[n] || 0} |\n`;
let fb = '| reason (among apps whose controls are all in v1) | core apps |\n|---|---:|\n';
for (const [n, k] of fc.core.blockersAmongControlCoveredApps.slice(0, 14)) fb += `| ${n} | ${k} |\n`;
let ctlb = '| missing control | samples-controls apps blocked |\n|---|---:|\n';
for (const [n, k] of p.blockersControls.blockingApps.slice(0, 15)) ctlb += `| ${n} | ${k} |\n`;

const md = `# Portable view profile - coverage curve

Data basis: \`census.json\` in this folder (method, limitations and every number below are in it).
**Core corpus** = abap2UI5/samples (138 apps with a view) + samples-stack (32) + addons/real-world apps (77: popups, selection-screen, sapgui, abap-cloud-gui, admin-cockpit, agent) = **247 apps**.
**samples-controls** (642 ports of the UI5 demo kit) is reported separately: it is built to show every control, so it is a stress test, not a usage sample.
Method: exact view XML from the abap2UI5 linter's view reconstruction (\`prepareAbap\`), not a regex scan.
"Fully covered" = every control the app uses (in any of its documents: main view, popups, popovers, fragments) is in the set; \`mvc:View\` / \`core:FragmentDefinition\` are document roots and always free.
Ranking = number of core apps using the control (ties: samples-controls usage). The core corpus uses **149 distinct controls**, samples-controls **387**.

## 1. Coverage by top-N controls

${t}
Finer grid (core, frequency ranking):

${fine}
A set chosen greedily for coverage (repeatedly add the missing controls of the app group that completes the most apps per added control) does a little better at small N:

${greedy}
## 2. The knee

Marginal gain per added control (core apps):

| controls | 1-10 | 11-20 | 21-30 | 31-40 | 41-50 | 51-60 | 61-80 | 81-100 | 101-120 | 121-149 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| apps gained per control | ${(row(10).core.apps / 10).toFixed(1)} | ${((row(20).core.apps - row(10).core.apps) / 10).toFixed(1)} | ${((row(30).core.apps - row(20).core.apps) / 10).toFixed(1)} | ${((row(40).core.apps - row(30).core.apps) / 10).toFixed(1)} | ${((row(50).core.apps - row(40).core.apps) / 10).toFixed(1)} | ${((row(60).core.apps - row(50).core.apps) / 10).toFixed(1)} | ${((row(80).core.apps - row(60).core.apps) / 20).toFixed(1)} | ${((row(100).core.apps - row(80).core.apps) / 20).toFixed(1)} | ${((row(120).core.apps - row(100).core.apps) / 20).toFixed(1)} | ${((row(150).core.apps - row(120).core.apps) / 29).toFixed(1)} |

**The knee is at N ~ 40 (65% of core apps).** Up to 40 controls every added control completes ~3-6 apps; after 40 the gain drops to ~1 app per control and stays there - the remaining ~35% of apps are a long tail where almost every app needs its own 1-3 rare controls (missing-control count of the 87 apps uncovered at N=40: ${Object.entries(b.missingCountDistribution).map(([k, v]) => `${k} missing: ${v}`).join(', ')}).
The step at N=21-25 is \`sap.ui.core.Item\` + Select/SegmentedButton-type controls completing many small apps at once (an item element is worthless alone).

samples-controls has **no knee**: ranked by its own frequency it needs ~120 controls for 54% and ~250 for 93% (greedy). A portable profile cannot and should not aim at the demo-kit collection; it is useful only to check that the chosen properties of the v1 controls are not too narrow.

## 3. What blocks apps beyond the knee (top-40 set)

${blk}
The blockers split into three kinds:
1. **Cheap leftovers that belong in the profile** (one web component or a div each): ScrollContainer, CustomData (tolerate), CustomListItem, ObjectNumber, IconTabBar/IconTabFilter, InfoLabel, ProgressIndicator, ComboBox, MultiInput/Token, Tree/StandardTreeItem, Bar - all added to profile v1.
2. **Page-level / enterprise controls** with no or a very different web-component counterpart: sap.ui.table (grid table with RowAction), MessagePopover/MessageItem/MessageView, DynamicPage, FlexibleColumnLayout, NavContainer, QuickView, TableSelectDialog/SelectDialog, Menu - candidates for v1.1.
3. **Not portable by design**: \`sap.ui.comp\` smart controls (OData metadata driven), \`z2ui5.cc.*\` custom controls (abap2UI5 frontend extensions - Tree, FileUploader, InputExt, MultiInputExt, Storage, Geolocation, Camera…, 19 core apps), charts/gantt/vbm/code editor, drag & drop configs, \`html:\` elements.

## 4. Proposed profile v1 (see portable-proposal.md)

Profile v1 = the top-40 plus the cheap leftovers, minus sap.ui.table and the message popover: **61 rendered controls + 4 tolerated layout/data elements**.

${prof}
Control coverage of v1 equals the frequency top-60 (73.7%) but with a better samples-controls coverage (31.0% vs 15.1%), because it swaps rare-but-hard core controls for frequent-and-cheap demo-kit ones (VerticalLayout, HorizontalLayout, ToggleButton, Image, GridData, FlexItemData).
Remaining control blockers with v1:

${pb}
Among the apps whose controls are all in v1, what still keeps an app from running unchanged:

${fb}
samples-controls under v1 is mostly blocked by ObjectPage (sap.uxap), ObjectAttribute/ObjectHeader, Avatar, Slider, PlanningCalendar, Form/FormContainer/FormElement, ResponsivePopover:

${ctlb}
## 5. Rankings

Core ranking (top 60):

${rank}
samples-controls ranking (top 40):

${rankCtl}`;
fs.writeFileSync('portable-census/coverage.md', md);
console.log(md.length);
