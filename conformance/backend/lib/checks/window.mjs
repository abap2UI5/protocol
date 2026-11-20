// spec/windowed-tables.md - a table the APP loads a window at a time
// (window_bind_tab( )): the window state next to the rows the app holds,
// and the window request, which the backend hands to the app as the app's
// own event. Driven through the conformance app WINDOW: twelve rows, four
// at a time, QTY in another order than ID; the app sorts, filters and
// counts itself, LAST shows the event and the arguments it was handed and
// REQUEST the request it found in get( )-r_event_data
// (path reason skip top, S:<path>:<A|D> per sorter,
// F<group>:<path>:<operator>:<value1>:<value2> per condition).
const W = "spec/windowed-tables.md";
const EVENT = "___ZZZ_WIN";
const PATH = "/T_ROWS";
const APP_EVENT = "ROWS";

const QTY_DESC = JSON.stringify([{ PATH: "QTY", DESCENDING: true }]);
/** the ids in the order of QTY descending */
const BY_QTY = [5, 10, 2, 7, 12, 4, 9, 1, 6, 11, 3, 8];

const ids = (r) => (r.json.MODEL && Array.isArray(r.json.MODEL.T_ROWS) ? r.json.MODEL.T_ROWS.map((row) => row.ID) : undefined);
const state = (r) => r.json.MODEL && r.json.MODEL.__WINDOW && r.json.MODEL.__WINDOW.T_ROWS;

/** A window request as the UI5 list binding sends it: [path, event, reason, skip, top] and, for SORT and FILTER, the sorters and the filter groups. */
const more = (t, r, skip, top, opts = {}) => t.event(r, EVENT, { ...opts, args: [PATH, APP_EVENT, "MORE", String(skip), String(top)] });
const restart = (t, r, reason, top, sort = "[]", filter = "[]", opts = {}) => t.event(r, EVENT, { ...opts, args: [PATH, APP_EVENT, reason, "0", String(top), sort, filter] });

function expectWindow(t, r, expectedIds, total, what) {
  t.ok(r.json.MODEL, `${what}: the response carries no MODEL`);
  t.deepEqual(ids(r), expectedIds, `${what}: the ID of the rows in MODEL.T_ROWS`);
  t.deepEqual(state(r), { TOTAL: total, COUNT: expectedIds.length, SIZE: 4, EVENT: APP_EVENT }, `${what}: MODEL.__WINDOW.T_ROWS`);
}

/** What the app was handed: LAST (event and arguments) and REQUEST (r_event_data). */
function expectHanded(t, r, last, request, what) {
  t.equal(r.json.MODEL.LAST, last, `${what}: MODEL.LAST (the app's event and get( )-t_event_arg)`);
  t.equal(r.json.MODEL.REQUEST, request, `${what}: MODEL.REQUEST (get( )-r_event_data)`);
}

const noView = (r) => {
  const system = (r.json.S_FRONT.S_ACTION && r.json.S_FRONT.S_ACTION.T_SYSTEM) || [];
  return !system.some((a) => a[0] === "VIEW_SLOTS" && a[1] === "display");
};

