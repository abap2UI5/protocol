" Conformance app ECHO - first start, the event roundtrip with arguments,
" a roundtrip that changes nothing, a model push without a view, and a
" re-render. Behaviour: conformance/apps/README.md, section ECHO.
CLASS z2ui5_cl_conf_echo DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA count      TYPE i.
    DATA last_event TYPE string.
    DATA last_args  TYPE string.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.
    METHODS on_event.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_echo IMPLEMENTATION.

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
                )->a( n = `title` v = `conformance - echo`

                )->tag( `Text`
                    )->a( n = `id`   v = `count`
                    )->a( n = `text` v = client->_bind( count )
                )->tag( `Text`
                    )->a( n = `id`   v = `last_event`
                    )->a( n = `text` v = client->_bind( last_event )
                )->tag( `Text`
                    )->a( n = `id`   v = `last_args`
                    )->a( n = `text` v = client->_bind( last_args )
                )->tag( `Button`
                    )->a( n = `text`  v = `Echo`
                    )->a( n = `press` v = client->_event( val   = `ECHO`
                                                         t_arg = VALUE #( ( `alpha` ) ( `beta` ) ) )
                )->tag( `Button`
                    )->a( n = `text`  v = `Nothing`
                    )->a( n = `press` v = client->_event( `NOOP` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Push`
                    )->a( n = `press` v = client->_event( `PUSH` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Render`
                    )->a( n = `press` v = client->_event( `RERENDER` ) ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD on_event.

    CASE client->get_event( ).
      WHEN `ECHO`.
        count      = count + 1.
        last_event = client->get_event( ).
        last_args  = concat_lines_of( table = client->get( )-t_event_arg
                                      sep   = `|` ).
      WHEN `PUSH`.
        count = count + 100.
      WHEN `RERENDER`.
        view_display( ).
      WHEN OTHERS.
        " NOOP and every unknown event: nothing bound changes, nothing is
        " displayed - the response carries no MODEL and no action
    ENDCASE.

  ENDMETHOD.

ENDCLASS.
