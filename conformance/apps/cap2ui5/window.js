// Conformance app WINDOW - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_window.clas.abap.
// Behaviour: conformance/apps/README.md, section WINDOW.
// client.window_bind_tab( { val, total, event, window } ) is the app-driven
// windowed table of abap2UI5 after 1.149.0 (branch DEV): the app loads the
// rows itself, the list binding's requests arrive as its event ROWS with
// the request in client.get( ).r_event_data. @cap2ui5/cds-plugin 0.6.0
// hosts the runtime 1.149.0, whose window_bind_tab( ) takes val, window,
// t_sort and t_filter: it refuses `total` and `event`, and the app's start
// fails there (conformance/RESULTS.md, windowed tables). val and total name
// fields, as val does for _bind( ) - the binding of total is the plugin's
// to decide once it hosts a runtime with the app-driven window.
const { defineApp, t } = require("@cap2ui5/cds-plugin");

const ROW = { id: 0, name: "", qty: 0, done: false };

/** digits only - anything else is 0 */
const num = (v) => {
  const s = String(v ?? "").trim();
  return s !== "" && /^[0-9]+$/.test(s) && s.length <= 9 ? Number(s) : 0;
};

defineApp("Z2UI5_CL_CONF_WINDOW", class {
  t_rows = t.table(ROW);
  total = 0;
  summary = "";
  mains = 0;
  last = "";
  request = "";
  // all rows; t_rows holds the ones loaded so far
  t_db = t.table(ROW);
  // the order of the list - what the last SORT or FILTER request named
  t_sort = t.table({ path: "", descending: false });
  t_filter = t.table({ group: 0, path: "", operator: "", value1: "", value2: "" });

  main(client) {
    this.mains += 1;
    if (client.check_on_init()) {
      this.model_init();
      this.view_display(client);
    } else if (client.check_on_navigated()) {
      this.view_display(client);
    } else {
      this.on_event(client);
    }
  }

  view_display(client) {
    const rows = client.window_bind_tab({ val: "t_rows", total: "total", event: "ROWS", window: 4 });
    client.view_display(
      `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
      `<Page title="conformance - window">` +
      `<Text id="summary" text="${client._bind("summary")}"/>` +
      `<Text id="mains" text="${client._bind("mains")}"/>` +
      `<Text id="last" text="${client._bind("last")}"/>` +
      `<Text id="request" text="${client._bind("request")}"/>` +
      `<Button text="Check" press="${client._event("CHECK")}"/>` +
      `<Button text="Sort list" press="${client.follow_up_action({ val: client.cs_event.binding_call, t_arg: ["rows", "items", "sort", "QTY", "X"] })}"/>` +
      `<Button text="Filter list" press="${client.follow_up_action({ val: client.cs_event.binding_call, t_arg: ["rows", "items", "filter", "NAME", "Contains", "1"] })}"/>` +
      `<Table id="rows" growing="true" growingThreshold="4" items="${rows}">` +
      `<columns><Column/><Column/><Column/><Column/></columns>` +
      `<items><ColumnListItem><cells>` +
      `<Text text="{ID}"/><Text text="{NAME}"/><Text text="{QTY}"/><CheckBox selected="{DONE}"/>` +
      `</cells></ColumnListItem></items></Table>` +
      `</Page></mvc:View>`);
  }

  on_event(client) {
    const got = client.get();
    this.last = [got.event, ...(got.t_event_arg || [])].join(" ");
    switch (client.get_event()) {
      case "ROWS":
        this.on_window(got.r_event_data);
        break;
      case "CHECK":
        this.summary = this.t_rows.filter((r) => r.done).map((r) => r.id).join(",");
        break;
      case "TOTAL":
        this.total = num(client.get_event_arg());
        break;
      default:
    }
  }

  on_window(req) {
    if (!req) {
      this.request = "no request";
      return;
    }
    this.request = this.request_text(req);
    if (req.path !== "/T_ROWS") return;
    // what the user ticked in the rows loaded so far stays when they are
    // loaded anew
    for (const row of this.t_rows) {
      const kept = this.t_db.find((r) => r.id === row.id);
      if (kept) kept.done = row.done;
    }
    if (req.reason === "MORE") {
      this.load(req.skip, req.top);
    } else {
      // SORT and FILTER carry the whole state of the columns
      this.t_sort = req.t_sort || [];
      this.t_filter = req.t_filter || [];
      this.load(0, req.top);
    }
  }

  load(skip, top) {
    // the rows the filter lets through, in the order of the sort (stable)
    const hit = this.t_db.filter((row) => this.passes(row));
    hit.sort((a, b) => this.compare(a, b));
    this.total = hit.length;
    // the first skip rows stay, top rows of the order follow them
    const at = Math.min(skip, this.t_rows.length);
    this.t_rows = [...this.t_rows.slice(0, at), ...hit.slice(at, at + top)].map((row) => ({ ...row }));
  }

  passes(row) {
    // the conditions of one group ORed, the groups ANDed
    const groups = new Map();
    for (const cond of this.t_filter) {
      groups.set(cond.group, (groups.get(cond.group) || false) || this.cond_check(row, cond));
    }
    return [...groups.values()].every(Boolean);
  }

  cond_check(row, cond) {
    if (cond.path === "NAME") {
      const text = row.name.toUpperCase();
      const value = String(cond.value1).toUpperCase();
      if (cond.operator === "Contains") return text.includes(value);
      if (cond.operator === "EQ") return text === value;
      return false;
    }
    const n = cond.path === "ID" ? row.id : cond.path === "QTY" ? row.qty : undefined;
    if (n === undefined) return false;
    switch (cond.operator) {
      case "EQ": return n === num(cond.value1);
      case "GT": return n > num(cond.value1);
      case "LT": return n < num(cond.value1);
      case "BT": return n >= num(cond.value1) && n <= num(cond.value2);
      default: return false;
    }
  }

  compare(a, b) {
    // the first sorter that tells the two rows apart decides
    for (const s of this.t_sort) {
      let cmp = 0;
      if (s.path === "ID") cmp = Math.sign(a.id - b.id);
      else if (s.path === "QTY") cmp = Math.sign(a.qty - b.qty);
      else if (s.path === "NAME") cmp = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      if (cmp !== 0) return s.descending ? -cmp : cmp;
    }
    return 0;
  }

  request_text(req) {
    // path reason skip top, then S:<path>:<A|D> per sorter and
    // F<group>:<path>:<operator>:<value1>:<value2> per condition
    return [
      `${req.path} ${req.reason} ${req.skip} ${req.top}`,
      ...(req.t_sort || []).map((s) => `S:${s.path}:${s.descending ? "D" : "A"}`),
      ...(req.t_filter || []).map((c) => `F${c.group}:${c.path}:${c.operator}:${c.value1}:${c.value2}`),
    ].join(" ");
  }

  model_init() {
    // QTY runs in another order than ID: 5 10 2 7 12 4 9 1 6 11 3 8
    this.t_db = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, name: `item ${String(i + 1).padStart(2, "0")}`, qty: ((i + 1) * 5) % 13, done: false }));
    this.load(0, 4);
  }
});
