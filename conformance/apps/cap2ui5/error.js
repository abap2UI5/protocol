// Conformance app ERROR - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_error.clas.abap.
// Behaviour: conformance/apps/README.md, section ERROR.
const { defineApp } = require("@cap2ui5/cds-plugin");

defineApp("Z2UI5_CL_CONF_ERROR", class {
  count = 0;

  main(client) {
    if (client.check_on_navigated()) {
      client.view_display(
        `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
        `<Page title="conformance - error">` +
        `<Text id="count" text="${client._bind("count")}"/>` +
        `<Button text="Fail" press="${client._event("FAIL")}"/>` +
        `<Button text="Count" press="${client._event("COUNT")}"/>` +
        `</Page></mvc:View>`);
      return;
    }
    switch (client.get_event()) {
      case "FAIL":
        this.count += 1;
        throw new Error("CONFORMANCE_FAILURE");
      case "COUNT":
        this.count += 1;
        break;
      default:
    }
  }
});
