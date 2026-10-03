// Conformance app MSG - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_msg.clas.abap.
// Behaviour: conformance/apps/README.md, section MSG.
const { defineApp } = require("@cap2ui5/cds-plugin");

defineApp("Z2UI5_CL_CONF_MSG", class {
  last_action = "";

  main(client) {
    if (client.check_on_navigated()) {
      client.view_display(
        `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
        `<Page title="conformance - messages">` +
        `<Text id="last_action" text="${client._bind("last_action")}"/>` +
        `<Button text="Toast" press="${client._event("TOAST")}"/>` +
        `<Button text="Box" press="${client._event("BOX")}"/>` +
        `<Button text="Confirm" press="${client._event("BOX_CONFIRM")}"/>` +
        `</Page></mvc:View>`);
      return;
    }
    switch (client.get_event()) {
      case "TOAST":
        client.message_toast_display("conformance toast");
        break;
      case "BOX":
        client.message_box_display({ text: "conformance box", type: "error" });
        break;
      case "BOX_CONFIRM":
        client.message_box_display({
          text: "conformance confirm", type: "confirm", onclose: "BOX_CLOSED", actions: ["OK", "CANCEL"],
        });
        break;
      case "BOX_CLOSED":
        this.last_action = client.get_event_arg();
        break;
      default:
    }
  }
});
