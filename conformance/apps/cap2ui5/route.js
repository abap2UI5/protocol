// Conformance app ROUTE - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_route.clas.abap.
// Behaviour: conformance/apps/README.md, section ROUTE.
const { defineApp } = require("@cap2ui5/cds-plugin");

defineApp("Z2UI5_CL_CONF_ROUTE", class {
  count = 0;

  main(client) {
    if (client.check_on_init()) {
      client.follow_up_action({ val: client.cs_event.hash_routing, t_arg: [client.cs_nav_mode.keep] });
    }
    if (client.check_on_navigated()) {
      client.view_display(
        `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
        `<Page title="conformance - route">` +
        `<Text id="count" text="${client._bind("count")}"/>` +
        `<Button text="Count" press="${client._event("COUNT")}"/>` +
        `<Button text="Call" press="${client._event("CALL")}"/>` +
        `</Page></mvc:View>`);
      return;
    }
    switch (client.get_event()) {
      case "COUNT":
        this.count += 1;
        break;
      case "CALL":
        client.nav_app_call("Z2UI5_CL_CONF_NAV_TGT", { input: "from route" });
        break;
      default:
    }
  }
});
