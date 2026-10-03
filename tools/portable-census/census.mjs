// Portable-view census over abap2UI5 corpora, using the linter's view reconstruction
// (patched copy: event handlers keep their raw ABAP expression base64-encoded).
import fs from 'fs';
import path from 'path';
import { prepareAbap } from './lint/lib/reconstruct.mjs';
import { scrub } from './lint/lib/abap.mjs';
function blankLiterals(src){ let out='',q=null; for (let i=0;i<src.length;i++){const c=src[i]; if(q){ if(c===q){q=null; out+=c;} else out+=(c==='\n'?'\n':' '); continue;} if(c==='`'||c==="'"||c==='|'){q=c; out+=c; continue;} out+=c;} return out; }

const META = JSON.parse(fs.readFileSync(new URL('./lint/data/properties.json', import.meta.url))).controls;
const OUT = process.argv[2];

const CORPORA = {
  samples: ['/home/user/samples/src'],
  stack: ['/home/user/samples-stack/src'],
  controls: ['/home/user/samples-controls/src'],
  addons: [
    '/tmp/claude-0/x/abap2UI5-addons_popups/src',
    '/tmp/claude-0/x/abap2UI5-addons_selection-screen/src',
    '/tmp/claude-0/x/abap2UI5-addons_sapgui/src',
    '/tmp/claude-0/x/abap2UI5-addons_launchpad-kpi/src',
    '/home/user/abap-cloud-gui/src',
    '/home/user/admin-cockpit/src',
    '/home/user/agent/src',
  ],
};

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.clas\.abap$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

// ---- metadata lookup -------------------------------------------------------
function memberKind(cls, name) {
  let c = cls, guard = 0;
  while (c && META[c] && guard++ < 30) {
    const m = META[c];
    if (m.properties && name in m.properties) return 'property';
    if (m.events && name in m.events) return 'event';
    if (m.aggregations && name in m.aggregations) return 'aggregation';
    if (m.associations && name in m.associations) return 'association';
    c = m.parent;
  }
  if (['id', 'class', 'binding', 'models', 'objectBindings'].includes(name)) return 'special';
  if (name === 'tooltip') return 'aggregation';
  return META[cls] ? 'unknown' : 'nometa';
}
function defaultAgg(cls) {
  let c = cls, g = 0;
  while (c && META[c] && g++ < 30) { if (META[c].defaultAggregation) return META[c].defaultAggregation; c = META[c].parent; }
  return null;
}

