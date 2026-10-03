// Conformance apps NAV and NAV_TGT - the cap2UI5 equivalents of
// conformance/apps/abap/z2ui5_cl_conf_nav.clas.abap and
// z2ui5_cl_conf_nav_tgt.clas.abap.
// Behaviour: conformance/apps/README.md, section NAV.
const { defineApp } = require("@cap2ui5/cds-plugin");

const TARGET = "Z2UI5_CL_CONF_NAV_TGT";

defineApp("Z2UI5_CL_CONF_NAV", class {
  result = "";
  returns = 0;

  main(client) {
    if (client.check_on_navigated()) {
      // a return WITH a result arrives as the event RETURNED (named by the
      // target's nav_app_leave) on a navigated roundtrip - read it, then render
      if (client.get_event() === "RETURNED") {
        this.result = client.get_app_prev().output;
        this.returns += 1;
      }
      client.view_display(
        `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
        `<Page title="conformance - nav caller">` +
        `<Text id="result" text="${client._bind("result")}"/>` +
        `<Text id="returns" text="${client._bind("returns")}"/>` +
        `<Button text="Call" press="${client._event("CALL")}"/>` +
        `</Page></mvc:View>`);
      return;
    }
    if (client.get_event() === "CALL") {
      client.nav_app_call(TARGET, { input: "from caller" });
    }
  }
});

defineApp(TARGET, class {
  input = "";
  output = "";
  has_prev = false;

  main(client) {
    if (client.check_on_navigated()) {
      this.has_prev = client.check_app_prev_stack();
      client.view_display(
        `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
        `<Page title="conformance - nav target" showNavButton="${this.has_prev}" ` +
        `navButtonPress="${client._event_nav_app_leave()}">` +
        `<Text id="input" text="${client._bind("input")}"/>` +
        `<Text id="output" text="${client._bind("output")}"/>` +
        `<Button text="Done" press="${client._event("DONE")}"/>` +
        `</Page></mvc:View>`);
      return;
    }
    if (client.get_event() === "DONE") {
      this.output = `${this.input}!`;
      client.nav_app_leave({ event: "RETURNED" });
    }
  }
});
