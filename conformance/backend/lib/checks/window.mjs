// spec/windowed-tables.md - a table the backend sends a window at a time
// (window_bind_tab( )): the window state, the window request and the order
// the backend keeps. Driven through the conformance app WINDOW: twelve rows,
// four at a time, QTY in another order than ID.
const W = "spec/windowed-tables.md";
const EVENT = "___ZZZ_WIN";
const PATH = "/T_ROWS";

const QTY_DESC = JSON.stringify([{ PATH: "QTY", DESCENDING: true }]);
/** the ids in the order of QTY descending */
const BY_QTY = [5, 10, 2, 7, 12, 4, 9, 1, 6, 11, 3, 8];

const ids = (r) => (r.json.MODEL && Array.isArray(r.json.MODEL.T_ROWS) ? r.json.MODEL.T_ROWS.map((row) => row.ID) : undefined);
const state = (r) => r.json.MODEL && r.json.MODEL.__WINDOW && r.json.MODEL.__WINDOW.T_ROWS;

/** One window request: [path, count, sort?, filter?] - a part left out is not sent. */
const request = (t, r, count, ...parts) => t.event(r, EVENT, { args: [PATH, String(count), ...parts] });

function expectWindow(t, r, expectedIds, total, what) {
  t.ok(r.json.MODEL, `${what}: the response carries no MODEL`);
  t.deepEqual(ids(r), expectedIds, `${what}: the ID of the rows in MODEL.T_ROWS`);
  t.deepEqual(state(r), { TOTAL: total, COUNT: expectedIds.length, SIZE: 4 }, `${what}: MODEL.__WINDOW.T_ROWS`);
}

