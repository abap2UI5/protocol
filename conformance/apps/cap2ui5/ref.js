// Conformance app REF - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_ref.clas.abap.
// Behaviour: conformance/apps/README.md, section REF.
// t.ref( ) - a field TYPE REF TO data, bound dereferenced as "mr_tab->*" -
// came with @cap2ui5/cds-plugin 0.7.0. On a plugin without it the app is
// registered all the same and its start fails, naming why - a declaration
// with t.ref( ) would throw while the module loads, and take every other
// app of the host with it.
const { defineApp, t } = require("@cap2ui5/cds-plugin");

const NO_REF = "Z2UI5_CL_CONF_REF: this @cap2ui5/cds-plugin has no t.ref( ) - a field TYPE REF TO data needs a later one";

class NoRef {
  main() {
    throw new Error(NO_REF);
  }
}

defineApp("Z2UI5_CL_CONF_REF", typeof t.ref !== "function" ? NoRef : class {
  mr_tab = t.ref(t.table({ id: 0, text: "", done: false }));
  mr_win = t.ref(t.table({ id: 0, qty: 0, done: false }));
  summary = "";

  main(client) {
    if (client.check_on_init()) {
      this.model_init();
      this.view_display(client);
    } else if (client.check_on_navigated()) {
      this.view_display(client);
    } else if (client.check_on_event() && client.get_event() === "CHECK") {
      this.summary_build();
    }
  }

  view_display(client) {
    client.view_display(
      `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
      `<Page title="conformance - ref">` +
      `<Text id="summary" text="${client._bind("summary")}"/>` +
      `<Button text="Check" press="${client._event("CHECK")}"/>` +
      `<Table id="items" items="${client._bind("mr_tab->*")}">` +
      `<columns><Column/><Column/><Column/></columns>` +
      `<items><ColumnListItem><cells>` +
      `<Text text="{ID}"/><Input value="{TEXT}"/><CheckBox selected="{DONE}"/>` +
      `</cells></ColumnListItem></items></Table>` +
      `<Table id="rows" growing="true" growingThreshold="4" items="${client.window_bind_tab({ val: "mr_win->*", window: 4, t_sort: [{ path: "qty", descending: true }] })}">` +
      `<columns><Column/><Column/><Column/></columns>` +
      `<items><ColumnListItem><cells>` +
      `<Text text="{ID}"/><Text text="{QTY}"/><CheckBox selected="{DONE}"/>` +
      `</cells></ColumnListItem></items></Table>` +
      `</Page></mvc:View>`);
  }

  summary_build() {
    this.summary = this.mr_tab.map((r) => `${r.id}:${r.text}:${r.done ? "X" : ""}`).join(",") + ";" +
      this.mr_win.filter((r) => r.done).map((r) => r.id).join(",");
  }

  model_init() {
    this.mr_tab = [{ id: 1, text: "one" }, { id: 2, text: "two" }, { id: 3, text: "three" }];
    // QTY runs in another order than ID: 5 3 1 6 4 2
    this.mr_win = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, qty: ((i + 1) * 5) % 7, done: false }));
  }
});
