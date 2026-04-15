# Template: CDS Table Function (AMDP-backed)

## When to Use
Complex logic that can't be expressed in pure CDS — tree traversal, iterative algorithms, multi-step aggregation.

## Objects to Create

### 1. DDLS/DF — Table Function DDL
```sql
@EndUserText.label: '<description>'
@ClientHandling.type: #CLIENT_INDEPENDENT
define table function znw_TF_<Name>
  with parameters
    @Environment.systemField: #CLIENT
    p_client : abap.clnt,
    p_param1 : <type>,
    p_param2 : <type>
  returns {
    key field1 : <type>;
    field2     : <type>;
  }
  implemented by method znw_CL_<Name>=>get_data;
```

### 2. CLAS/OC — Implementing Class
```abap
CLASS znw_cl_<name> DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.
    CLASS-METHODS get_data
      FOR TABLE FUNCTION znw_tf_<name>.
ENDCLASS.

CLASS znw_cl_<name> IMPLEMENTATION.
  METHOD get_data
    BY DATABASE FUNCTION FOR HDB LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY
    USING "<table1>" "<table2>".

    -- Use SESSION_CONTEXT('CLIENT') for client filtering
    -- Direct table access only (no CDS views in USING)
    -- CAST NUMC fields before MAX/comparison
  ENDMETHOD.
ENDCLASS.
```

## Key Rules
- `#CLIENT_INDEPENDENT` + explicit `SESSION_CONTEXT('CLIENT')` in AMDP
- Direct table access only — CDS view entities CANNOT be in USING clause
- objtype for createObject: DDLS/DF (DDL), CLAS/OC (class)
- Table names in USING must be uppercase and double-quoted
