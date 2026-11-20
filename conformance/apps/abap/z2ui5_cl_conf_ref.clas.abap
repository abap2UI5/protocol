" Conformance app REF - tables behind a data reference: two attributes
" TYPE REF TO data, bound dereferenced, so the model nodes are /MR_TAB/*
" and /MR_WIN/*. MR_TAB is bound with _bind( ), MR_WIN with
" window_bind_tab( ) in a fixed order (QTY descending). CHECK writes what
" the backend holds into SUMMARY, so a client can see which edits arrived.
" Behaviour: conformance/apps/README.md, section REF.
CLASS z2ui5_cl_conf_ref DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    TYPES:
      BEGIN OF ty_s_item,
        id   TYPE i,
        text TYPE string,
        done TYPE abap_bool,
      END OF ty_s_item.
    TYPES ty_t_item TYPE STANDARD TABLE OF ty_s_item WITH EMPTY KEY.
    TYPES:
      BEGIN OF ty_s_row,
        id   TYPE i,
        qty  TYPE i,
        done TYPE abap_bool,
      END OF ty_s_row.
    TYPES ty_t_row TYPE STANDARD TABLE OF ty_s_row WITH EMPTY KEY.

    DATA mr_tab   TYPE REF TO data.
    DATA mr_win   TYPE REF TO data.
    DATA summary  TYPE string.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.
    METHODS summary_build.
    METHODS model_init.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_ref IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.
    IF client->check_on_init( ).
      model_init( ).
      view_display( ).
    ELSEIF client->check_on_navigated( ).
      view_display( ).
    ELSEIF client->check_on_event( ) AND client->get_event( ) = `CHECK`.
      summary_build( ).
    ENDIF.

  ENDMETHOD.

  METHOD view_display.

    FIELD-SYMBOLS <tab> TYPE ty_t_item.
    FIELD-SYMBOLS <win> TYPE ty_t_row.

    ASSIGN mr_tab->* TO <tab>.
    ASSIGN mr_win->* TO <win>.

    DATA(view) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`     v = `sap.m`
            )->a( n = `xmlns:mvc` v = `sap.ui.core.mvc` ).

    DATA(page) = view->ele( `Page`
        )->a( n = `title` v = `conformance - ref` ).

    page->tag( `Text`
        )->a( n = `id`   v = `summary`
        )->a( n = `text` v = client->_bind( summary )
    )->tag( `Button`
        )->a( n = `text`  v = `Check`
        )->a( n = `press` v = client->_event( `CHECK` ) ).

    page->ele( `Table`
        )->a( n = `id`    v = `items`
        )->a( n = `items` v = client->_bind( <tab> )

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

    page->ele( `Table`
        )->a( n = `id`               v = `rows`
        )->a( n = `growing`          v = `true`
        )->a( n = `growingThreshold` v = `4`
        )->a( n = `items`            v = client->window_bind_tab(
                                             val    = <win>
                                             window = 4
                                             t_sort = VALUE #( ( path = `QTY` descending = abap_true ) ) )

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
                    )->tag( `Text`
                        )->a( n = `text` v = `{QTY}`
                    )->tag( `CheckBox`
                        )->a( n = `selected` v = `{DONE}` ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD summary_build.

    FIELD-SYMBOLS <tab> TYPE ty_t_item.
    FIELD-SYMBOLS <win> TYPE ty_t_row.
    DATA lt_rows TYPE string_table.
    DATA lt_done TYPE string_table.

    ASSIGN mr_tab->* TO <tab>.
    ASSIGN mr_win->* TO <win>.

    LOOP AT <tab> INTO DATA(ls_item).
      INSERT |{ ls_item-id }:{ ls_item-text }:{ ls_item-done }| INTO TABLE lt_rows.
    ENDLOOP.
    LOOP AT <win> INTO DATA(ls_row) WHERE done = abap_true.
      INSERT |{ ls_row-id }| INTO TABLE lt_done.
    ENDLOOP.

    summary = concat_lines_of( table = lt_rows
                               sep   = `,` ) && `;` &&
              concat_lines_of( table = lt_done
                               sep   = `,` ).

  ENDMETHOD.

  METHOD model_init.

    FIELD-SYMBOLS <tab> TYPE ty_t_item.
    FIELD-SYMBOLS <win> TYPE ty_t_row.

    CREATE DATA mr_tab TYPE ty_t_item.
    ASSIGN mr_tab->* TO <tab>.
    <tab> = VALUE #( ( id = 1 text = `one`   )
                     ( id = 2 text = `two`   )
                     ( id = 3 text = `three` ) ).

    " QTY runs in another order than ID: 5 3 1 6 4 2
    CREATE DATA mr_win TYPE ty_t_row.
    ASSIGN mr_win->* TO <win>.
    DO 6 TIMES.
      INSERT VALUE #( id  = sy-index
                      qty = ( sy-index * 5 ) MOD 7 ) INTO TABLE <win>.
    ENDDO.

  ENDMETHOD.

ENDCLASS.
