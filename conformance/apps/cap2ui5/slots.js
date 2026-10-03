// Conformance app SLOTS - the cap2UI5 equivalent of
// conformance/apps/abap/z2ui5_cl_conf_slots.clas.abap.
// Behaviour: conformance/apps/README.md, section SLOTS.
const { defineApp } = require("@cap2ui5/cds-plugin");

defineApp("Z2UI5_CL_CONF_SLOTS", class {
  popup_text = "";

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
      `<Page title="conformance - slots">` +
      `<Button id="btn_popup" text="Popup" press="${client._event("POPUP_OPEN")}"/>` +
      `<Button id="btn_popover" text="Popover" press="${client._event("POPOVER_OPEN")}"/>` +
      `<Button text="Nest" press="${client._event("NEST_OPEN")}"/>` +
      `<Button text="Nest2" press="${client._event("NEST2_OPEN")}"/>` +
      `<VBox id="nest_anchor"/><VBox id="nest2_anchor"/>` +
      `</Page></mvc:View>`);
  }

  on_event(client) {
    switch (client.get_event()) {
      case "POPUP_OPEN":
        this.popup_display(client, "conformance popup");
        break;
      case "POPUP_REPLACE":
        // two displays of one slot in one roundtrip - the last one counts
        this.popup_display(client, "first");
        this.popup_display(client, "second");
        break;
      case "POPUP_CLOSE":
        client.popup_destroy();
        break;
      case "MAIN_AND_POPUP":
        // called in the reverse of the slot order on purpose
        this.popup_display(client, "with main");
        this.view_display(client);
        break;
      case "POPOVER_OPEN":
        client.popover_display({
          xml: `<core:FragmentDefinition xmlns="sap.m" xmlns:core="sap.ui.core">` +
            `<Popover title="conformance popover">` +
            `<Button text="Close" press="${client._event("POPOVER_CLOSE")}"/>` +
            `</Popover></core:FragmentDefinition>`,
          by_id: "btn_popover",
        });
        break;
      case "POPOVER_CLOSE":
        client.popover_destroy();
        break;
      case "NEST_OPEN":
        client.nest_view_display({
          val: this.nest_xml(client, "NEST"), id: "nest_anchor",
          method_insert: "addItem", method_destroy: "removeAllItems",
        });
        break;
      case "NEST_CLOSE":
        client.nest_view_destroy();
        break;
      case "NEST2_OPEN":
        client.nest2_view_display({
          val: this.nest_xml(client, "NEST2"), id: "nest2_anchor",
          method_insert: "addItem", method_destroy: "removeAllItems",
        });
        break;
      case "NEST2_CLOSE":
        client.nest2_view_destroy();
        break;
      default:
    }
  }

  popup_display(client, title) {
    client.popup_display(
      `<core:FragmentDefinition xmlns="sap.m" xmlns:core="sap.ui.core">` +
      `<Dialog title="${title}">` +
      `<Input id="popup_text" value="${client._bind("popup_text")}"/>` +
      `<buttons>` +
      `<Button text="Close" press="${client._event("POPUP_CLOSE")}"/>` +
      `<Button text="Close here" press="${client.follow_up_action(client.cs_event.popup_close)}"/>` +
      `</buttons></Dialog></core:FragmentDefinition>`);
  }

  nest_xml(client, slot) {
    return `<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc"><VBox>` +
      `<Text text="conformance ${slot}"/>` +
      `<Button text="Close" press="${client._event(`${slot}_CLOSE`)}"/>` +
      `</VBox></mvc:View>`;
  }
});