// ---- binding classification ------------------------------------------------
const EVT_RE = /^\.eB\('§([A-Za-z0-9_-]*)§'\)$/;
function classifyValue(v) {
  // returns array of binding-form tags (empty array = static literal)
  const tags = [];
  if (typeof v !== 'string') return tags;
  if (!v.includes('{')) return tags;
  // escaped literal braces \{ are not bindings
  const s = v.replace(/\\[{}]/g, '');
  if (!s.includes('{')) { tags.push('escaped-literal-brace'); return tags; }
  // find top-level {...} groups
  const groups = [];
  let depth = 0, start = -1, q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (depth > 0 && (c === "'" || c === '"')) { q = c; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') { depth--; if (depth === 0) groups.push(s.slice(start, i + 1)); }
  }
  if (!groups.length) return ['unparsed-brace'];
  let outside = s; for (const g of groups) outside = outside.replace(g, ''); outside = outside.trim();
  if (groups.length > 1 || (outside.length && !groups[0].startsWith('{='))) tags.push('string-composite(text + {..})');
  for (const g of groups) {
    const inner = g.slice(1, -1).trim();
    if (inner.startsWith('=') || inner.startsWith(':=')) {
      tags.push(inner.startsWith(':=') ? 'expression-binding-onetime {:= }' : 'expression-binding {= }');
      if (/\$\{[^}]*>/.test(inner)) tags.push('expression-binding:named-model-ref');
      if (/\b(Math|odata|encodeURIComponent|RegExp|Date)\b|\.(format|indexOf|toLowerCase|toUpperCase|length|includes|toFixed|split|substr|substring|startsWith|trim|replace)\b/.test(inner)) tags.push('expression-binding:function-call');
      continue;
    }
    if (/^\s*(path|parts|value|model)\s*:|^['"]?(path|parts)['"]?\s*:/.test(inner) || /^\s*['"]?\w+['"]?\s*:/.test(inner)) {
      tags.push('object-binding {path:..}');
      if (/\bparts\s*:/.test(inner)) tags.push('composite parts:[..]');
      if (/\btype\s*:/.test(inner)) {
        tags.push('typed binding (type:)');
        const m = [...inner.matchAll(/\btype\s*:\s*['"]([\w.\/]+)['"]/g)].map((x) => x[1]);
        for (const t of m) tags.push('type=' + t.replace(/\//g, '.'));
      }
      if (/\bformatOptions\s*:/.test(inner)) tags.push('formatOptions');
      if (/\bconstraints\s*:/.test(inner)) tags.push('constraints');
      if (/\bformatter\s*:/.test(inner)) {
        tags.push('formatter ref');
        const m = [...inner.matchAll(/\bformatter\s*:\s*['"]([^'"]+)['"]/g)].map((x) => x[1]);
        for (const f of m) tags.push('formatter=' + f);
      }
      if (/\btargetType\s*:/.test(inner)) tags.push('targetType');
      if (/\bmode\s*:/.test(inner)) tags.push('binding mode');
      if (/\bsorter\s*:/.test(inner)) tags.push('list-binding sorter');
      if (/\bfilters\s*:/.test(inner)) tags.push('list-binding filters');
      if (/\b(templateShareable|length|startIndex)\s*:/.test(inner)) tags.push('list-binding options');
      if (/\bevents\s*:/.test(inner)) tags.push('binding events');
      if (/\bmodel\s*:/.test(inner) || /['"]\w+>/.test(inner)) tags.push('named model');
      if (/i18n>/.test(inner)) tags.push('i18n');
      continue;
    }
    // simple path forms
    const m = inner.match(/^(\w+)>(.*)$/);
    if (m) {
      if (m[1] === 'i18n') tags.push('i18n {i18n>key}');
      else if (m[1] === 'device') tags.push('named model: device>');
      else if (m[1] === 'view' || m[1] === 'ui' ) tags.push('named model: ' + m[1] + '>');
      else tags.push('named model {m>/path}');
      continue;
    }
    if (inner.startsWith('/')) tags.push('simple absolute {/PATH}');
    else if (inner.startsWith('@')) tags.push('metadata/@ path');
    else if (inner === '') tags.push('runtime-computed relative path (reconstructs as {})');
    else tags.push('simple relative {PATH}');
  }
  return [...new Set(tags)];
}

// ---- event wire classification -------------------------------------------
function decodeEvt(v) {
  const m = typeof v === 'string' && v.match(EVT_RE);
  if (!m) return null;
  return Buffer.from(m[1], 'base64url').toString('utf8');
}
function stringsIn(s) {
  const out = [];
  const re = /`((?:[^`]|``)*)`|'((?:[^']|'')*)'|\|((?:\\.|[^|\\])*)\|/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
function argOf(src, name) {
  // returns the text after `name =` up to the next top-level named arg (rough)
  const re = new RegExp('\\b' + name + '\\s*=\\s*', 'i');
  const m = src.match(re);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 0, q = null, out = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { out += c; if (c === q) q = null; continue; }
    if (c === '`' || c === "'" || c === '|') { q = c; out += c; continue; }
    if (c === '(') depth++;
    if (c === ')') { if (depth === 0) break; depth--; }
    if (depth === 0 && /\s/.test(c) && /^\s+\w+\s*=[^=]/.test(src.slice(i))) break;
    out += c;
  }
  return out.trim();
}
function classifyArg(a) {
  const t = [];
  a = a.replace(/\{\s*client->_bind(?:_edit)?\s*\([^)]*\)\s*\}/gi, '{/BOUND}').replace(/\{\s*client->_bind(?:_edit)?\s*\(\s*val\s*=\s*\S+\s+path\s*=\s*abap_true\s*\)\s*\}/gi,'{/BOUND}');
  if (/\$\{\$source>\//.test(a)) t.push('${$source>/prop}');
  if (/\$\{\$parameters>\//.test(a)) t.push('${$parameters>/name}');
  if (/\$\{(?!\$source|\$parameters)[^}]*>\//.test(a)) t.push('${model>/path} (named model)');
  if (/\$\{\/[^}]*\}/.test(a)) t.push('${/ABS_PATH}');
  if (/\$\{(?![$\/])[\w\/]+\}/.test(a)) t.push('${REL_PATH} (row context)');
  if (/\$event\b/.test(a)) t.push('$event...');
  if (/\$controller\./.test(a)) t.push('$controller.helper()');
  if (/\$\{[^}]*\}\.\w+\(/.test(a) || /\$source\.\w|\.get\w+\(/.test(a)) t.push('JS method call on arg');
  if (!t.length) t.push(a.startsWith('$') || a.startsWith('{') ? 'literal JSON/template starting with { or $ (raw-evaluated)' : 'static literal');
  return t;
}
function classifyEvent(raw) {
  const r = { method: null, val: null, args: [], argKinds: [], sctrl: [], view: null };
  const mm = raw.match(/client->(_event_nav_app_leave|_event_client|_event|follow_up_action)\b/i);
  r.method = mm ? mm[1].toLowerCase() : 'other';
  const body = raw.slice(raw.indexOf('(', mm ? mm.index : 0) + 1);
  if (r.method === '_event_nav_app_leave') return r;
  let val = argOf(body, 'val');
  if (val == null) {
    // positional first parameter
    const p = body.trim();
    if (!/^\w+\s*=/.test(p)) val = p.replace(/\)\s*$/, '').trim();
  }
  if (val != null) {
    const cs = val.match(/cs_event-(\w+)/i);
    const lit = stringsIn(val)[0];
    r.val = cs ? 'cs_event-' + cs[1].toLowerCase() : lit != null ? lit : val ? '<var:' + val.slice(0, 40) + '>' : '';
  }
  const targ = argOf(body, 't_arg');
  const arg1 = argOf(body, 'arg');
  for (const src of [targ, arg1]) {
    if (!src) continue;
    const lits = stringsIn(src);
    if (!lits.length) { r.args.push('<non-literal>'); r.argKinds.push('non-literal (variable/expression)'); }
    for (const l of lits) { r.args.push(l); r.argKinds.push(...classifyArg(l)); }
  }
  const sc = argOf(body, 's_ctrl');
  if (sc) for (const m of sc.matchAll(/\b([a-z]\w*)\s*=(?!=)/gi)) r.sctrl.push(m[1].toLowerCase());
  const view = argOf(body, 'view');
  if (view) r.view = (view.match(/cs_view-(\w+)/i) || [, view])[1];
  return r;
}

// ---- source-level scans (outside the view) ---------------------------------
const CLIENT_METHODS = ['view_display', 'view_model_update', 'nest_view_display', 'nest2_view_display', 'nest_view_model_update',
  'popup_display', 'popup_destroy', 'popup_model_update', 'popover_display', 'popover_destroy', 'popover_model_update',
  'message_toast_display', 'message_box_display', 'nav_app_call', 'nav_app_leave', 'follow_up_action', 'set_session_stateful',
  'set_app_state_active', 'set_push_state', 'set_nav_back', 'get_event_arg', 'check_on_navigated', 'binding_call', 'nest_view_destroy', 'nest2_view_destroy'];

function frontendActionsIn(src) {
  // every follow_up_action( ... ) / _event_client( ... ) call; its action name
  const acts = [];
  const re = /client->(follow_up_action|_event_client)\s*\(/gi;
  const blank = blankLiterals(scrub(src));
  let m;
  while ((m = re.exec(blank))) {
    const before = blank.slice(Math.max(0, m.index - 40), m.index).replace(/\s+$/, '');
    const wire = /[=(]$/.test(before) && !/\bval\s*=$/i.test(before);
    const body = src.slice(m.index + m[0].length, m.index + m[0].length + 600);
    let val = argOf(body, 'val');
    if (val == null) val = body.split(/\s(?:t_arg|view)\s*=|\)/)[0];
    const cs = val && val.match(/cs_event-(\w+)/i);
    let name = cs ? cs[1].toUpperCase() : null;
    if (!name) { const lit = stringsIn(val || '')[0]; name = lit != null ? 'literal:' + lit : '<var>'; }
    // CONTROL_GLOBAL target
    let detail = null;
    if (/CONTROL_GLOBAL|control_global/i.test(name)) {
      const t = argOf(body, 't_arg'); const l = t ? stringsIn(t) : [];
      if (l.length) detail = l[0] + (l[1] ? '.' + l[1] : '');
    }
    if (/CONTROL_BY_ID|control_by_id/i.test(name)) {
      const t = argOf(body, 't_arg'); const l = t ? stringsIn(t) : [];
      if (l.length > 1) detail = 'method:' + l[1];
    }
    if (/BINDING_CALL/i.test(name)) {
      const t = argOf(body, 't_arg'); const l = t ? stringsIn(t) : [];
      if (l.length > 1) detail = 'method:' + l[1];
    }
    if (/literal:|<var>/.test(name) && /client->_event\s*\(/i.test(val||'')) name = 'ROUNDTRIP_EVENT (follow_up_action( _event( ) ))';
    acts.push({ via: m[1].toLowerCase(), name, detail, wire });
  }
  return acts;
}

// ---- main walk ---------------------------------------------------------------
const census = {
  generated: new Date().toISOString(),
  method: 'linter view reconstruction (prepareAbap from a patched local copy of @abap2ui5/linter 0.8.5 lib, event handlers kept as raw ABAP expressions) over every *.clas.abap; source regex scan for frontend actions and client API calls',
  corpora: {},
  controls: {},
  bindingForms: {},
  eventWires: { methods: {}, argKinds: {}, sctrl: {}, viewParam: {}, eventNames: {}, frontendActionsInWires: {} },
  frontendActions: {},
  clientApi: {},
  namespaces: {},
  apps: [],
};

function corpusAgg(obj, corpus) { obj[corpus] ??= 0; obj[corpus]++; }

for (const [corpus, dirs] of Object.entries(CORPORA)) {
  const files = dirs.flatMap((d) => walk(d));
  const cstat = { classFiles: files.length, appsWithView: 0, incomplete: 0, noView: 0, docs: 0, roots: dirs };
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    if (!/z2ui5_if_app|z2ui5_cl_ui5_view_builder|z2ui5_cl_xml_view/i.test(src)) { cstat.noView++; continue; }
    let r;
    try { r = prepareAbap(src); } catch (e) { cstat.noView++; continue; }
    const roots = r.nodes || [];
    if (!roots.length) { cstat.noView++; continue; }
    cstat.appsWithView++;
    cstat.docs += roots.length;
    const app = {
      corpus, file: f.replace('/home/user/', '').replace('/tmp/claude-0/x/', ''),
      incomplete: r.unplacedTokens > 0, helperTokens: r.helperTokens, unplaced: r.unplacedTokens,
      controls: new Set(), members: new Set(), bindings: new Set(), evtMethods: new Set(), argKinds: new Set(), frontendActions: new Set(), clientApi: new Set(),
      docKinds: r.docKinds,
    };
    if (app.incomplete) cstat.incomplete++;

    const visit = (node, nsMap, parentCtrl, parentAgg) => {
      const map = { ...nsMap };
      for (const [k, v] of node.attrs || []) {
        if (k === 'xmlns') map[''] = v;
        else if (k.startsWith('xmlns:')) map[k.slice(6)] = v;
      }
      const prefix = node.ns || '';
      const local = node.name || '';
      const nsUri = map[prefix] ?? (prefix || '?');
      const isCtrl = /^[A-Z]/.test(local) || nsUri === 'http://www.w3.org/1999/xhtml' || /xhtml/.test(nsUri);
      if (!isCtrl) {
        // aggregation element of parentCtrl
        if (parentCtrl) {
          const ctl = census.controls[parentCtrl];
          inc(ctl.aggregations, local);
          app.members.add(parentCtrl + '/' + local);
          ctl._aggApps[local] ??= new Set(); ctl._aggApps[local].add(app.file);
        }
        for (const ch of node.children || []) visit(ch, map, parentCtrl, local);
        return;
      }
      const fq = /xhtml/.test(nsUri) ? 'html:' + local : nsUri + '.' + local;
      inc(census.namespaces, nsUri);
      const ctl = census.controls[fq] ??= {
        name: fq, appsPerCorpus: {}, usesPerCorpus: {}, properties: {}, propertyBindings: {}, aggregations: {}, aggregationBindings: {},
        events: {}, associations: {}, special: {}, unknownAttrs: {}, parents: {}, _apps: {}, _aggApps: {}, _propApps: {}, _evtApps: {},
      };
      inc(ctl.usesPerCorpus, corpus);
      (ctl._apps[corpus] ??= new Set()).add(app.file);
      if (parentCtrl) inc(ctl.parents, parentCtrl + (parentAgg ? '/' + parentAgg : '/(default)'));
      else inc(ctl.parents, '(root)');
      if (parentCtrl && !parentAgg) {
        const da = defaultAgg(parentCtrl);
        const pc = census.controls[parentCtrl];
        if (pc) { inc(pc.aggregations, (da || '?') + ' (default)'); pc._aggApps[(da || '?') + ' (default)'] ??= new Set(); pc._aggApps[(da || '?') + ' (default)'].add(app.file); }
      }
      app.controls.add(fq);
      for (const [k, v] of node.attrs || []) {
        if (k === 'xmlns' || k.startsWith('xmlns:')) continue;
        const ev = decodeEvt(v);
        let kind = k.includes(':') ? 'special' : memberKind(fq, k);
        if (ev) kind = 'event';
        else if (kind === 'nometa' || kind === 'unknown') kind = /^\.e[A-Z]?\w*\(/.test(v || '') ? 'event' : kind;
        if (kind === 'event') {
          inc(ctl.events, k);
          app.members.add(fq + '@' + k);
          (ctl._evtApps[k] ??= new Set()).add(app.file);
          if (ev) {
            const c = classifyEvent(ev);
            inc(census.eventWires.methods, c.method);
            app.evtMethods.add(c.method);
            for (const a of new Set(c.argKinds)) { inc(census.eventWires.argKinds, a); app.argKinds.add(a); }
            for (const a of c.args) for (const k of classifyArg(a)) { const ex = (census.eventArgExamples ??= {})[k] ??= []; if (ex.length < 6 && !ex.includes(a)) ex.push(a.slice(0, 160)); }
            if (c.method === '_event' && c.args.length === 0 && c.val && !c.val.startsWith('<')) {} 
            for (const s of c.sctrl) inc(census.eventWires.sctrl, s);
            for (const a of c.args) for (const m of a.matchAll(/\$\{(\$parameters|\$source)>\/([\w\/@]+)\}(\.\w+\()?/g)) {
              const key = fq + '@' + k; const d = ((census.eventArgDescriptors ??= {})[key] ??= {});
              inc(d, `\${${m[1]}>/${m[2]}}` + (m[3] ? ' + JS call' : ''), 1);
              const g = ((census.eventArgDescriptorsApps ??= {})[`\${${m[1]}>/${m[2].split('/')[0]}}`] ??= {}); (g[corpus] ??= new Set()).add(app.file);
            }
            if (c.view) inc(census.eventWires.viewParam, c.view);
            if (c.method === '_event_client' || c.method === 'follow_up_action') { inc(census.eventWires.frontendActionsInWires, c.val || '?'); }
            if (c.method === '_event') inc(census.eventWires.eventNames, c.val == null ? '(none)' : c.val.startsWith('<var') ? '<variable>' : 'literal/constant');
            const shape = c.method + (c.args.length ? `[${c.args.length} arg]` : '');
            inc(census.eventWires.shapes ??= {}, shape);
          } else {
            inc(census.eventWires.methods, 'non-stub literal handler');
          }
          continue;
        }
        const tags = classifyValue(v);
        for (const t of tags) {
          const ex = (census.bindingExamples ??= {})[t] ??= [];
          if (ex.length < 4 && !ex.includes(v)) ex.push(v.slice(0, 220));
          inc(census.bindingForms, t);
          app.bindings.add(t);
        }
        if (kind === 'aggregation') {
          inc(ctl.aggregationBindings, k);
          app.members.add(fq + '/' + k);
          (ctl._aggApps[k + ' (bound)'] ??= new Set()).add(app.file);
          inc(census.bindingForms, 'list/aggregation binding (attr)');
          app.bindings.add('list/aggregation binding (attr)');
        } else if (kind === 'association') inc(ctl.associations, k);
        else if (kind === 'special') inc(ctl.special, k);
        else if (kind === 'property' || kind === 'unknown' || kind === 'nometa') app.members.add(fq + '.' + k);
        if (kind === 'property') {
          inc(ctl.properties, k);
          (ctl._propApps[k] ??= new Set()).add(app.file);
          if (tags.length) inc(ctl.propertyBindings, k);
        } else if (kind !== 'aggregation' && kind !== 'association' && kind !== 'special') {
          inc(ctl.unknownAttrs, k);
          inc(ctl.properties, k);
          (ctl._propApps[k] ??= new Set()).add(app.file);
        }
      }
      for (const ch of node.children || []) visit(ch, map, fq, null);
    };
    for (const root of roots) visit(root, {}, null, null);

    for (const a of frontendActionsIn(src)) {
      const key = a.name + (a.detail ? ' :: ' + a.detail : '');
      inc(census.frontendActions, key);
      inc(a.wire ? (census.frontendActionsAsViewWire ??= {}) : (census.frontendActionsScheduled ??= {}), a.name);
      app.frontendActions.add(a.name);
    }
    const scrubbed = blankLiterals(scrub(src));
    for (const m of CLIENT_METHODS) if (new RegExp('client->' + m + '\\s*\\(', 'i').test(scrubbed)) app.clientApi.add(m);
    census.apps.push(app);
  }
  census.corpora[corpus] = cstat;
}

// finalize: per-control app counts and app-sets
const appCountBy = (setMap) => Object.fromEntries(Object.entries(setMap).map(([k, s]) => [k, s.size]));
for (const ctl of Object.values(census.controls)) {
  ctl.appsPerCorpus = appCountBy(ctl._apps);
  ctl.appsCore = ['samples', 'stack', 'addons'].reduce((n, c) => n + (ctl.appsPerCorpus[c] || 0), 0);
  ctl.aggregationApps = appCountBy(ctl._aggApps);
  ctl.propertyApps = appCountBy(ctl._propApps);
  ctl.eventApps = appCountBy(ctl._evtApps);
  ctl.meta = !!META[ctl.name];
  delete ctl._apps; delete ctl._aggApps; delete ctl._propApps; delete ctl._evtApps;
}
// per-app aggregates per corpus for binding forms / event shapes / actions / client api
const perCorpus = (field) => {
  const out = {};
  for (const a of census.apps) for (const k of a[field]) { out[k] ??= {}; inc(out[k], a.corpus); }
  return out;
};
census.bindingFormsAppsPerCorpus = perCorpus('bindings');
census.eventMethodsAppsPerCorpus = perCorpus('evtMethods');
census.eventArgKindsAppsPerCorpus = perCorpus('argKinds');
census.frontendActionsAppsPerCorpus = perCorpus('frontendActions');
census.clientApiAppsPerCorpus = perCorpus('clientApi');

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => (typeof b[1] === 'number' ? b[1] - a[1] : 0)));
for (const ctl of Object.values(census.controls)) for (const k of ['properties', 'propertyBindings', 'aggregations', 'aggregationBindings', 'events', 'associations', 'special', 'unknownAttrs', 'parents', 'aggregationApps', 'propertyApps', 'eventApps']) ctl[k] = sortObj(ctl[k]);
census.controls = Object.fromEntries(Object.entries(census.controls).sort((a, b) => b[1].appsCore - a[1].appsCore || (b[1].appsPerCorpus.controls || 0) - (a[1].appsPerCorpus.controls || 0)));
for (const k of ['bindingForms', 'frontendActions', 'namespaces', 'frontendActionsAsViewWire', 'frontendActionsScheduled']) census[k] = sortObj(census[k]);
for (const k of Object.keys(census.eventWires)) census.eventWires[k] = sortObj(census.eventWires[k]);

if (census.eventArgDescriptorsApps) for (const v of Object.values(census.eventArgDescriptorsApps)) for (const k of Object.keys(v)) v[k] = v[k].size;
census.apps = census.apps.map((a) => ({ ...a, controls: [...a.controls].sort(), members: [...a.members].sort(), bindings: [...a.bindings], evtMethods: [...a.evtMethods], argKinds: [...a.argKinds], frontendActions: [...a.frontendActions], clientApi: [...a.clientApi] }));
fs.writeFileSync(OUT, JSON.stringify(census, null, 1));
console.log(JSON.stringify(census.corpora, null, 1));
