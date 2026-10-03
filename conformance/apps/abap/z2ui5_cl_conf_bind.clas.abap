" Conformance app BIND - the model delta: a scalar, a number, a boolean, a
" structure and a table edited by row (__delta). CHECK writes what the
" backend holds into SUMMARY, so a client can see which edits arrived.
" Behaviour: conformance/apps/README.md, section BIND.
CLASS z2ui5_cl_conf_bind DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    TYPES:
      BEGIN OF ty_s_addr,
        city TYPE string,
        zip  TYPE string,
      END OF ty_s_addr.
    TYPES:
      BEGIN OF ty_s_item,
        id   TYPE i,
        text TYPE string,
        done TYPE abap_bool,
      END OF ty_s_item.
    TYPES ty_t_item TYPE STANDARD TABLE OF ty_s_item WITH EMPTY KEY.

    DATA name    TYPE string.
    DATA qty     TYPE i.
    DATA flag    TYPE abap_bool.
    DATA s_addr  TYPE ty_s_addr.
    DATA t_items TYPE ty_t_item.
    DATA summary TYPE string.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.
    METHODS on_event.
    METHODS summary_build.
    METHODS model_init.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_bind IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.
    IF client->check_on_init( ).
      model_init( ).
      view_display( ).
    ELSEIF client->check_on_navigated( ).
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
        )->a( n = `title` v = `conformance - bind` ).

    page->tag( `Input`
        )->a( n = `id`    v = `name`
        )->a( n = `value` v = client->_bind( name )
    )->tag( `StepInput`
        )->a( n = `id`    v = `qty`
        )->a( n = `value` v = client->_bind( qty )
    )->tag( `CheckBox`
        )->a( n = `id`       v = `flag`
        )->a( n = `text`     v = `Flag`
        )->a( n = `selected` v = client->_bind( flag )
    )->tag( `Input`
        )->a( n = `id`    v = `city`
        )->a( n = `value` v = client->_bind( s_addr-city )
    )->tag( `Input`
        )->a( n = `id`    v = `zip`
        )->a( n = `value` v = client->_bind( s_addr-zip )
    )->tag( `Text`
        )->a( n = `id`   v = `summary`
        )->a( n = `text` v = client->_bind( summary )
    )->tag( `Button`
        )->a( n = `text`  v = `Check`
        )->a( n = `press` v = client->_event( `CHECK` )
    )->tag( `Button`
        )->a( n = `text`  v = `Add row`
        )->a( n = `press` v = client->_event( `ADD_ROW` ) ).

    page->ele( `Table`
        )->a( n = `id`    v = `items`
        )->a( n = `items` v = client->_bind( t_items )

        )->ele( `columns`

            )->tag( `Column`
            )->tag( `Column`
            )->tag( `Column`

        )->end(
        )->ele( `items`
            )->ele( `ColumnListItem`
                )->ele( `cells`

                    )->tag( `Text`
                        )->a( n = `text` v = `{ID}`
                    )->tag( `Input`
                        )->a( n = `value` v = `{TEXT}`
                    )->tag( `CheckBox`
                        )->a( n = `selected` v = `{DONE}` ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD on_event.

    CASE client->get_event( ).
      WHEN `CHECK`.
        summary_build( ).
      WHEN `ADD_ROW`.
        INSERT VALUE #( id   = lines( t_items ) + 1
                        text = `new` ) INTO TABLE t_items.
        summary_build( ).
    ENDCASE.

  ENDMETHOD.

  METHOD summary_build.

    DATA lt_rows TYPE string_table.

    LOOP AT t_items INTO DATA(ls_item).
      INSERT |{ ls_item-id }:{ ls_item-text }:{ ls_item-done }| INTO TABLE lt_rows.
    ENDLOOP.

    summary = |{ name };{ qty };{ flag };{ s_addr-city };{ s_addr-zip };| &&
              concat_lines_of( table = lt_rows
                               sep   = `,` ).

  ENDMETHOD.

  METHOD model_init.

    name   = `start`.
    qty    = 1.
    s_addr = VALUE #( city = `Berlin`
                      zip  = `10115` ).
    t_items = VALUE #( ( id = 1 text = `one`   )
                       ( id = 2 text = `two`   )
                       ( id = 3 text = `three` ) ).

  ENDMETHOD.

ENDCLASS.