export default [
  {
    id: "window.first-window",
    title: "A windowed table arrives as the rows the app loaded, the window state with TOTAL, COUNT, SIZE and EVENT under /__WINDOW/<path>",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-window-state`,
    async run(t) {
      const r = await t.start("WINDOW");
      expectWindow(t, r, [1, 2, 3, 4], 12, "app start");
      t.deepEqual(r.json.MODEL.T_ROWS[0], { DONE: false, ID: 1, NAME: "item 01", QTY: 5 }, "MODEL.T_ROWS[0]");
    },
  },
  {
    id: "window.app-event",
    title: "A window request runs the app: its event is the request's, its arguments [reason, skip, top], the request in r_event_data - and the response carries the rows the app holds then",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-window-request`,
    async run(t) {
      const start = await t.start("WINDOW");
      const grown = await more(t, start, 4, 4);
      expectWindow(t, grown, [1, 2, 3, 4, 5, 6, 7, 8], 12, "MORE 4 4");
      expectHanded(t, grown, "ROWS MORE 4 4", "/T_ROWS MORE 4 4", "MORE 4 4");
      t.equal(grown.json.MODEL.MAINS, start.json.MODEL.MAINS + 1, "MODEL.MAINS (main( ) runs once for a window request)");
      t.equal(grown.json.S_FRONT.APP, start.json.S_FRONT.APP, "S_FRONT.APP");
      t.ok(grown.json.S_FRONT.ID && grown.json.S_FRONT.ID !== start.json.S_FRONT.ID, "the window request is answered with a draft id of its own");
      t.ok(noView(grown), `a window request answered with a view the app did not display: ${JSON.stringify(grown.json.S_FRONT.S_ACTION)}`);
      const all = await more(t, grown, 8, 4);
      expectWindow(t, all, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12, "MORE 8 4");
      // the path is handed over as it was sent: which table asks is the app's to read
      const elsewhere = await t.event(start, EVENT, { args: ["/SUMMARY", APP_EVENT, "MORE", "4", "4"] });
      expectHanded(t, elsewhere, "ROWS MORE 4 4", "/SUMMARY MORE 4 4", "a request with the path /SUMMARY");
      t.ok(elsewhere.json.MODEL.T_ROWS === undefined || ids(elsewhere).join() === "1,2,3,4", `the app does not load rows for /SUMMARY: ${JSON.stringify(ids(elsewhere))}`);
    },
  },
  {
    id: "window.request-sort-filter",
    title: "SORT and FILTER hand the app the sorters and the filter groups, parsed, and skip 0; MORE hands it neither",
    level: "MUST",
    profile: "core",
    spec: `${W}#sorters-and-filters`,
    async run(t) {
      // what the UI5 list binding sends for a sort, more rows and a filter
      const start = await t.start("WINDOW");
      const sorted = await restart(t, start, "SORT", 4, QTY_DESC);
      expectWindow(t, sorted, BY_QTY.slice(0, 4), 12, "SORT QTY descending");
      expectHanded(t, sorted, "ROWS SORT 0 4", "/T_ROWS SORT 0 4 S:QTY:D", "SORT QTY descending");
      const grown = await more(t, sorted, 4, 4);
      expectWindow(t, grown, BY_QTY.slice(0, 8), 12, "MORE inside the sort");
      expectHanded(t, grown, "ROWS MORE 4 4", "/T_ROWS MORE 4 4", "MORE inside the sort");
      const filtered = await restart(t, grown, "FILTER", 4, QTY_DESC, JSON.stringify([[["NAME", "Contains", "1", null]]]));
      expectWindow(t, filtered, [10, 12, 1, 11], 4, "FILTER NAME Contains 1, the sort sent along");
      expectHanded(t, filtered, "ROWS FILTER 0 4", "/T_ROWS FILTER 0 4 S:QTY:D F1:NAME:Contains:1:", "FILTER NAME Contains 1");
      // the shape of the parts: a column in any case, two sorters in their
      // order, the groups numbered from 1, a number and a null as text
      const two = await t.event(start, EVENT, { args: [PATH, APP_EVENT, "SORT", "8", "4", JSON.stringify([{ PATH: "done", DESCENDING: false }, { PATH: "Name", DESCENDING: true }]), "[]"] });
      expectHanded(t, two, "ROWS SORT 0 4", "/T_ROWS SORT 0 4 S:DONE:A S:NAME:D", "SORT DONE, then NAME descending, sent with skip 8");
      expectWindow(t, two, [12, 11, 10, 9], 12, "SORT DONE, then NAME descending");
      const groups = await restart(t, start, "FILTER", 4, "[]", JSON.stringify([[["QTY", "GT", 8, null]], [["NAME", "Contains", "1", null], ["ID", "EQ", 5, null]]]));
      expectHanded(t, groups, "ROWS FILTER 0 4", "/T_ROWS FILTER 0 4 F1:QTY:GT:8: F2:NAME:Contains:1: F2:ID:EQ:5:", "FILTER in two groups");
      expectWindow(t, groups, [5, 10], 2, "QTY GT 8 AND (NAME Contains 1 OR ID EQ 5)");
      const between = await restart(t, start, "FILTER", 8, "[]", JSON.stringify([[["QTY", "BT", 3, 6]]]));
      expectHanded(t, between, "ROWS FILTER 0 8", "/T_ROWS FILTER 0 8 F1:QTY:BT:3:6", "FILTER QTY BT 3 6");
      expectWindow(t, between, [1, 6, 9, 11], 4, "QTY BT 3 6");
    },
  },
  {
    id: "window.request-bounds",
    title: "A window request the backend cannot read whole is still the app's event - counts that are no plain number are 0, an unknown reason is MORE, an unreadable part is empty; never an error",
    level: "SHOULD",
    profile: "core",
    spec: `${W}#the-window-request`,
    async run(t) {
      const start = await t.start("WINDOW");
      // none of these is a request a frontend may send (schema/request.schema.json)
      const loose = async (args) => {
        const r = await t.event(start, EVENT, { args });
        t.client.exchanges[t.client.exchanges.length - 1].malformed = true;
        return r;
      };
      const odd = await loose([PATH, APP_EVENT, " filter ", "abc", "-1", "[x", "{}"]);
      expectHanded(t, odd, "ROWS FILTER 0 0", "/T_ROWS FILTER 0 0", "reason \" filter \", skip \"abc\", top \"-1\", parts that are no arrays");
      t.deepEqual(ids(odd), [], "MODEL.T_ROWS (the app loaded top 0 rows)");
      const s = state(odd) || {};
      t.ok(s.SIZE === 4 && s.EVENT === APP_EVENT && s.TOTAL === 12 && (s.COUNT === undefined || s.COUNT === 0), `MODEL.__WINDOW.T_ROWS of an empty table: ${JSON.stringify(state(odd))}`);
      const unknown = await loose([PATH, APP_EVENT, "NEXT", "1234567890", " 8 ", QTY_DESC, "[]"]);
      expectHanded(t, unknown, "ROWS MORE 0 8", "/T_ROWS MORE 0 8", "reason \"NEXT\", skip of ten digits, top \" 8 \"");
      expectWindow(t, unknown, [1, 2, 3, 4, 5, 6, 7, 8], 12, "reason \"NEXT\"");
      const said = await loose([PATH, APP_EVENT, "MORE", "4", "4", QTY_DESC, JSON.stringify([[["QTY", "GT", 8, null]]])]);
      expectHanded(t, said, "ROWS MORE 4 4", "/T_ROWS MORE 4 4", "MORE with sorters and a filter");
      const short = await loose([PATH, APP_EVENT]);
      expectHanded(t, short, "ROWS MORE 0 0", "/T_ROWS MORE 0 0", "a request of two arguments");
    },
  },
  {
    id: "window.total-from-app",
    title: "TOTAL is the app's total as it holds it when the response is made - read anew, no new view - and never less than COUNT",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-window-state`,
    async run(t) {
      const start = await t.start("WINDOW");
      const more20 = await t.event(start, "TOTAL", { args: ["20"] });
      t.deepEqual(state(more20), { TOTAL: 20, COUNT: 4, SIZE: 4, EVENT: APP_EVENT }, "MODEL.__WINDOW.T_ROWS after the app set its total to 20");
      t.ok(noView(more20), "the app displayed no view");
      const less = await t.event(more20, "TOTAL", { args: ["2"] });
      t.deepEqual(state(less), { TOTAL: 4, COUNT: 4, SIZE: 4, EVENT: APP_EVENT }, "MODEL.__WINDOW.T_ROWS after the app set its total to 2 with 4 rows loaded");
      const filtered = await restart(t, start, "FILTER", 4, "[]", JSON.stringify([[["QTY", "GT", 6, null]]]));
      expectWindow(t, filtered, [2, 4, 5, 7], 6, "a filter the app counted itself");
    },
  },
  {
    id: "window.order-with-the-draft",
    title: "The rows the app loaded and its order belong to the draft: a request that continues an earlier draft continues that draft's rows",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-app-owns-the-order`,
    async run(t) {
      const start = await t.start("WINDOW");
      const sorted = await restart(t, start, "SORT", 4, QTY_DESC);
      const filtered = await restart(t, sorted, "FILTER", 4, QTY_DESC, JSON.stringify([[["QTY", "GT", 8, null]]]));
      expectWindow(t, filtered, [5, 10, 2, 7], 4, "sorted, then filtered");
      const edited = await t.event(filtered, "CHECK", { model: { T_ROWS: { __delta: { 0: { DONE: true } } } } });
      t.equal(edited.json.MODEL.SUMMARY, "5", "SUMMARY after the edit");
      const earlier = await more(t, sorted, 4, 4);
      expectWindow(t, earlier, BY_QTY.slice(0, 8), 12, "more rows of the draft that was sorted and not yet filtered");
      t.deepEqual(earlier.json.MODEL.T_ROWS.map((row) => row.DONE), Array(8).fill(false), "DONE in the draft before the edit");
      const again = await more(t, sorted, 4, 4);
      expectWindow(t, again, BY_QTY.slice(0, 8), 12, "the same draft once more");
      const first = await more(t, start, 4, 4);
      expectWindow(t, first, [1, 2, 3, 4, 5, 6, 7, 8], 12, "more rows of the first draft (no sort)");
    },
  },
  {
    id: "window.delta-rows",
    title: "A row of a __delta on a windowed table is the row of the table with that index - the table is what the frontend shows - applied before the app's event runs",
    level: "MUST",
    profile: "core",
    spec: `${W}#edits`,
    async run(t) {
      const start = await t.start("WINDOW");
      const sorted = await restart(t, start, "SORT", 4, QTY_DESC);
      const check = await t.event(sorted, "CHECK", { model: { T_ROWS: { __delta: { 0: { DONE: true }, 2: { DONE: true } } } } });
      t.equal(check.json.MODEL.SUMMARY, "5,2", "SUMMARY (the rows 0 and 2 of the table, sorted by QTY descending, are the rows with ID 5 and 2)");
      expectWindow(t, check, BY_QTY.slice(0, 4), 12, "the rows after the edit");
      t.deepEqual(check.json.MODEL.T_ROWS.map((row) => row.DONE), [true, false, true, false], "DONE of the rows in MODEL.T_ROWS");
      // a window request carries the delta like any event: it is in the
      // table before the app's event loads the rows anew
      const unsorted = await restart(t, check, "SORT", 12, "[]", "[]", { model: { T_ROWS: { __delta: { 1: { DONE: true } } } } });
      expectWindow(t, unsorted, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12, "the sort cleared by the request that carried an edit");
      t.deepEqual(unsorted.json.MODEL.T_ROWS.filter((row) => row.DONE).map((row) => row.ID), [2, 5, 10], "the ID of the rows that are DONE (row 1 of the table sorted by QTY descending is the row with ID 10)");
    },
  },
  {
    id: "window.whole-table-written",
    title: "A windowed table sent back whole is written like any table - the table is what the frontend shows",
    level: "MUST",
    profile: "core",
    spec: `${W}#edits`,
    async run(t) {
      const start = await t.start("WINDOW");
      const check = await t.event(start, "CHECK", { model: { T_ROWS: [{ ID: 99, NAME: "only", QTY: 1, DONE: true }] } });
      t.equal(check.json.MODEL.SUMMARY, "99", "SUMMARY");
      t.deepEqual(ids(check), [99], "the ID of the rows in MODEL.T_ROWS");
      t.deepEqual(state(check), { TOTAL: 12, COUNT: 1, SIZE: 4, EVENT: APP_EVENT }, "MODEL.__WINDOW.T_ROWS (the app's total, the one row it holds)");
    },
  },
];