export default [
  {
    id: "window.first-window",
    title: "A windowed table arrives as its first window, the window state under /__WINDOW/<path>",
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
    id: "window.more-rows",
    title: "A window request [path, count] answers the first count rows - the app does not run, no view is displayed",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-window-request`,
    async run(t) {
      const start = await t.start("WINDOW");
      const more = await request(t, start, 8);
      expectWindow(t, more, [1, 2, 3, 4, 5, 6, 7, 8], 12, "[path, \"8\"]");
      t.equal(more.json.MODEL.MAINS, start.json.MODEL.MAINS, "MODEL.MAINS (main( ) must not run for a window request)");
      t.equal(more.json.S_FRONT.APP, start.json.S_FRONT.APP, "S_FRONT.APP");
      t.ok(more.json.S_FRONT.ID && more.json.S_FRONT.ID !== start.json.S_FRONT.ID, "the window request is answered with a draft id of its own");
      t.ok(!more.json.S_FRONT.S_ACTION, `a window request queued actions: ${JSON.stringify(more.json.S_FRONT.S_ACTION)}`);
      const all = await request(t, more, 12);
      expectWindow(t, all, BY_QTY.slice().sort((a, b) => a - b), 12, "[path, \"12\"]");
      const check = await t.event(all, "CHECK");
      t.equal(check.json.MODEL.MAINS, start.json.MODEL.MAINS + 1, "MODEL.MAINS after an app event on the draft a window request left");
    },
  },
  {
    id: "window.count-bounds",
    title: "A count past the rows answers all of them, a count that is no number one window - never an error",
    level: "SHOULD",
    profile: "core",
    spec: `${W}#the-window-request`,
    async run(t) {
      const start = await t.start("WINDOW");
      const past = await request(t, start, 999);
      expectWindow(t, past, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12, "count 999");
      const small = await request(t, past, 1);
      expectWindow(t, small, [1, 2, 3, 4], 12, "count 1 (never fewer than one window)");
      const none = await request(t, small, "abc");
      expectWindow(t, none, [1, 2, 3, 4], 12, "count \"abc\"");
    },
  },
  {
    id: "window.sort",
    title: "A window request with sorters sorts all rows and answers the first window of the new order",
    level: "MUST",
    profile: "core",
    spec: `${W}#sorters-and-filters`,
    async run(t) {
      const start = await t.start("WINDOW");
      const sorted = await request(t, start, 4, QTY_DESC);
      expectWindow(t, sorted, BY_QTY.slice(0, 4), 12, "sorted by QTY descending");
      const two = await request(t, sorted, 4, JSON.stringify([{ PATH: "DONE", DESCENDING: false }, { PATH: "NAME", DESCENDING: true }]));
      expectWindow(t, two, [12, 11, 10, 9], 12, "sorted by DONE, then NAME descending");
    },
  },
  {
    id: "window.filter",
    title: "A window request with filter groups filters all rows: the groups ANDed, the conditions of a group ORed; TOTAL counts the rows let through",
    level: "MUST",
    profile: "core",
    spec: `${W}#sorters-and-filters`,
    async run(t) {
      const start = await t.start("WINDOW");
      const one = await request(t, start, 4, "", JSON.stringify([[["NAME", "Contains", "1"]]]));
      expectWindow(t, one, [1, 10, 11, 12], 4, "NAME Contains 1");
      const groups = await request(t, one, 4, "", JSON.stringify([[["QTY", "GT", 8]], [["NAME", "Contains", "1"], ["ID", "EQ", 5]]]));
      expectWindow(t, groups, [5, 10], 2, "QTY GT 8 AND (NAME Contains 1 OR ID EQ 5)");
      const between = await request(t, groups, 8, "", JSON.stringify([[["QTY", "BT", 3, 6]]]));
      expectWindow(t, between, [1, 6, 9, 11], 4, "QTY BT 3 6");
    },
  },
  {
    id: "window.growth-keeps-order",
    title: "A request for more rows names no order and changes none: the app's sort and filter, and the binding's, stay",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-order-is-the-backends`,
    async run(t) {
      const start = await t.start("WINDOW");
      const app = await t.event(start, "SORT", { args: ["QTY", "X"] });
      expectWindow(t, app, BY_QTY.slice(0, 4), 12, "the app's sort (QTY descending)");
      const grown = await request(t, app, 8);
      expectWindow(t, grown, BY_QTY.slice(0, 8), 12, "more rows after the app's sort");
      const filtered = await t.event(grown, "FILTER", { args: ["1"] });
      expectWindow(t, filtered, [10, 12, 1, 11], 4, "the app's filter (NAME Contains 1)");
      const user = await request(t, filtered, 4, JSON.stringify([{ PATH: "ID", DESCENDING: true }]));
      expectWindow(t, user, [12, 11, 10, 1], 4, "the binding's sort (ID descending) inside the app's filter");
      const again = await request(t, user, 8);
      expectWindow(t, again, [12, 11, 10, 1], 4, "more rows after the binding's sort");
    },
  },
  {
    id: "window.parts-kept-and-cleared",
    title: "A sort or filter part that is missing, empty or null is kept; [] clears it",
    level: "MUST",
    profile: "core",
    spec: `${W}#sorters-and-filters`,
    async run(t) {
      const start = await t.start("WINDOW");
      const sorted = await request(t, start, 4, QTY_DESC);
      const filtered = await request(t, sorted, 4, "", JSON.stringify([[["QTY", "GT", 6]]]));
      expectWindow(t, filtered, [5, 10, 2, 7], 6, "a filter, the sort part empty");
      const nulls = await request(t, filtered, 8, null, null);
      expectWindow(t, nulls, [5, 10, 2, 7, 12, 4], 6, "both parts null");
      const resorted = await request(t, nulls, 4, JSON.stringify([{ PATH: "QTY", DESCENDING: false }]));
      expectWindow(t, resorted, [4, 12, 7, 2], 6, "a sort, the filter part missing");
      const unsorted = await request(t, resorted, 8, "[]");
      expectWindow(t, unsorted, [2, 4, 5, 7, 10, 12], 6, "the sort part [] (the order of the table, the filter kept)");
      const sortedAgain = await request(t, unsorted, 4, QTY_DESC);
      const unfiltered = await request(t, sortedAgain, 4, "", "[]");
      expectWindow(t, unfiltered, BY_QTY.slice(0, 4), 12, "the filter part [] (every row, the sort kept)");
    },
  },
  {
    id: "window.filters-anded",
    title: "The app's filter and the binding's filter are ANDed, and each is replaced or cleared alone",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-order-is-the-backends`,
    async run(t) {
      const start = await t.start("WINDOW");
      const app = await t.event(start, "FILTER", { args: ["1"] });
      expectWindow(t, app, [1, 10, 11, 12], 4, "the app's filter (NAME Contains 1)");
      const both = await request(t, app, 4, "", JSON.stringify([[["QTY", "GT", 5]]]));
      expectWindow(t, both, [10, 12], 2, "the binding's filter (QTY GT 5) on top");
      const replaced = await request(t, both, 4, "", JSON.stringify([[["QTY", "LT", 6]]]));
      expectWindow(t, replaced, [1, 11], 2, "another filter of the binding replaces the binding's alone");
      const appCleared = await t.event(replaced, "FILTER");
      expectWindow(t, appCleared, [1, 3, 6, 8], 5, "the app clears its filter, the binding's stays");
      const appNew = await t.event(appCleared, "FILTER", { args: ["0"] });
      expectWindow(t, appNew, [1, 3, 6, 8], 4, "a new filter of the app (NAME Contains 0), the binding's stays");
      const bindingCleared = await request(t, appNew, 4, "", "[]");
      expectWindow(t, bindingCleared, [1, 2, 3, 4], 10, "the binding clears its filter, the app's stays");
    },
  },
  {
    id: "window.sort-last-set",
    title: "There is one sort: the last one set, by the app or by a window request",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-order-is-the-backends`,
    async run(t) {
      const start = await t.start("WINDOW");
      const app = await t.event(start, "SORT", { args: ["QTY", "X"] });
      expectWindow(t, app, BY_QTY.slice(0, 4), 12, "the app's sort");
      const user = await request(t, app, 4, JSON.stringify([{ PATH: "ID", DESCENDING: true }]));
      expectWindow(t, user, [12, 11, 10, 9], 12, "a sort of the binding replaces the app's");
      const appAgain = await t.event(user, "SORT", { args: ["QTY"] });
      expectWindow(t, appAgain, [8, 3, 11, 6], 12, "a new sort of the app replaces the binding's");
    },
  },
  {
    id: "window.order-with-the-draft",
    title: "The window, the sort, the filter and the rows belong to the draft: a request that continues an earlier draft continues that draft's order",
    level: "MUST",
    profile: "core",
    spec: `${W}#the-order-is-the-backends`,
    async run(t) {
      const start = await t.start("WINDOW");
      const sorted = await request(t, start, 4, QTY_DESC);
      const filtered = await request(t, sorted, 4, "", JSON.stringify([[["QTY", "GT", 8]]]));
      expectWindow(t, filtered, [5, 10, 2, 7], 4, "sorted, then filtered");
      const edited = await t.event(filtered, "CHECK", { model: { T_ROWS: { __delta: { 0: { DONE: true } } } } });
      t.equal(edited.json.MODEL.SUMMARY, "5", "SUMMARY after the edit");
      const earlier = await request(t, sorted, 8);
      expectWindow(t, earlier, BY_QTY.slice(0, 8), 12, "more rows of the draft that was sorted and not yet filtered");
      t.deepEqual(earlier.json.MODEL.T_ROWS.map((row) => row.DONE), Array(8).fill(false), "DONE in the draft before the edit");
      const again = await request(t, sorted, 8);
      expectWindow(t, again, BY_QTY.slice(0, 8), 12, "the same draft once more");
      const first = await request(t, start, 8);
      expectWindow(t, first, [1, 2, 3, 4, 5, 6, 7, 8], 12, "more rows of the first draft (no sort)");
    },
  },
  {
    id: "window.delta-positions",
    title: "A row of a __delta on a windowed table is a position in the order the backend sent, not a row of the table",
    level: "MUST",
    profile: "core",
    spec: `${W}#edits`,
    async run(t) {
      const start = await t.start("WINDOW");
      const sorted = await request(t, start, 4, QTY_DESC);
      const check = await t.event(sorted, "CHECK", { model: { T_ROWS: { __delta: { 0: { DONE: true }, 2: { DONE: true } } } } });
      t.equal(check.json.MODEL.SUMMARY, "2,5", "SUMMARY (positions 0 and 2 of the order QTY descending are the rows with ID 5 and 2)");
      expectWindow(t, check, BY_QTY.slice(0, 4), 12, "the window after the edit");
      t.deepEqual(check.json.MODEL.T_ROWS.map((row) => row.DONE), [true, false, true, false], "DONE of the rows in MODEL.T_ROWS");
      // a window request carries the delta like any event: it is applied in
      // the order the frontend held, before the request changes that order
      const unsorted = await t.event(check, EVENT, { args: [PATH, "12", "[]"], model: { T_ROWS: { __delta: { 1: { DONE: true } } } } });
      expectWindow(t, unsorted, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12, "the sort cleared by the request that carried an edit");
      t.deepEqual(unsorted.json.MODEL.T_ROWS.filter((row) => row.DONE).map((row) => row.ID), [2, 5, 10], "the ID of the rows that are DONE (position 1 of the order QTY descending is the row with ID 10)");
    },
  },
  {
    id: "window.delta-positions-reference",
    title: "A windowed table behind a data reference: the __delta on its * node names positions in the order the backend sent",
    level: "MUST",
    profile: "core",
    spec: `${W}#edits`,
    async run(t) {
      // REF binds MR_WIN, six rows, four at a time, in its own order QTY
      // descending: the IDs 4 1 5 2 6 3
      const start = await t.start("REF");
      const refIds = (r) => (r.json.MODEL && r.json.MODEL.MR_WIN && Array.isArray(r.json.MODEL.MR_WIN["*"]) ? r.json.MODEL.MR_WIN["*"].map((row) => row.ID) : undefined);
      const refState = (r) => r.json.MODEL && r.json.MODEL.__WINDOW && r.json.MODEL.__WINDOW.MR_WIN;
      t.deepEqual(refIds(start), [4, 1, 5, 2], "the ID of the rows in MODEL.MR_WIN[\"*\"] at the start");
      t.deepEqual(refState(start), { "*": { TOTAL: 6, COUNT: 4, SIZE: 4 } }, "MODEL.__WINDOW.MR_WIN at the start");
      const check = await t.event(start, "CHECK", { model: { MR_WIN: { "*": { __delta: { 0: { DONE: true }, 2: { DONE: true } } } } } });
      t.ok(check.json.MODEL && typeof check.json.MODEL.SUMMARY === "string", "MODEL.SUMMARY after CHECK");
      t.equal(check.json.MODEL.SUMMARY, "1:one:,2:two:,3:three:;4,5", "SUMMARY (positions 0 and 2 of the order QTY descending are the rows with ID 4 and 5)");
      t.deepEqual(refIds(check), [4, 1, 5, 2], "the ID of the rows in MODEL.MR_WIN[\"*\"] after the edit");
      t.deepEqual(check.json.MODEL.MR_WIN["*"].map((row) => row.DONE), [true, false, true, false], "DONE of the rows in MODEL.MR_WIN[\"*\"]");
    },
  },
  {
    id: "window.whole-table-refused",
    title: "A windowed table sent back whole is not written - the window never replaces the table",
    level: "MUST",
    profile: "core",
    spec: `${W}#edits`,
    async run(t) {
      const start = await t.start("WINDOW");
      const check = await t.event(start, "CHECK", { model: { T_ROWS: [{ ID: 99, NAME: "only", QTY: 1, DONE: true }] } });
      t.equal(check.json.MODEL.SUMMARY, "", "SUMMARY");
      expectWindow(t, check, [1, 2, 3, 4], 12, "the window after a whole table was sent");
    },
  },
  {
    id: "window.unknown-path-ignored",
    title: "A window request for a path that is no windowed table changes nothing and is no error",
    level: "SHOULD",
    profile: "core",
    spec: `${W}#the-window-request`,
    async run(t) {
      const start = await t.start("WINDOW");
      const other = await t.event(start, EVENT, { args: ["/SUMMARY", "8"] });
      if (other.json.MODEL) expectWindow(t, other, [1, 2, 3, 4], 12, "a window request for /SUMMARY");
      const check = await t.event(other, "CHECK");
      expectWindow(t, check, [1, 2, 3, 4], 12, "the window afterwards");
      t.equal(check.json.MODEL.MAINS, start.json.MODEL.MAINS + 1, "MODEL.MAINS (the request must not run main( ))");
    },
  },
];
