// raw.json -> portable-census/census.json (restructured, per-corpus app counts per member)
import fs from 'fs';
const OUTDIR = process.argv[2];
const raw = JSON.parse(fs.readFileSync('raw.json', 'utf8'));
const CORE = ['samples', 'stack', 'addons'];
const splitM = (m) => { const i = Math.max(m.lastIndexOf('.'), m.lastIndexOf('@'), m.lastIndexOf('/')); return [m.slice(0, i), m[i], m.slice(i + 1)]; };

// member -> per-corpus app counts
const memApps = {};
for (const a of raw.apps) for (const m of a.members) { const e = (memApps[m] ??= {}); e[a.corpus] = (e[a.corpus] || 0) + 1; }
const coreOf = (o) => CORE.reduce((n, c) => n + (o?.[c] || 0), 0);

const controls = {};
for (const [name, c] of Object.entries(raw.controls)) {
  const props = {}, aggs = {}, evts = {};
  for (const [p, uses] of Object.entries(c.properties)) {
    const ap = memApps[`${name}.${p}`] || {};
    props[p] = { appsCore: coreOf(ap), appsControls: ap.controls || 0, appsPerCorpus: ap, attrUses: uses, boundUses: c.propertyBindings[p] || 0, inMetadata: !(p in c.unknownAttrs) };
  }
  for (const [g, uses] of Object.entries(c.aggregations)) {
    const isDefault = g.endsWith(' (default)');
    const ap = isDefault ? null : memApps[`${name}/${g}`] || {};
    aggs[g] = { asElementUses: uses, ...(ap ? { appsCore: coreOf(ap), appsControls: ap.controls || 0 } : { note: 'children placed without an aggregation tag (default aggregation)', appsAll: c.aggregationApps[g] || 0 }) };
  }
  for (const [g, uses] of Object.entries(c.aggregationBindings)) {
    const ap = memApps[`${name}/${g}`] || {};
    aggs[g] = { ...(aggs[g] || {}), boundAsAttrUses: uses, appsCore: coreOf(ap), appsControls: ap.controls || 0 };
  }
  for (const [e, uses] of Object.entries(c.events)) {
    const ap = memApps[`${name}@${e}`] || {};
    evts[e] = { appsCore: coreOf(ap), appsControls: ap.controls || 0, wires: uses, argDescriptors: raw.eventArgDescriptors?.[`${name}@${e}`] };
  }
  const sortBy = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => (b[1].appsCore || 0) - (a[1].appsCore || 0) || (b[1].appsControls || 0) - (a[1].appsControls || 0) || (b[1].asElementUses || 0) - (a[1].asElementUses || 0)));
  controls[name] = {
    appsCore: c.appsCore, appsPerCorpus: c.appsPerCorpus, usesPerCorpus: c.usesPerCorpus, inUi5Metadata: c.meta,
    properties: sortBy(props), aggregations: sortBy(aggs), events: sortBy(evts),
    associations: c.associations, specialAttrs: c.special,
    topParents: Object.fromEntries(Object.entries(c.parents).slice(0, 8)),
  };
}

const perCorpusSum = (o) => ({ ...o, core: coreOf(o) });
const bindingForms = {};
for (const [f, uses] of Object.entries(raw.bindingForms)) bindingForms[f] = { attrUses: uses, apps: perCorpusSum(raw.bindingFormsAppsPerCorpus[f] || {}), examples: raw.bindingExamples?.[f] };

const fa = {};
const faDetail = {};
for (const [k, n] of Object.entries(raw.frontendActions)) { const [name, detail] = k.split(' :: '); (fa[name] ??= { callSites: 0 }).callSites += n; if (detail) (faDetail[name] ??= {})[detail] = n; }
for (const [name, e] of Object.entries(fa)) { e.asViewWire = raw.frontendActionsAsViewWire?.[name] || 0; e.scheduledFromAbap = raw.frontendActionsScheduled?.[name] || 0; e.apps = perCorpusSum(raw.frontendActionsAppsPerCorpus[name] || {}); }

