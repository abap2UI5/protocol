" Conformance app WINDOW - a windowed table the app loads itself: twelve
" rows in a table of its own (the "database"), bound with window_bind_tab
" four at a time. The list binding's requests arrive as the app's event
" ROWS with the request in get( )-r_event_data; the app appends rows for
" MORE and starts again from the first row for SORT and FILTER, sorting,
" filtering and counting itself. LAST and REQUEST show what the app was
" handed, MAINS how often it ran. Behaviour: conformance/apps/README.md,
" section WINDOW.
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

    DATA t_rows  TYPE ty_t_row.
    DATA total   TYPE i.
    DATA summary TYPE string.
    DATA mains   TYPE i.
    DATA last    TYPE string.
    DATA request TYPE string.

  PROTECTED SECTION.
    DATA client   TYPE REF TO z2ui5_if_client.
    " all rows; t_rows holds the ones loaded so far
    DATA t_db     TYPE ty_t_row.
    " the order of the list - what the last SORT or FILTER request named
    DATA t_sort   TYPE z2ui5_if_client=>ty_t_bind_tab_sort.
    DATA t_filter TYPE z2ui5_if_client=>ty_t_bind_tab_filter.

    METHODS view_display.
    METHODS on_event.
    METHODS on_window.
    METHODS model_init.
    METHODS save.

    METHODS load
      IMPORTING
        skip TYPE i
        top  TYPE i.

    METHODS passes
      IMPORTING
        is_row        TYPE ty_s_row
      RETURNING
        VALUE(result) TYPE abap_bool.

    METHODS cond_check
      IMPORTING
        is_row        TYPE ty_s_row
        is_cond       TYPE z2ui5_if_client=>ty_s_bind_tab_filter
      RETURNING
        VALUE(result) TYPE abap_bool.

    METHODS precedes
      IMPORTING
        is_a          TYPE ty_s_row
        is_b          TYPE ty_s_row
      RETURNING
        VALUE(result) TYPE abap_bool.

    METHODS request_text
      IMPORTING
        is_req        TYPE z2ui5_if_client=>ty_s_window_request
      RETURNING
        VALUE(result) TYPE string.

    CLASS-METHODS num
      IMPORTING
        val           TYPE string
      RETURNING
        VALUE(result) TYPE i.

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
    ELSE.
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
    )->tag( `Text`
        )->a( n = `id`   v = `last`
        )->a( n = `text` v = client->_bind( last )
    )->tag( `Text`
        )->a( n = `id`   v = `request`
        )->a( n = `text` v = client->_bind( request )
    )->tag( `Button`
        )->a( n = `text`  v = `Check`
        )->a( n = `press` v = client->_event( `CHECK` )
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
        )->a( n = `items`            v = client->window_bind_tab( val    = t_rows
                                                                  total  = total
                                                                  event  = `ROWS`
                                                                  window = 4 )

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

    last = client->get( )-event.
    LOOP AT client->get( )-t_event_arg INTO DATA(lv_arg).
      last = |{ last } { lv_arg }|.
    ENDLOOP.

    CASE client->get_event( ).
      " abap2ui5lint-disable-next-line handler-without-event -- the window event of t_rows, sent by the list binding
      WHEN `ROWS`.
        on_window( ).
      WHEN `CHECK`.
        LOOP AT t_rows INTO DATA(ls_row) WHERE done = abap_true.
          INSERT |{ ls_row-id }| INTO TABLE lt_done.
        ENDLOOP.
        summary = concat_lines_of( table = lt_done
                                   sep   = `,` ).
      " abap2ui5lint-disable-next-line handler-without-event -- posted by the conformance suite: the app reports another total
      WHEN `TOTAL`.
        total = num( client->get_event_arg( ) ).
    ENDCASE.

  ENDMETHOD.

  METHOD on_window.

    FIELD-SYMBOLS <req> TYPE z2ui5_if_client=>ty_s_window_request.

    DATA(lr_req) = client->get( )-r_event_data.
    IF lr_req IS NOT BOUND.
      request = `no request`.
      RETURN.
    ENDIF.
    ASSIGN lr_req->* TO <req>.
    IF <req> IS NOT ASSIGNED.
      RETURN.
    ENDIF.
    request = request_text( <req> ).
    IF <req>-path <> `/T_ROWS`.
      RETURN.
    ENDIF.

    " what the user ticked in the rows loaded so far stays when they are
    " loaded anew
    save( ).
    IF <req>-reason = z2ui5_if_client=>cs_window_reason-more.
      load( skip = <req>-skip
            top  = <req>-top ).
    ELSE.
      " SORT and FILTER carry the whole state of the columns
      t_sort   = <req>-t_sort.
      t_filter = <req>-t_filter.
      load( skip = 0
            top  = <req>-top ).
    ENDIF.

  ENDMETHOD.

  METHOD save.

    LOOP AT t_rows INTO DATA(ls_row).
      MODIFY t_db FROM ls_row TRANSPORTING done WHERE id = ls_row-id.
    ENDLOOP.

  ENDMETHOD.

  METHOD load.

    DATA lt_hit TYPE ty_t_row.
    DATA lv_at  TYPE i.

    " the rows the filter lets through, in the order of the sort - a stable
    " insertion sort: a row goes before the first one it precedes
    LOOP AT t_db INTO DATA(ls_row).
      IF passes( ls_row ) = abap_false.
        CONTINUE.
      ENDIF.
      lv_at = lines( lt_hit ) + 1.
      LOOP AT lt_hit INTO DATA(ls_hit).
        IF precedes( is_a = ls_row
                     is_b = ls_hit ) = abap_true.
          lv_at = sy-tabix.
          EXIT.
        ENDIF.
      ENDLOOP.
      INSERT ls_row INTO lt_hit INDEX lv_at.
    ENDLOOP.
    total = lines( lt_hit ).

    " the first skip rows stay, top rows of the order follow them
    DATA(lv_skip) = nmin( val1 = skip
                          val2 = lines( t_rows ) ).
    IF lv_skip < lines( t_rows ).
      DELETE t_rows FROM lv_skip + 1.
    ENDIF.
    LOOP AT lt_hit INTO ls_row FROM lv_skip + 1.
      IF sy-tabix > lv_skip + top.
        EXIT.
      ENDIF.
      INSERT ls_row INTO TABLE t_rows.
    ENDLOOP.

  ENDMETHOD.

  METHOD passes.

    DATA lv_group TYPE i.
    DATA lv_hit   TYPE abap_bool.

    " the conditions of one group ORed, the groups ANDed
    result = abap_true.
    LOOP AT t_filter INTO DATA(ls_cond).
      IF ls_cond-group <> lv_group.
        IF lv_group IS NOT INITIAL AND lv_hit = abap_false.
          result = abap_false.
          RETURN.
        ENDIF.
        lv_group = ls_cond-group.
        lv_hit = abap_false.
      ENDIF.
      IF lv_hit = abap_false.
        lv_hit = cond_check( is_row  = is_row
                             is_cond = ls_cond ).
      ENDIF.
    ENDLOOP.
    IF lv_group IS NOT INITIAL AND lv_hit = abap_false.
      result = abap_false.
    ENDIF.

  ENDMETHOD.

  METHOD cond_check.

    DATA lv_num TYPE i.

    CASE is_cond-path.
      WHEN `NAME`.
        DATA(lv_text) = to_upper( is_row-name ).
        DATA(lv_value) = to_upper( is_cond-value1 ).
        CASE is_cond-operator.
          WHEN `Contains`.
            result = xsdbool( lv_text CS lv_value ).
          WHEN `EQ`.
            result = xsdbool( lv_text = lv_value ).
        ENDCASE.
        RETURN.
      WHEN `ID`.
        lv_num = is_row-id.
      WHEN `QTY`.
        lv_num = is_row-qty.
      WHEN OTHERS.
        RETURN.
    ENDCASE.

    CASE is_cond-operator.
      WHEN `EQ`.
        result = xsdbool( lv_num = num( is_cond-value1 ) ).
      WHEN `GT`.
        result = xsdbool( lv_num > num( is_cond-value1 ) ).
      WHEN `LT`.
        result = xsdbool( lv_num < num( is_cond-value1 ) ).
      WHEN `BT`.
        result = xsdbool( lv_num >= num( is_cond-value1 ) AND lv_num <= num( is_cond-value2 ) ).
    ENDCASE.

  ENDMETHOD.

  METHOD precedes.

    DATA lv_cmp TYPE i.

    " the first sorter that tells the two rows apart decides
    LOOP AT t_sort INTO DATA(ls_sort).
      CASE ls_sort-path.
        WHEN `ID`.
          lv_cmp = sign( is_a-id - is_b-id ).
        WHEN `QTY`.
          lv_cmp = sign( is_a-qty - is_b-qty ).
        WHEN `NAME`.
          lv_cmp = COND #( WHEN is_a-name < is_b-name THEN -1 WHEN is_a-name > is_b-name THEN 1 ELSE 0 ).
        WHEN OTHERS.
          lv_cmp = 0.
      ENDCASE.
      IF lv_cmp <> 0.
        IF ls_sort-descending = abap_true.
          lv_cmp = 0 - lv_cmp.
        ENDIF.
        result = xsdbool( lv_cmp < 0 ).
        RETURN.
      ENDIF.
    ENDLOOP.

  ENDMETHOD.

  METHOD request_text.

    " path reason skip top, then S:<path>:<A|D> per sorter and
    " F<group>:<path>:<operator>:<value1>:<value2> per condition
    result = |{ is_req-path } { is_req-reason } { is_req-skip } { is_req-top }|.
    LOOP AT is_req-t_sort INTO DATA(ls_sort).
      result = |{ result } S:{ ls_sort-path }:{ COND #( WHEN ls_sort-descending = abap_true THEN `D` ELSE `A` ) }|.
    ENDLOOP.
    LOOP AT is_req-t_filter INTO DATA(ls_cond).
      result = |{ result } F{ ls_cond-group }:{ ls_cond-path }:{ ls_cond-operator }:{ ls_cond-value1 }:{ ls_cond-value2 }|.
    ENDLOOP.

  ENDMETHOD.

  METHOD num.

    " digits only - anything else is 0
    DATA(lv_val) = condense( val ).
    IF lv_val IS NOT INITIAL AND lv_val CO `0123456789` AND strlen( lv_val ) <= 9.
      result = lv_val.
    ENDIF.

  ENDMETHOD.

  METHOD model_init.

    " QTY runs in another order than ID: 5 10 2 7 12 4 9 1 6 11 3 8
    DO 12 TIMES.
      INSERT VALUE #( id   = sy-index
                      name = COND #( WHEN sy-index < 10 THEN |item 0{ sy-index }| ELSE |item { sy-index }| )
                      qty  = ( sy-index * 5 ) MOD 13 ) INTO TABLE t_db.
    ENDDO.
    load( skip = 0
          top  = 4 ).

  ENDMETHOD.

ENDCLASS.
