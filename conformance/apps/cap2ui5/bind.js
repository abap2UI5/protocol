// Conformance app BIND - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_bind.clas.abap.
// Behaviour: conformance/apps/README.md, section BIND.
const { defineApp, t } = require("@cap2ui5/cds-plugin");

const X = (b) => (b ? "X" : "");

defineApp("Z2UI5_CL_CONF_BIND", class {
  name = "";
  qty = 0;
  flag = false;
  s_addr = { city: "", zip: "" };
  t_items = t.table({ id: 0, text: "", done: false });
  summary = "";

  main(client) {
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
      `<Page title="conformance - bind">` +
      `<Input id="name" value="${client._bind("name")}"/>` +
      `<StepInput id="qty" value="${client._bind("qty")}"/>` +
      `<CheckBox id="flag" text="Flag" selected="${client._bind("flag")}"/>` +
      `<Input id="city" value="${client._bind("s_addr-city")}"/>` +
      `<Input id="zip" value="${client._bind("s_addr-zip")}"/>` +
      `<Text id="summary" text="${client._bind("summary")}"/>` +
      `<Button text="Check" press="${client._event("CHECK")}"/>` +
      `<Button text="Add row" press="${client._event("ADD_ROW")}"/>` +
      `<Table id="items" items="${client._bind("t_items")}">` +
      `<columns><Column/><Column/><Column/></columns>` +
      `<items><ColumnListItem><cells>` +
      `<Text text="{ID}"/><Input value="{TEXT}"/><CheckBox selected="{DONE}"/>` +
      `</cells></ColumnListItem></items></Table>` +
      `</Page></mvc:View>`);
  }

  on_event(client) {
    switch (client.get_event()) {
      case "CHECK":
        this.summary_build();
        break;
      case "ADD_ROW":
        this.t_items = [...this.t_items, { id: this.t_items.length + 1, text: "new", done: false }];
        this.summary_build();
        break;
      default:
    }
  }

  summary_build() {
    const rows = this.t_items.map((r) => `${r.id}:${r.text}:${X(r.done)}`);
    this.summary = `${this.name};${this.qty};${X(this.flag)};${this.s_addr.city};${this.s_addr.zip};` +
      rows.join(",");
  }

  model_init() {
    this.name = "start";
    this.qty = 1;
    this.s_addr = { city: "Berlin", zip: "10115" };
    this.t_items = [
      { id: 1, text: "one", done: false },
      { id: 2, text: "two", done: false },
      { id: 3, text: "three", done: false },
    ];
  }
});
