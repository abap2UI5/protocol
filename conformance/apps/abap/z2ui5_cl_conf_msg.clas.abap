" Conformance app MSG - messages: a toast, an error box, and a confirm box
" whose closing raises a backend event with the pressed action as its
" argument. Behaviour: conformance/apps/README.md, section MSG.
CLASS z2ui5_cl_conf_msg DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA last_action TYPE string.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.
    METHODS on_event.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_msg IMPLEMENTATION.

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
                )->a( n = `title` v = `conformance - messages`

                )->tag( `Text`
                    )->a( n = `id`   v = `last_action`
                    )->a( n = `text` v = client->_bind( last_action )
                )->tag( `Button`
                    )->a( n = `text`  v = `Toast`
                    )->a( n = `press` v = client->_event( `TOAST` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Box`
                    )->a( n = `press` v = client->_event( `BOX` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Confirm`
                    )->a( n = `press` v = client->_event( `BOX_CONFIRM` ) ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD on_event.

    CASE client->get_event( ).
      WHEN `TOAST`.
        client->message_toast_display( `conformance toast` ).
      WHEN `BOX`.
        client->message_box_display( text = `conformance box`
                                     type = `error` ).
      WHEN `BOX_CONFIRM`.
        client->message_box_display( text    = `conformance confirm`
                                     type    = `confirm`
                                     onclose = `BOX_CLOSED`
                                     actions = VALUE #( ( `OK` ) ( `CANCEL` ) ) ).
      WHEN `BOX_CLOSED`.
        last_action = client->get_event_arg( ).
    ENDCASE.

  ENDMETHOD.

ENDCLASS.
