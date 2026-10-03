// Conformance app ACTIONS - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_actions.clas.abap.
// Behaviour: conformance/apps/README.md, section ACTIONS.
const { defineApp } = require("@cap2ui5/cds-plugin");

defineApp("Z2UI5_CL_CONF_ACTIONS", class {
  ticks = 0;

  main(client) {
    if (client.check_on_navigated()) {
      client.view_display(
        `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc">` +
        `<Page title="conformance - actions">` +
        `<Input id="inp" value="${client._bind("ticks")}"/>` +
        `<Button text="Focus" press="${client._event("FOCUS")}"/>` +
        `<Button text="Several" press="${client._event("SEVERAL")}"/>` +
        `<Button text="Timer" press="${client._event("TIMER")}"/>` +
        `<Button text="Title here" press="${client.follow_up_action({ val: client.cs_event.set_title, t_arg: ["wired title"] })}"/>` +
        `</Page></mvc:View>`);
      return;
    }
    switch (client.get_event()) {
      case "FOCUS":
        client.follow_up_action({ val: client.cs_event.set_focus, t_arg: ["inp"] });
        break;
      case "SEVERAL":
        // three actions of two kinds - they must arrive in this order
        client.follow_up_action({ val: client.cs_event.set_title, t_arg: ["conformance title"] });
        client.message_toast_display("between");
        client.follow_up_action({ val: client.cs_event.set_focus, t_arg: ["inp"] });
        break;
      case "TIMER":
        client.follow_up_action({ val: client.cs_event.start_timer, t_arg: ["TICK", "500"] });
        break;
      case "TICK":
        this.ticks += 1;
        break;
      default:
    }
  }
});
