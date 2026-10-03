" Conformance app SLOTS - the four view slots besides MAIN: a popup, a
" popover anchored to a button, and the two nested views, each opened and
" closed by a backend event. Behaviour: conformance/apps/README.md,
" section SLOTS.
CLASS z2ui5_cl_conf_slots DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA popup_text TYPE string.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.
    METHODS on_event.
    METHODS popup_display
      IMPORTING
        title TYPE string.
    METHODS popover_display.
    METHODS nest_display
      IMPORTING
        slot TYPE string.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_slots IMPLEMENTATION.

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
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc` ).

    DATA(page) = view->ele( `Page`
        )->a( n = `title` v = `conformance - slots` ).

    page->tag( `Button`
        )->a( n = `id`    v = `btn_popup`
        )->a( n = `text`  v = `Popup`
        )->a( n = `press` v = client->_event( `POPUP_OPEN` )
    )->tag( `Button`
        )->a( n = `id`    v = `btn_popover`
        )->a( n = `text`  v = `Popover`
        )->a( n = `press` v = client->_event( `POPOVER_OPEN` )
    )->tag( `Button`
        )->a( n = `text`  v = `Nest`
        )->a( n = `press` v = client->_event( `NEST_OPEN` )
    )->tag( `Button`
        )->a( n = `text`  v = `Nest2`
        )->a( n = `press` v = client->_event( `NEST2_OPEN` )
    )->tag( `VBox`
        )->a( n = `id` v = `nest_anchor`
    )->tag( `VBox`
        )->a( n = `id` v = `nest2_anchor` ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD on_event.

    CASE client->get_event( ).
      WHEN `POPUP_OPEN`.
        popup_display( `conformance popup` ).
      WHEN `POPUP_REPLACE`.
        " two displays of one slot in one roundtrip - the last one counts
        popup_display( `first` ).
        popup_display( `second` ).
      WHEN `POPUP_CLOSE`.
        client->popup_destroy( ).
      WHEN `MAIN_AND_POPUP`.
        " called in the reverse of the slot order on purpose
        popup_display( `with main` ).
        view_display( ).
      WHEN `POPOVER_OPEN`.
        popover_display( ).
      WHEN `POPOVER_CLOSE`.
        client->popover_destroy( ).
      WHEN `NEST_OPEN`.
        nest_display( z2ui5_if_client=>cs_view-nested ).
      WHEN `NEST_CLOSE`.
        client->nest_view_destroy( ).
      WHEN `NEST2_OPEN`.
        nest_display( z2ui5_if_client=>cs_view-nested2 ).
      WHEN `NEST2_CLOSE`.
        client->nest2_view_destroy( ).
    ENDCASE.

  ENDMETHOD.

  METHOD popup_display.

    DATA(popup) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `FragmentDefinition` ns = `core`
            )->a( n = `xmlns`      v = `sap.m`
            )->a( n = `xmlns:core` v = `sap.ui.core` ).

    popup->ele( `Dialog`
        )->a( n = `title` v = title

        )->tag( `Input`
            )->a( n = `id`    v = `popup_text`
            )->a( n = `value` v = client->_bind( popup_text )

        )->ele( `buttons`

            )->tag( `Button`
                )->a( n = `text`  v = `Close`
                )->a( n = `press` v = client->_event( `POPUP_CLOSE` )
            )->tag( `Button`
                )->a( n = `text`  v = `Close here`
                )->a( n = `press` v = client->follow_up_action( z2ui5_if_client=>cs_event-popup_close ) ).

    client->popup_display( popup->stringify( ) ).

  ENDMETHOD.

  METHOD popover_display.

    DATA(popover) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `FragmentDefinition` ns = `core`
            )->a( n = `xmlns`      v = `sap.m`
            )->a( n = `xmlns:core` v = `sap.ui.core` ).

    popover->ele( `Popover`
        )->a( n = `title` v = `conformance popover`

        )->tag( `Button`
            )->a( n = `text`  v = `Close`
            )->a( n = `press` v = client->_event( `POPOVER_CLOSE` ) ).

    client->popover_display( xml   = popover->stringify( )
                             by_id = `btn_popover` ).

  ENDMETHOD.

  METHOD nest_display.

    DATA(nest) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`     v = `sap.m`
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc`

            )->ele( `VBox`

                )->tag( `Text`
                    )->a( n = `text` t = |conformance { slot }|
                )->tag( `Button`
                    )->a( n = `text`  v = `Close`
                    )->a( n = `press` v = client->_event( |{ slot }_CLOSE| ) ).

    IF slot = z2ui5_if_client=>cs_view-nested.
      client->nest_view_display( val            = nest->stringify( )
                                 id             = `nest_anchor`
                                 method_insert  = `addItem`
                                 method_destroy = `removeAllItems` ).
    ELSE.
      client->nest2_view_display( val            = nest->stringify( )
                                  id             = `nest2_anchor`
                                  method_insert  = `addItem`
                                  method_destroy = `removeAllItems` ).
    ENDIF.

  ENDMETHOD.

ENDCLASS.
