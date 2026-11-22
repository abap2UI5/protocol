" Conformance app REF - a table behind a data reference: an attribute
" TYPE REF TO data, bound dereferenced with _bind( ), so the model node is
" /MR_TAB/*. (The windowed table behind a reference is MR_WIN of the app
" WINDOW.) CHECK writes what the backend holds into SUMMARY, so a client
" can see which edits arrived.
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

    DATA mr_tab   TYPE REF TO data.
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

    ASSIGN mr_tab->* TO <tab>.

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

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

  METHOD summary_build.

    FIELD-SYMBOLS <tab> TYPE ty_t_item.
    DATA lt_rows TYPE string_table.

    ASSIGN mr_tab->* TO <tab>.

    LOOP AT <tab> INTO DATA(ls_item).
      INSERT |{ ls_item-id }:{ ls_item-text }:{ ls_item-done }| INTO TABLE lt_rows.
    ENDLOOP.
    summary = concat_lines_of( table = lt_rows
                               sep   = `,` ).

  ENDMETHOD.

  METHOD model_init.

    FIELD-SYMBOLS <tab> TYPE ty_t_item.

    CREATE DATA mr_tab TYPE ty_t_item.
    ASSIGN mr_tab->* TO <tab>.
    <tab> = VALUE #( ( id = 1 text = `one`   )
                     ( id = 2 text = `two`   )
                     ( id = 3 text = `three` ) ).

  ENDMETHOD.

ENDCLASS.
