// Conformance app WINDOW - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_window.clas.abap.
// Behaviour: conformance/apps/README.md, section WINDOW.
// client.window_bind_tab( ) is abap2UI5's of 1.149.0 (@cap2ui5/cds-plugin
// from 0.6.0 on): a plugin that hosts an older runtime has no such method,
// and the app's start fails there.
const { defineApp, t } = require("@cap2ui5/cds-plugin");

defineApp("Z2UI5_CL_CONF_WINDOW", class {
  t_rows = t.table({ id: 0, name: "", qty: 0, done: false });
  summary = "";
  mains = 0;
  t_sort = t.table({ path: "", descending: false });
  t_filter = t.table({ group: 0, path: "", operator: "", value1: "", value2: "" });

  main(client) {
    this.mains += 1;
    if (client.check_on_init()) {
      this.model_init();
      this.view_display(client);
    } else if (client.check_on_navigated()) {
      this.view_display(client);
    } else if (client.check_on_event()) {
      this.on_event(client);
    }
  }

  view_display(client) {
    client.view_display(
      `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
      `<Page title="conformance - window">` +
      `<Text id="summary" text="${client._bind("summary")}"/>` +
      `<Text id="mains" text="${client._bind("mains")}"/>` +
      `<Button text="Check" press="${client._event("CHECK")}"/>` +
      `<Button text="Sort" press="${client._event({ val: "SORT", t_arg: ["QTY", "X"] })}"/>` +
      `<Button text="Filter" press="${client._event({ val: "FILTER", t_arg: ["1"] })}"/>` +
      `<Button text="Render" press="${client._event("RERENDER")}"/>` +
      `<Button text="Sort list" press="${client.follow_up_action({ val: client.cs_event.binding_call, t_arg: ["rows", "items", "sort", "QTY", "X"] })}"/>` +
      `<Button text="Filter list" press="${client.follow_up_action({ val: client.cs_event.binding_call, t_arg: ["rows", "items", "filter", "NAME", "Contains", "1"] })}"/>` +
      `<Table id="rows" growing="true" growingThreshold="4" items="${this.window_bind(client)}">` +
      `<columns><Column/><Column/><Column/><Column/></columns>` +
      `<items><ColumnListItem><cells>` +
      `<Text text="{ID}"/><Text text="{NAME}"/><Text text="{QTY}"/><CheckBox selected="{DONE}"/>` +
      `</cells></ColumnListItem></items></Table>` +
      `</Page></mvc:View>`);
  }

  on_event(client) {
    switch (client.get_event()) {
      case "CHECK":
        this.summary = this.t_rows.filter((r) => r.done).map((r) => r.id).join(",");
        break;
      case "SORT":
        // the app's own order, over all rows: no view, the model alone
        // carries the first window of it
        this.t_sort = client.get_event_arg(1)
          ? [{ path: client.get_event_arg(1), descending: client.get_event_arg(2) !== "" }]
          : [];
        this.window_bind(client);
        break;
      case "FILTER":
        this.t_filter = client.get_event_arg(1)
          ? [{ group: 1, path: "NAME", operator: "Contains", value1: client.get_event_arg(1), value2: "" }]
          : [];
        this.window_bind(client);
        break;
      case "RERENDER":
        this.view_display(client);
        break;
      default:
    }
  }

  window_bind(client) {
    return client.window_bind_tab({ val: "t_rows", window: 4, t_sort: this.t_sort, t_filter: this.t_filter });
  }

  model_init() {
    // QTY runs in another order than ID: 5 10 2 7 12 4 9 1 6 11 3 8
    this.t_rows = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, name: `item ${String(i + 1).padStart(2, "0")}`, qty: ((i + 1) * 5) % 13, done: false }));
  }
});
