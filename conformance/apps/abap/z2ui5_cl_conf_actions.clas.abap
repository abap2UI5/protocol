" Conformance app ACTIONS - follow-up actions: what an app queues for the
" frontend to do once the view is rendered (T_CUSTOM), in the order it
" queued them, and a frontend event wired into the view. Behaviour:
" conformance/apps/README.md, section ACTIONS.
CLASS z2ui5_cl_conf_actions DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA ticks TYPE i.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.
    METHODS on_event.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_actions IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.
    IF client->check_on_navigated( ).
      view_display( ).
    ELSEIF client->check_on_event( ).
      on_event( ).
    ENDIF.

  ENDMETHOD.

  METHOD view_display.

    DATA(view) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`     v = `sap.m`
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc`

            )->ele( `Page`
                )->a( n = `title` v = `conformance - actions`

                )->tag( `Input`
                    )->a( n = `id`    v = `inp`
                    )->a( n = `value` v = client->_bind( ticks )
                )->tag( `Button`
                    )->a( n = `text`  v = `Focus`
                    )->a( n = `press` v = client->_event( `FOCUS` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Several`
                    )->a( n = `press` v = client->_event( `SEVERAL` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Timer`
                    )->a( n = `press` v = client->_event( `TIMER` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Title here`
                    )->a( n = `press` v = client->follow_up_action( val   = z2ui5_if_client=>cs_event-set_title
                                                                   t_arg = VALUE #( ( `wired title` ) ) ) ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD on_event.

    CASE client->get_event( ).
      WHEN `FOCUS`.
        client->follow_up_action( val   = z2ui5_if_client=>cs_event-set_focus
                                  t_arg = VALUE #( ( `inp` ) ) ).
      WHEN `SEVERAL`.
        " three actions of two kinds - they must arrive in this order
        client->follow_up_action( val   = z2ui5_if_client=>cs_event-set_title
                                  t_arg = VALUE #( ( `conformance title` ) ) ).
        client->message_toast_display( `between` ).
        client->follow_up_action( val   = z2ui5_if_client=>cs_event-set_focus
                                  t_arg = VALUE #( ( `inp` ) ) ).
      WHEN `TIMER`.
        client->follow_up_action( val   = z2ui5_if_client=>cs_event-start_timer
                                  t_arg = VALUE #( ( `TICK` ) ( `500` ) ) ).
      WHEN `TICK`.
        ticks = ticks + 1.
    ENDCASE.

  ENDMETHOD.

ENDCLASS.
