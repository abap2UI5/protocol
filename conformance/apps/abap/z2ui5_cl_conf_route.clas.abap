" Conformance app ROUTE - hash routing: switches the KEEP mode on in its
" first roundtrip, so every response carries the ROUTER intent, and calls
" Z2UI5_CL_CONF_NAV_TGT to show the history push of a nav_app_call.
" Behaviour: conformance/apps/README.md, section ROUTE.
CLASS z2ui5_cl_conf_route DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA count TYPE i.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_route IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.
    IF client->check_on_init( ).
      client->follow_up_action( val   = z2ui5_if_client=>cs_event-hash_routing
                                t_arg = VALUE #( ( z2ui5_if_client=>cs_nav_mode-keep ) ) ).
    ENDIF.
    IF client->check_on_navigated( ).
      view_display( ).
      RETURN.
    ENDIF.

    CASE client->get_event( ).
      WHEN `COUNT`.
        count = count + 1.
      WHEN `CALL`.
        DATA(lo_call) = NEW z2ui5_cl_conf_nav_tgt( ).
        lo_call->input = `from route`.
        client->nav_app_call( lo_call ).
    ENDCASE.

  ENDMETHOD.

  METHOD view_display.

    DATA(view) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`     v = `sap.m`
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc`

            )->ele( `Page`
                )->a( n = `title` v = `conformance - route`

                )->tag( `Text`
                    )->a( n = `id`   v = `count`
                    )->a( n = `text` v = client->_bind( count )
                )->tag( `Button`
                    )->a( n = `text`  v = `Count`
                    )->a( n = `press` v = client->_event( `COUNT` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Call`
                    )->a( n = `press` v = client->_event( `CALL` ) ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

ENDCLASS.
