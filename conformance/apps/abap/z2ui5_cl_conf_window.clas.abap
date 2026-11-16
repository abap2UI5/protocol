" Conformance app WINDOW - a windowed table: twelve rows bound with
" window_bind_tab, four at a time. The framework answers the window
" requests of the list binding itself. MAINS counts how often the app ran,
" so a client can see that such a request did not reach it. SORT and FILTER
" set the order and the filter of the app, CHECK writes the rows that are
" done into SUMMARY. Behaviour: conformance/apps/README.md, section WINDOW.
CLASS z2ui5_cl_conf_window DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    TYPES:
      BEGIN OF ty_s_row,
        id   TYPE i,
        name TYPE string,
        qty  TYPE i,
        done TYPE abap_bool,
      END OF ty_s_row.
    TYPES ty_t_row TYPE STANDARD TABLE OF ty_s_row WITH EMPTY KEY.

    DATA t_rows   TYPE ty_t_row.
    DATA summary  TYPE string.
    DATA mains    TYPE i.
    DATA t_sort   TYPE z2ui5_if_client=>ty_t_bind_tab_sort.
    DATA t_filter TYPE z2ui5_if_client=>ty_t_bind_tab_filter.

  PROTECTED SECTION.
    DATA client TYPE REF TO z2ui5_if_client.

    METHODS view_display.
    METHODS on_event.
    METHODS model_init.
    METHODS window_bind
      RETURNING
        VALUE(result) TYPE string.

  PRIVATE SECTION.
ENDCLASS.


CLASS z2ui5_cl_conf_window IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    me->client = client.
    mains = mains + 1.
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
        )->a( n = `title` v = `conformance - window` ).

    page->tag( `Text`
        )->a( n = `id`   v = `summary`
        )->a( n = `text` v = client->_bind( summary )
    )->tag( `Text`
        )->a( n = `id`   v = `mains`
        )->a( n = `text` v = client->_bind( mains )
    )->tag( `Button`
        )->a( n = `text`  v = `Check`
        )->a( n = `press` v = client->_event( `CHECK` )
    )->tag( `Button`
        )->a( n = `text`  v = `Sort`
        )->a( n = `press` v = client->_event( val   = `SORT`
                                             t_arg = VALUE #( ( `QTY` ) ( `X` ) ) )
    )->tag( `Button`
        )->a( n = `text`  v = `Filter`
        )->a( n = `press` v = client->_event( val   = `FILTER`
                                             t_arg = VALUE #( ( `1` ) ) )
    )->tag( `Button`
        )->a( n = `text`  v = `Render`
        )->a( n = `press` v = client->_event( `RERENDER` )
    )->tag( `Button`
        )->a( n = `text`  v = `Sort list`
        )->a( n = `press` v = client->follow_up_action( val   = z2ui5_if_client=>cs_event-binding_call
                                                       t_arg = VALUE #( ( `rows` ) ( `items` ) ( `sort` ) ( `QTY` ) ( `X` ) ) )
    )->tag( `Button`
        )->a( n = `text`  v = `Filter list`
        )->a( n = `press` v = client->follow_up_action(
                                val   = z2ui5_if_client=>cs_event-binding_call
                                t_arg = VALUE #( ( `rows` ) ( `items` ) ( `filter` ) ( `NAME` ) ( `Contains` ) ( `1` ) ) ) ).

    page->ele( `Table`
        )->a( n = `id`               v = `rows`
        )->a( n = `growing`          v = `true`
        )->a( n = `growingThreshold` v = `4`
        )->a( n = `items`            v = window_bind( )

        )->ele( `columns`

            )->tag( `Column`
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
                        )->a( n = `text` v = `{NAME}`
                    )->tag( `Text`
                        )->a( n = `text` v = `{QTY}`
                    )->tag( `CheckBox`
                        )->a( n = `selected` v = `{DONE}` ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD on_event.

    DATA lt_done TYPE string_table.

    CASE client->get_event( ).
      WHEN `CHECK`.
        LOOP AT t_rows INTO DATA(ls_row) WHERE done = abap_true.
          INSERT |{ ls_row-id }| INTO TABLE lt_done.
        ENDLOOP.
        summary = concat_lines_of( table = lt_done
                                   sep   = `,` ).
      WHEN `SORT`.
        " the app's own order, over all rows: no view, the model alone
        " carries the first window of it
        CLEAR t_sort.
        IF client->get_event_arg( 1 ) IS NOT INITIAL.
          INSERT VALUE #( path       = client->get_event_arg( 1 )
                          descending = xsdbool( client->get_event_arg( 2 ) IS NOT INITIAL ) ) INTO TABLE t_sort.
        ENDIF.
        window_bind( ).
      WHEN `FILTER`.
        CLEAR t_filter.
        IF client->get_event_arg( 1 ) IS NOT INITIAL.
          INSERT VALUE #( group    = 1
                          path     = `NAME`
                          operator = `Contains`
                          value1   = client->get_event_arg( 1 ) ) INTO TABLE t_filter.
        ENDIF.
        window_bind( ).
      WHEN `RERENDER`.
        view_display( ).
    ENDCASE.

  ENDMETHOD.

  METHOD window_bind.

    result = client->window_bind_tab( val      = t_rows
                                      window   = 4
                                      t_sort   = t_sort
                                      t_filter = t_filter ).

  ENDMETHOD.

  METHOD model_init.

    " QTY runs in another order than ID: 5 10 2 7 12 4 9 1 6 11 3 8
    DO 12 TIMES.
      INSERT VALUE #( id   = sy-index
                      name = COND #( WHEN sy-index < 10 THEN |item 0{ sy-index }| ELSE |item { sy-index }| )
                      qty  = ( sy-index * 5 ) MOD 13 ) INTO TABLE t_rows.
    ENDDO.

  ENDMETHOD.

ENDCLASS.
