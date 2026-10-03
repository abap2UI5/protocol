" Conformance app NAV - the app stack: CALL hands the screen to
" Z2UI5_CL_CONF_NAV_TGT, which hands it back with a result (event RETURNED)
" or without one (the reserved leave event). Behaviour:
" conformance/apps/README.md, section NAV.
CLASS z2ui5_cl_conf_nav DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA result  TYPE string.
    DATA returns TYPE i.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_nav IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.

    IF client->check_on_navigated( ).
      " a return WITH a result arrives as the event RETURNED (named by the
      " target's nav_app_leave) on a navigated roundtrip - read it, then render
      IF client->get_event( ) = `RETURNED`.
        DATA(lo_target) = CAST z2ui5_cl_conf_nav_tgt( client->get_app_prev( ) ).
        result  = lo_target->output.
        returns = returns + 1.
      ENDIF.
      view_display( ).
    ELSEIF client->check_on_event( `CALL` ).
      DATA(lo_call) = NEW z2ui5_cl_conf_nav_tgt( ).
      lo_call->input = `from caller`.
      client->nav_app_call( lo_call ).
    ENDIF.

  ENDMETHOD.

  METHOD view_display.

    DATA(view) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`     v = `sap.m`
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc`

            )->ele( `Page`
                )->a( n = `title` v = `conformance - nav caller`

                )->tag( `Text`
                    )->a( n = `id`   v = `result`
                    )->a( n = `text` v = client->_bind( result )
                )->tag( `Text`
                    )->a( n = `id`   v = `returns`
                    )->a( n = `text` v = client->_bind( returns )
                )->tag( `Button`
                    )->a( n = `text`  v = `Call`
                    )->a( n = `press` v = client->_event( `CALL` ) ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

ENDCLASS.
