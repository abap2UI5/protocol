// Conformance app ECHO - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_echo.clas.abap.
// Behaviour: conformance/apps/README.md, section ECHO.
const { defineApp } = require("@cap2ui5/cds-plugin");

defineApp("Z2UI5_CL_CONF_ECHO", class {
  count = 0;
  last_event = "";
  last_args = "";

  main(client) {
    if (client.check_on_navigated()) {
      this.view_display(client);
    } else if (client.check_on_event()) {
      this.on_event(client);
    }
  }

  view_display(client) {
    client.view_display(
      `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
      `<Page title="conformance - echo">` +
      `<Text id="count" text="${client._bind("count")}"/>` +
      `<Text id="last_event" text="${client._bind("last_event")}"/>` +
      `<Text id="last_args" text="${client._bind("last_args")}"/>` +
      `<Button text="Echo" press="${client._event({ val: "ECHO", t_arg: ["alpha", "beta"] })}"/>` +
      `<Button text="Nothing" press="${client._event("NOOP")}"/>` +
      `<Button text="Push" press="${client._event("PUSH")}"/>` +
      `<Button text="Render" press="${client._event("RERENDER")}"/>` +
      `</Page></mvc:View>`);
  }

  on_event(client) {
    switch (client.get_event()) {
      case "ECHO":
        this.count += 1;
        this.last_event = client.get_event();
        this.last_args = client.get().t_event_arg.join("|");
        break;
      case "PUSH":
        this.count += 100;
        break;
      case "RERENDER":
        this.view_display(client);
        break;
      default:
        // NOOP and every unknown event: nothing bound changes
    }
  }
});