const census = {
  generated: raw.generated,
  method: {
    primary: 'View reconstruction with the abap2UI5 linter library (prepareAbap( ) from @abap2ui5/linter 0.8.5 lib, run from a local copy that is patched in ONE place: event-handler expressions (client->_event / _event_client / follow_up_action / _event_nav_app_leave) are kept as base64 of the raw ABAP call instead of the generic .eB() stub, so wire shapes, arguments and frontend actions can be classified). Every *.clas.abap of each corpus is reconstructed; every document (main view, popups, popovers, fragments) of a class counts towards that class = "app".',
    memberKinds: 'Attribute kind (property / event / aggregation-binding / association) from the linter\'s UI5 metadata snapshot (data/properties.json, inheritance walked); attributes on controls without metadata (z2ui5.cc.*) are classified by value.',
    secondary: 'Regex scan of the ABAP source (comments and string literals blanked) for client API calls and for follow_up_action( ) / _event_client( ) call sites, which are split into view wires (result consumed as an attribute) and actions scheduled from ABAP.',
    namespaces: 'Controls are namespace-qualified via the xmlns declarations of the reconstructed XML; lowercase element names are aggregations of the enclosing control. sap.ui.core.mvc.View and sap.ui.core.FragmentDefinition are document roots.',
    limitations: [
      '20 addon demo launcher classes (abap2UI5-addons_popups/src/99/*) build their view with the legacy z2ui5_cl_xml_view helper API, which the reconstruction does not replay; they are skipped (their popups, z2ui5_cl_pop_*, are included).',
      '6 addon classes (sapgui se93/st05/se80/a2ui5, cgui alv/report) reconstruct only partly (unplacedTokens > 0); their found controls are counted.',
      '/tmp/claude-0/x/abap2UI5-addons_abap-cloud-gui is an older copy of /home/user/abap-cloud-gui and is not counted twice; abap2UI5-addons_launchpad-kpi has no views.',
      'Event-argument classification parses the raw ABAP call text with regexes; a handful of arguments built from variables are counted as "non-literal".',
      'Member app counts: "appsCore" = samples + stack + addons; samples-controls is reported separately as appsControls (it is a demo-kit port collection and deliberately exercises every control/property).',
    ],
  },
  corpora: raw.corpora,
  totals: { appsCore: raw.apps.filter((a) => CORE.includes(a.corpus)).length, appsControls: raw.apps.filter((a) => a.corpus === 'controls').length, distinctControls: Object.keys(controls).length },
  controls,
  bindingForms,
  eventWires: {
    wireMethods: Object.fromEntries(Object.entries(raw.eventWires.methods).map(([k, v]) => [k, { wires: v, apps: perCorpusSum(raw.eventMethodsAppsPerCorpus[k] || {}) }])),
    shapes: raw.eventWires.shapes,
    argKinds: Object.fromEntries(Object.entries(raw.eventWires.argKinds).map(([k, v]) => [k, { args: v, apps: perCorpusSum(raw.eventArgKindsAppsPerCorpus[k] || {}), examples: raw.eventArgExamples?.[k] }])),
    argDescriptorApps: Object.fromEntries(Object.entries(raw.eventArgDescriptorsApps || {}).map(([k, v]) => [k, perCorpusSum(v)]).sort((a, b) => (b[1].core - a[1].core) || ((b[1].controls || 0) - (a[1].controls || 0)))),
    argDescriptorsPerControlEvent: raw.eventArgDescriptors,
    eventControlOptions_s_ctrl: raw.eventWires.sctrl,
    eventNameKinds: raw.eventWires.eventNames,
    frontendActionsWiredInViews: raw.eventWires.frontendActionsInWires,
  },
  frontendActions: Object.fromEntries(Object.entries(fa).sort((a, b) => b[1].apps.core - a[1].apps.core || b[1].callSites - a[1].callSites)),
  frontendActionDetails: faDetail,
  clientApi: Object.fromEntries(Object.entries(raw.clientApiAppsPerCorpus).map(([k, v]) => [k, perCorpusSum(v)]).sort((a, b) => b[1].core - a[1].core)),
  namespaces: raw.namespaces,
  apps: raw.apps.map((a) => ({ corpus: a.corpus, file: a.file, incomplete: a.incomplete || undefined, controls: a.controls, members: a.members, bindings: a.bindings, eventArgKinds: a.argKinds, frontendActions: a.frontendActions, clientApi: a.clientApi })),
};
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(OUTDIR + '/census.json', JSON.stringify(census, null, 1));
console.log('written', (fs.statSync(OUTDIR + '/census.json').size / 1e6).toFixed(1), 'MB');
