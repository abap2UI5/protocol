" Conformance app NAV_TGT - the called app of NAV. DONE leaves with a
" result, the page's back button leaves through the reserved leave event.
" Behaviour: conformance/apps/README.md, section NAV.
CLASS z2ui5_cl_conf_nav_tgt DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA input    TYPE string.
    DATA output   TYPE string.
    DATA has_prev TYPE abap_bool.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_nav_tgt IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.
    IF client->check_on_navigated( ).
      has_prev = client->check_app_prev_stack( ).
      view_display( ).
      RETURN.
    ENDIF.

    IF client->check_on_event( `DONE` ).
      output = |{ input }!|.
      client->nav_app_leave( event = `RETURNED` ).
    ENDIF.

  ENDMETHOD.

  METHOD view_display.

    DATA(view) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`     v = `sap.m`
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc`

            )->ele( `Page`
                )->a( n = `title`          v = `conformance - nav target`
                )->a( n = `showNavButton`  b = has_prev
                )->a( n = `navButtonPress` v = client->_event_nav_app_leave( )

                )->tag( `Text`
                    )->a( n = `id`   v = `input`
                    )->a( n = `text` v = client->_bind( input )
                )->tag( `Text`
                    )->a( n = `id`   v = `output`
                    )->a( n = `text` v = client->_bind( output )
                )->tag( `Button`
                    )->a( n = `text`  v = `Done`
                    )->a( n = `press` v = client->_event( `DONE` ) ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

ENDCLASS.
