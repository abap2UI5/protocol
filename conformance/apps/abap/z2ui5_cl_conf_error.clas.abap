" Conformance app ERROR - an unhandled exception in main( ). FAIL raises,
" NOOP answers normally, so a client can show that a failed roundtrip
" leaves the draft it started from usable. Behaviour:
" conformance/apps/README.md, section ERROR.
CLASS z2ui5_cl_conf_error DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA count TYPE i.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_error IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.
    IF client->check_on_navigated( ).
      view_display( ).
      RETURN.
    ENDIF.

    CASE client->get_event( ).
      WHEN `FAIL`.
        count = count + 1.
        " an unhandled exception on purpose, raised by the language itself
        " (CX_SY_CONVERSION_NO_NUMBER) rather than by a framework class an
        " app must not name - the error body shows it with app and event
        count = `CONFORMANCE_FAILURE`.
      WHEN `COUNT`.
        count = count + 1.
    ENDCASE.

  ENDMETHOD.

  METHOD view_display.

    DATA(view) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`     v = `sap.m`
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc`

            )->ele( `Page`
                )->a( n = `title` v = `conformance - error`

                )->tag( `Text`
                    )->a( n = `id`   v = `count`
                    )->a( n = `text` v = client->_bind( count )
                )->tag( `Button`
                    )->a( n = `text`  v = `Fail`
                    )->a( n = `press` v = client->_event( `FAIL` )
                )->tag( `Button`
                    )->a( n = `text`  v = `Count`
                    )->a( n = `press` v = client->_event( `COUNT` ) ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

ENDCLASS.
