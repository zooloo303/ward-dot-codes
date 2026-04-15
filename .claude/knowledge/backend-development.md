# Backend Development

ABAP, CDS, RAP patterns and rules for MY development.

---

## MY VDM Stack — Correct Layer Order

Confirmed from `znw_RISK` package on B23. **Never invert this order.**

```
Table (znw_xxx)
  ↓
I_  — define view entity, selects from TABLE
      @ObjectModel.usageType: { serviceQuality: #C, sizeCategory: #L, dataClass: #TRANSACTIONAL }
      @Metadata.ignorePropagatedAnnotations: true
      @AccessControl.authorizationCheck: #NOT_REQUIRED
      Defines associations (not compositions)
      Also serves as the analytics/reporting feed
  ↓
R_  — define root view entity, selects from I_
      @Metadata.ignorePropagatedAnnotations: false
      Defines compositions (for child entities)
      Adds @ObjectModel.text.element, @Semantics.text
      BDEF on R_: managed implementation, with draft, persistent table, draft table, mapping for
  ↓
C_  — define root view entity
      provider contract transactional_query
      as projection on R_
      @Metadata.allowExtensions: true
      Adds @Consumption.valueHelpDefinition, @EndUserText.label
      _Child : redirected to composition child C_Child
      BDEF on C_: projection; use draft; use create/update/delete; use actions
```

### Two BDEFs per BO
1. **Managed BDEF** — named after the R_ view (e.g. `znw_R_Risk`): `managed implementation in class znw_BP_R_Xxx unique; strict ( 2 ); with draft;`
2. **Projection BDEF** — named after the C_ view (e.g. `znw_C_Risk`): `projection; strict ( 2 ); use draft;`

### Behaviour Implementation Class
Named `znw_BP_R_Xxx` (matches the R_ BDEF, not the C_).

### Draft Tables
Named `<active_table>D` — e.g. `znw_RISK` → `znw_RISKD`, `znw_RISK_OBJ` → `znw_RISK_OBJD`.

### Service Definition + Binding
Expose the **C_ views** (not R_ or I_). Service binding OData V4 UI type.

---

## Naming Conventions

### Development Types (MUST ask before creating any object)

| # | Type | Namespace | Package | Transport | Catalog check |
|---|---|---|---|---|---|
| 1 | MY Product | `znw_` | `znw_*` | Real transport (`DRUCK9XXXXX`) | Yes |
| 2 | Customer | `Z` | `Z*` | Real transport | No |
| 3 | POC / Testing | `Z` | `$TMP` | None | No |
| 4 | Temp investigation | `Z` | `$TMP` | None -- delete after use | No |

### Object Naming Patterns

| Object Type | Pattern | Example |
|---|---|---|
| CDS Interface View | `znw_I_<Entity>` | `znw_I_SalesOrder` |
| CDS Consumption View | `znw_C_<Entity>` | `znw_C_SalesOrder` |
| CDS Reuse View | `znw_R_<Entity>` | `znw_R_SalesOrder` |
| Metadata Extension | `znw_MDE_<Entity>` | `znw_MDE_ESTIMATIONHDRTP` |
| Behaviour Definition | `znw_I_<Entity>` | `znw_I_SalesOrder` |
| Behaviour Pool | `znw_BP_<Entity>` | `znw_BP_R_ESTIMATIONHDRTP` |
| Abstract Entity | `znw_AE_<Name>` | `znw_AE_GETSUPPLIER` |
| Table Function | `znw_TF_<Name>` | `znw_TF_WC_FORMULA` |
| Custom Entity | `znw_CE_<Name>` | `znw_CE_ESTIMATIONCALCULATOR` |
| Parameterized View | `znw_P_<Name>` | `znw_P_MAINTORDERCOSTTOTAL` |
| Service Definition | `znw_SD_<Entity>` | `znw_SD_SalesOrder` |
| Service Binding V4 | `znw_SB_<Entity>_O4` | `znw_SB_SalesOrder_O4` |
| ABAP Class | `znw_CL_<Name>` | `znw_CL_PRICING_CALC` |
| Read layer | `znw_CL_<Name>_CON` | `znw_CL_ORDERS_CON` |
| Write layer | `znw_CL_<Name>_MOD` | `znw_CL_ORDERS_MOD` |
| Interface | `znw_IF_<Name>` | `znw_IF_PRICING` |
| BAdI Implementation | `znw_BADI_<Name>` | `znw_BADI_SD_ORDER` |

**Temp classes:** Z namespace, `$TMP`. Always delete after use.

### CDS View Naming Rules

- Entity names: CamelCase (`znw_I_EventConfigScenario`)
- Field names: CamelCase, match SAP standard CDS field names for same semantic concept
- Never use DB column names (AUFNR) -- use CDS field names (MaintenanceOrder)

### CDS View Name Length Limits

| View Type | Max Length | Notes |
|---|---|---|
| Non-analytical | **30 chars** | Includes `znw_` prefix (5 chars) |
| Analytical Cube/Query | **28 chars** | Includes `znw_` prefix |

Always count the full name including `znw_` before creating.

---

## CDS Rules

### Annotation Layers

| Annotation Type | Where It Lives |
|---|---|
| `@AbapCatalog`, `@AccessControl` | Interface View `znw_I_*` |
| `@ObjectModel`, `@Semantics` | Interface View `znw_I_*` |
| `@UI`, `@Search`, `@Consumption` | Metadata Extension `znw_MDE_*` only -- NOT in projection view |
| `@OData.publish` | Service Definition |

### Access Control (DCL)

- Every CDS view exposed via OData MUST have a DCL object
- Use `@AccessControl.authorizationCheck: #CHECK` on all interface views
- Never use `#NOT_REQUIRED` in production
- DCL object name must match CDS view name exactly

### CDS JOIN Field Qualification (MANDATORY before setObjectSource)

When a view has multiple JOINed data sources, every field must be qualified with the alias:
1. Every field needs `alias.FieldName`
2. Already-qualified fields (`_Assoc.Field`) -- leave as-is
3. Association exposures need: `alias._Assoc as _Assoc`
4. `$projection.Field` in ON conditions -> `alias.Field`
5. Build fully-qualified source in ONE script before `setObjectSource`

Grep check before every CDS setObjectSource -- both counts must be 0.

### CDS Hierarchy Limitations (confirmed 2026-03-29 on DS4)

**`multiple parents allowed` does NOT duplicate when association matches multiple parents.**

HANA's MULTIPARENT only handles nodes with the same NODE_ID appearing multiple times in source data. When a CDS association's ON condition matches multiple parent rows (e.g. `TopReplenishmentElement = ReplenishmentElement` matching 5 parents), HANA picks ONE parent — it does NOT duplicate the child for each.

Confirmed: zero `HIERARCHY_IS_CYCLE` flags, zero orphans, just wrong row count (58K vs correct 79K). This is a HANA engine limitation, not a configuration issue.

**For N:1 parent-child data:** Use AMDP iterative walk (CDS Table Function) instead of CDS Hierarchy. The AMDP correctly duplicates rows during traversal.

**Recursive CTE (`WITH RECURSIVE`):** Not supported in SQLScript table variable assignments. Cannot be used in AMDP.

### CDS Table Function Pattern (AMDP-backed CDS view)

For complex logic that can't be expressed in pure CDS:
1. Create DDLS/DF with `define table function ... returns { } implemented by method class=>method`
2. Class method: `FOR TABLE FUNCTION <name>` with `BY DATABASE FUNCTION FOR HDB LANGUAGE SQLSCRIPT`
3. Client handling: use `@ClientHandling.type: #CLIENT_INDEPENDENT` + explicit `SESSION_CONTEXT('CLIENT')` in AMDP (simpler than `#CLIENT_DEPENDENT` which requires mandt as first return field + parameter)
4. Object type for createObject: table function DDL = `DDLS/DF`, implementing class = `CLAS/OC`

### AMDP Rules (SQLScript)

**Direct table access only — never CDS view entities in USING:**
- Client-dependent `define view entity` CDS views CANNOT be used in AMDP USING clause — activation error: "restricts access to a single client, calling method must also allow this restriction"
- Always reference the underlying table (e.g. `znw_pegging`) not the CDS view (e.g. `znw_i_peggingbasic`) in AMDP USING
- Direct table access is not just a workaround — it is faster (no extra CASE expressions from CDS computed fields)

**Dynamic BOM depth — use MAX(disst) from the pegging table:**
- `disst` (MRP low-level code, NUMC2) is stored on every row of `znw_PEGGING`
- `MAX(CAST(disst AS INT))` gives the correct loop cap — CAST required because NUMC2 = NVARCHAR in HANA (string MAX gives wrong results: `'9' > '10'`)
- Overhead on warm runs: ~3ms for 49K rows — negligible
- Fallback: `IF lv_max_lvl <= 1 THEN lv_max_lvl = 10` — handles unpopulated disst
- The iterative WHILE loop already breaks early (`IF lv_count = 0 THEN BREAK`) so the cap is only a safety net against infinite loops

**Iterative WHILE loop for tree expansion:**
```sqlscript
WHILE :lv_level <= :lv_max_lvl DO
  lt_children = SELECT ... FROM "TABLE" p INNER JOIN :lt_current c ON p.toprepmnt = c.replen;
  SELECT COUNT(*) INTO lv_count FROM :lt_children;
  IF :lv_count = 0 THEN BREAK; END IF;
  et_result = SELECT * FROM :et_result UNION ALL SELECT * FROM :lt_children;
  lt_current = SELECT * FROM :lt_children;
  lv_level = :lv_level + 1;
END WHILE;
```
Per-material level caps are not possible — all materials share one `lt_current` table variable. Early break handles termination correctly.

### `@Metadata.ignorePropagatedAnnotations` — Critical Rule

**Never set `@Metadata.ignorePropagatedAnnotations: true` on consumption views** unless you explicitly re-declare every `@Semantics.*` annotation on the consumption view itself.

When `true`: ALL annotations from the interface view are blocked — including `@Semantics.amount.currencyCode`, `@Semantics.currencyCode`, and all other `@Semantics.*`. Fiori Elements reads from the consumption view layer; if annotations don't reach it, FE cannot use them.

**Symptom:** Currency unit not displayed next to amount field even though `@Semantics.amount.currencyCode` is correctly set on the interface view.

**Fix:** Set `false` on the consumption view (or omit — `false` is the default). `@Semantics.currencyCode: true` is also **not allowed on view entities** — only on abstract entities/table functions. The `@Semantics.amount.currencyCode` annotation on the amount field is sufficient for FE to render the currency unit.

---

### CDS Anti-Patterns

| # | Anti-Pattern | Impact |
|---|---|---|
| 1 | Multiple JOINs to same view (one per value) | Critical -- use CASE |
| 2 | `SELECT DISTINCT` -- symptom of join fan-out | Critical |
| 3 | Inline association access (`_Assoc.Field` in SELECT) | High -- forces eager JOIN |
| 4 | OR condition in JOIN predicate | Critical -- blocks index seek |
| 5 | Hard join on `$session.user` | High -- runtime-evaluated |
| 6 | Hard join on nullable FK | High -- should be lazy association |
| 7 | Scalar subselect in SELECT list | High |
| 8 | `SELECT *` in ABAP | High -- always specify fields |
| 9 | `SELECT` inside LOOPs | Critical -- use FOR ALL ENTRIES or JOINs |
| 10 | CDS Hierarchy for N:1 parent-child data | Critical -- use AMDP/CDS Table Function |

---

## Clean Core (NON-NEGOTIABLE)

### Rules

- No modifications to SAP standard objects -- ever
- No implicit enhancements in SAP standard includes
- Extensions only via released APIs and BAdIs
- Side-by-side extensions preferred (BTP, CAP) over on-stack modifications

### Before Using Any SAP Object -- Check Classification

- **C1 (Use System-Internally)** -- do NOT use
- **C0 (Not Released)** -- do NOT use
- **Released for customer** -- safe to use
- Use `abap-docs sap_search_objects` (set `system_type: "on_premise"`, `clean_core_level: "A"`)

### SAP Data Modification Hierarchy (MANDATORY — no exceptions, not even POCs)

| Priority | Approach | When |
|---|---|---|
| 1 | **EML** (`MODIFY ENTITIES`) | RAP BO (BDEF) exists for the object |
| 2 | **Released BAPI / API class** | No RAP BO, but released BAPI exists |
| 3 | **Released FM** | No BAPI, but released FM exists |
| 4 | **STOP and ask user** | Nothing released -- NEVER direct DB update |

**Direct UPDATE/INSERT/DELETE on SAP tables = NEVER. No exceptions. Not even for POCs in $TMP.**

Root cause: POC code becomes production code. A direct `UPDATE t352r` was attempted instead of using `DIWPS_REV_UPDATE` BAPI -- caught in review, would have caused compliance issues on a customer system.

### Clean Core by Technology

**CDS:** Extend via `EXTEND VIEW ENTITY` -- never copy. Projection views (`C_*`) on top of interface views (`I_*`) -- never expose I_ directly.

**BAdIs:** Only released BAdIs. Use `CL_BADI_FACTORY=>GET_BADI`. Never classic user exits (`EXIT_*`).

**ABAP:** Never inherit from unreleased SAP classes. Prefer `CL_*` released APIs over `RFC_*`/`BAPI_*`.

**OData:** Never hand-craft -- always generate from CDS + Service Binding.

### Violations Table

| Violation | Clean Core Alternative |
|---|---|
| Modifying SAP standard include | Implement released BAdI |
| Copying SAP standard class to Z/Y | Use released API or BAdI |
| Direct UPDATE on SAP standard tables | Use EML > BAPI > released FM (see hierarchy above) |
| Classic user exits (EXIT_*) | Released BAdI only |
| `SELECT * FROM MARA` | CDS view with specific fields |
| `SELECT` inside a LOOP | CDS JOIN or FOR ALL ENTRIES |

---

## RAP Patterns

### Currency Field Readonly Constraint (RAP/OData V4)

**Rule:** In RAP `strict(2)`, if an amount field (annotated with `@Semantics.amount.currencyCode`) is editable, its associated currency code field **cannot** be marked `field (readonly)` in the BDEF.

**Error:** `"A static read-only field 'CURRENCY' is not allowed for an editable amount field"` — thrown during service binding publish, not BDEF activation.

**Fix:** Remove the currency field from `field (readonly)`. Use a `determination on modify { create; }` to set it automatically, and `@UI.hidden: true` in the MDE to hide it from users. The field is technically writable via OData but invisible in the UI.

**If the amount field should also be read-only** (display-only scenario): mark both fields readonly — that combination is valid.

---

### JOIN-derived fields and Draft Tables

When a CDS interface view uses a LEFT OUTER JOIN to bring in a computed/text field (e.g. `ObjTypeText` from a customizing table), RAP's draft schema validation requires that field to exist in the draft table — even if it is never written.

**Symptoms:** BDEF activation error: `"[DRAFTABLE] is not a suitable draft persistency for [ENTITY] (there is no '[FIELDNAME]' field)"`

**Fix (two steps):**
1. Add the field to the draft table with the same type as the CDS field
2. Mark the field as `field ( readonly )` in the BDEF — RAP will never attempt to write it, and it stays empty in the draft table

**Why JOIN instead of association:** RAP association navigation (e.g. `_ObjTypeText`) is the preferred CDS pattern, but `@Common.Text` with association path syntax is not valid in ABAP CDS on S/4HANA 2023 (causes "Unexpected word" parser error). The JOIN approach brings the text in as a real field, enabling `Common.Text` via annotation.xml instead.

### RAP Admin Data Pattern (strict(2) — AVOID DUMP LCX_ABAP_BEHV_DETVAL_ERROR)

**Problem:** `determination SetAdminData on save { create; update; }` + `MODIFY ENTITIES IN LOCAL MODE` inside it causes `LCX_ABAP_BEHV_DETVAL_ERROR` ("Infinite loop caused by cyclical triggering of on-save determinations") in strict(2). Even LOCAL MODE MODIFY re-triggers the on-save determination framework.

**Fix — split into two determinations:**

```abap
" BDEF:
determination SetAdminData   on save   { create; }
determination SetChangedData on modify { field RiskDesc, Probability, ...; }  " business fields only
```

```abap
" SetAdminData — fires once on create, sets all 4 admin fields at once:
METHOD setadmindata.
  DATA(utcnow) = utclong_current( ).
  DATA(user)   = cl_abap_context_info=>get_user_technical_name( ).
  MODIFY ENTITIES OF <bdef> IN LOCAL MODE
    ENTITY <alias>
      UPDATE FIELDS ( CreatedBy CreatedAt ChangedBy ChangedAt )
      WITH VALUE #( FOR key IN keys (
        %tky = key-%tky  CreatedBy = user  CreatedAt = utcnow
        ChangedBy = user  ChangedAt = utcnow ) ).
ENDMETHOD.

" SetChangedData — fires on modify of business fields only:
METHOD setchangeddata.
  DATA(utcnow) = utclong_current( ).
  DATA(user)   = cl_abap_context_info=>get_user_technical_name( ).
  MODIFY ENTITIES OF <bdef> IN LOCAL MODE
    ENTITY <alias>
      UPDATE FIELDS ( ChangedBy ChangedAt )
      WITH VALUE #( FOR key IN keys (
        %tky = key-%tky  ChangedBy = user  ChangedAt = utcnow ) ).
ENDMETHOD.
```

**Why it works:** `on save { create; }` cannot re-trigger itself. `on modify { field <businessFields>; }` watches only fields that the determination never modifies, so no cycle.

Also: `authorization master ( instance )` in BDEF **requires** `get_instance_authorizations FOR INSTANCE AUTHORIZATION` handler — even for POCs. Omitting it causes a dump. For POC, grant all: set `%update = if_abap_behv=>auth-allowed` and `%delete = if_abap_behv=>auth-allowed` for all keys.

---

### DDIC Table DDL — CURR/CUKY Currency Reference Syntax

`@Semantics.amount.currencyCode` in a **DDIC table DDL** (`define table`) requires the **fully qualified** `'table.field'` format — NOT just `'field'`. Using a bare field name like `'waers_cc'` causes the system to treat it as a structure name (appending a `.` internally), resulting in "Annotation with reference to currency code for field X is uncomplete".

**Correct:**
```abap
waers_cc          : waers;
waers_gbl         : waers;
@Semantics.amount.currencyCode : 'znw_ev_item.waers_cc'
planned_cost_cc   : abap.curr(23,2);
@Semantics.amount.currencyCode : 'znw_ev_item.waers_gbl'
planned_cost_gbl  : abap.curr(23,2);
```

**Wrong (causes "uncomplete" error):**
```abap
@Semantics.amount.currencyCode : 'waers_cc'   ← bare field name, NOT valid in table DDL
```

Additional rules:
- Both CUKY fields must be declared **before** any CURR fields that reference them
- This differs from CDS views, where the bare field name `'waers_cc'` IS valid

---

### RAP Side Effects — Must Be in Projection BDEF (C_)

**Rule:** Side effects defined in the interface BDEF (`R_`) are NOT visible to Fiori Elements. The OData `$metadata` annotations that FE reads are generated from the **projection BDEF** (`C_`). Define or reuse side effects in `C_`.

**Correct syntax** (BDEF DSL — no `$self.` prefix, `entity` keyword before association):
```abap
side effects {
  field ProjectId    affects entity _Items;
  field FiscalYear   affects entity _Items;
  field FiscalPeriod affects entity _Items;
}
```

**Common error:** `$self._Items` → parser error: "', | ;' was expected, not '.'". The `.` in `$self.` is treated as statement terminator. Use bare association name: `entity _Items`.

**Option A — reuse from R_ in C_ (cleanest):**
```abap
" In C_ projection BDEF:
use side effects;
```

**Option B — define directly in C_:**
```abap
" In C_ projection BDEF:
side effects {
  field MyField affects entity _Child;
}
```

After activating C_, **republish the service binding** so OData `$metadata` is regenerated with the new annotations. FE picks them up automatically — no `manifest.json` changes needed on S/4HANA 2023.

### RAP Quick Rules

- Managed RAP + draft enabled for transactional apps
- `@Metadata.allowExtensions: true` on interface views
- Lock behaviour defined explicitly
- Feature control for all actions
- `FOR ACTION` handler keyword for both static and instance -- BDEF declaration controls type

### RAP Action Diagnostics

**Diagnosing empty action results:**

1. Check a hardcoded `abap.char` field (e.g. FileName) in response
2. FileName empty -> `it_action_instance` empty -> check frontend OData URL pattern:

| Frontend URL | Required BDEF declaration |
|---|---|
| `POST /EntitySet(key)/Ns.Action` | `action Action` (instance) |
| `POST /EntitySet/Ns.Action` | `static action Action` |

3. FileName correct, CsvContent empty -> type issue: large fields must be `abap.string`, NOT `abap.char(n)`
4. After fix: unpublish + republish service binding

**B23 limitations:** `[draft]` action modifier NOT supported. `FOR STATIC ACTION` may not compile -- use `FOR ACTION`.

**OData V4 Guid key:** No quotes -- `Entity(Id=<uuid>)/Action`, NOT `Entity(Id='<uuid>')`.

### OData V4 Action Response Formats

| BDEF declaration | Response shape |
|---|---|
| `static action X result [1] AE` | Root level: `{ "Field1": "val" }` |
| `static action X result [0..*] AE` | Array: `{ "value": [{ "Field1": "val" }] }` |
| `action X result [1] $self` | Root level entity fields |
| No result declared | HTTP 204 No Content |

---

## Development Workflows

### New Transactional App (RAP + Fiori Elements)

1. `fiori-mcp` to scaffold app
2. CDS Interface View (`znw_I_*`) with `@AbapCatalog`, `@AccessControl: #CHECK`
3. CDS Projection View (`znw_C_*`) -- no `@UI`, add `@Consumption.valueHelpDefinition`
4. Metadata Extension -- all `@UI`, `@Search`, `@Consumption`
5. Behaviour Definition (managed, draft enabled)
6. Behaviour Implementation (`znw_BP_*`)
7. Service Definition (`znw_SD_*`) -- expose main entity + ALL value help views
8. Service Binding OData V4 (`znw_SB_*_O4`) -- publish
9. `fiori-mcp fetch-service-metadata` -> `generate-fiori-ui-application`
10. Test end-to-end

### Activation Order for RAP Stack

1. Table + draft table first
2. Interface CDS view
3. Projection CDS view
4. Metadata Extension
5. Handler class + base BDEF + DCL together (circular dependency)
6. Projection BDEF + service definition together
7. Service binding (create in Eclipse, publish via MCP)

### Extending SAP Standard (Clean Core)

1. Search for released BAdI via `sap-docs`
2. Verify release state
3. Create BAdI implementation in `znw_` namespace
4. Never copy SAP standard

### PM Notification + Work Order — Single-LUW Pattern (1 commit only)

To create a PM notification and a work order in one shot without any commit between them:

**Working sequence:**
1. `create_notification` with `iv_commit_work = abap_false` → notification staged in PM buffer, temp number (e.g. `%00000000001`)
2. `set_notif_putinprogress` → update status in PM buffer
3. **Do NOT call `save_notification`** — this is the critical rule
4. `BAPI_ALM_ORDER_MAINTAIN` with `CREATETONOTIF` using the **temp number** → reads notification from PM buffer, creates WO + saves notification in one operation
5. `cl_ibapi_t=>get_instance( )->set_rap_flag( abap_false )` then single `commit_data()`

```abap
DATA(lv_notif_tmp) = ls_notifhdre-notif_no.   " capture temp BEFORE any save

DATA(lt_methods) = VALUE bapi_alm_order_method_t(
  refnumber = znw_cl_constants=>gc_order-first_refnr
  ( objectkey  = znw_cl_constants=>gc_order-order_tmp && lv_notif_tmp
    objecttype = znw_cl_constants=>gc_order_objecttype-header
    method     = znw_cl_constants=>gc_order_method-createtonotif )
  " NO partner method — let the partner determination profile handle it
  ( objectkey = znw_cl_constants=>gc_order-order_tmp
    method    = znw_cl_constants=>gc_order_method-save ) ).
```

**Why `save_notification` breaks it:**
- `BAPI_ALM_NOTIF_SAVE` moves the notification from the PM buffer into the update task queue
- After that, `BAPI_ALM_ORDER_MAINTAIN` CREATETONOTIF can't find it in the buffer AND can't find it in DB (not committed) → `IM-502: Notification does not exist`
- `together_with_order = abap_true` in `BAPI_ALM_NOTIF_SAVE` does NOT help — same result

**Partner rule:** Do NOT explicitly pass partner methods for PM maintenance orders. The partner determination profile for the order type handles this automatically. Passing `AG`/`SP` role causes `"Partner function SP is not allowed in partner determination profile PM"`.

**Confirmed working on B23 (S/4HANA 2023), order type YBA2, notification type D3.**

---

### COMMIT WORK Consolidation Pattern (Aircraft Events POC, 2026-03-27)

When orchestrating multiple SAP business objects (Notification, SO, Revision, Equipment), the minimum commits are constrained by **cross-object DB validation**:

| Constraint | Root Cause |
|---|---|
| SO BAPI validates `notif_no` exists in DB | `IM-502: Notification does not exist` |
| Revision `add_notif_rev_link` validates notif in DB | Same IM-502 via `NOTIFICATION_ASSIGN_CHECK` |
| Network created via update task (async) | Only in AUFK after `COMMIT WORK` |

**Minimum achievable: 2 commits + 1 housekeeping** (down from original 4):

```
COMMIT 1 (AND WAIT): Equipment + Notification + Event
COMMIT 2 (AND WAIT): SO (with notif) + SO-Notif link + Revision (with notif link)
POST-COMMIT:         Network update via DIWPS_REV_UPDATE BAPI
```

**Key learnings:**
- `COMMIT WORK AND WAIT` ensures update tasks complete before next step
- Revision network must be updated post-commit via `DIWPS_REV_UPDATE` BAPI (Clean Core)
- `add_notif_rev_link` must happen pre-commit while WPS buffer is fresh, but after notif is in DB
- Omitting `notif_no` from SO header bypasses IM-502 but loses the header reference
- 1 commit is NOT possible on B23 (S/4HANA 2023) -- no RAP BOs for Notification or Revision
- **Exception:** If you do NOT link notif to SO at header level, you can create Notification + SO + CRM service order in 1 commit (see section below)

---

## Transport Strategy

- One transport per feature/bug fix -- never mix unrelated changes
- Format: `[TICKET-ID] Brief description`
- DEV transports only -- QAS and PRD receive via import queue
- Release order: task first, then request
- `$TMP` for investigation/temp objects -- no transport needed

---

## runClass Pattern

### Template

```abap
CLASS zcl_tmp_investigate DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION. INTERFACES if_oo_adt_classrun.
ENDCLASS.
CLASS zcl_tmp_investigate IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    " investigation logic
    out->write( 'result' ).
  ENDMETHOD.
ENDCLASS.
```

- Always Z namespace, `$TMP`
- Always `login` immediately before `runClass`
- Always delete after use

### CDS View Access Classification (run before real test)

```abap
SELECT COUNT(*) FROM znw_i_someview INTO @DATA(lv_count).
out->write( lv_count ).
```

| Error | Meaning | Fix |
|---|---|---|
| "parameter P_X was not bound" | Parameterised | Use `FROM view( p_x = @val )` |
| "not a database entity with parameters" | Not parameterised | Use plain WHERE |
| 0 rows, no error | GTT-backed | Populate GTTs via owning class first |
| Rows returned | Plain view | Proceed normally |

### GTT-Backed Views (Pegging)

All `I_Pegging*` views are GTT-backed. Populate first:
```abap
DATA(lo_con) = znw_cl_pegging_con=>sr_instance.
DATA(lt_dem) = lo_con->process_demand( ir_matnr = lr_matnr ir_werks = lr_werks ).
DATA(lv_reqid) = lt_dem[ 1 ]-requirementid.
```

### Write Side-Effect Check

Before timing a business method, grep for write operations (`UPDATE`, `COMMIT`, `INSERT`). If writes exist: time once only, never in a loop. Root cause: `process_supplies` called 5x blocked on DB lock from first 3 commits.

### DS4 runClass Workaround

`out->write()` broken for `znw_` classes on DS4. Use `UPDATE <table> SET field = @result` + `COMMIT WORK`, then read back via `runQuery`.

---

## Products & Catalog

### Catalog-First Development

Before creating any new object:
1. Read `catalogs/registry.json` for product -> package mapping
2. Read product catalog (`DRU_IAM-catalog.json` or `DRU_LCRB-catalog.json`)
3. If reusing from `znw_COMMON`: check the CON/MOD pair
4. Only create if nothing suitable exists

### Key Packages

| Package | Contents |
|---|---|
| `znw_COMMON` | 95 classes + 18 interfaces -- always check first |
| `znw_ESTIMATION` | Full RAP estimation module |
| `znw_LCRB_CONTENT` | 200+ analytical CDS views |
| `znw_PEGGING` | Pegging solution (GTT-backed views) |

---

## Investigate Before Asking

Always search TADIR/system for existing objects before asking the user. Use `searchObject` with appropriate filters. If a previous session built something, it is in the SAP system -- find it, do not ask.

### ABAP API Verification

```abap
DATA lo_cls TYPE REF TO cl_abap_classdescr.
lo_cls ?= cl_abap_typedescr=>describe_by_name( 'CL_SOME_CLASS' ).
LOOP AT lo_cls->methods INTO DATA(lm) WHERE name = 'MY_METHOD'.
  LOOP AT lm-parameters INTO DATA(lp).
    out->write( |{ lp-parm_kind } { lp-name }| ).
  ENDLOOP.
ENDLOOP.
```

---

## Known SAP API Gotchas

### cl_eam_tasklist->read

Requires `IV_OBJ_SEL_HTL = abap_true` or silently returns no data (error `CM_EAM_TL_API 101`). All task lists in MY dev are hierarchical. Always apply `CONVERSION_EXIT_ALPHA_INPUT` to PLNNR/EQUNR.

### CO/WBS Domain Defaults

- Controlling area: query `SELECT kokrs FROM tka01 UP TO 5 ROWS` -- never PRPS
- Ledger: hardcode `'0L'`
- Planning category: try `'PLN01'` first

### OData Service Investigation Pattern (for external dashboards)

When building external HTML dashboards that consume SAP data, follow this **exact** sequence. Do NOT skip steps or guess URLs — every wrong guess wastes 5+ tool calls.

**Step 1 — Find the service binding:**
`searchObject` with `objType: 'SRVB'` — search by domain keyword (e.g., `*Project*`, `*LCRB*`)

**Step 2 — Read the service definition source:**
`getObjectSource` on `/sap/bc/adt/ddic/srvd/sources/<name>/source/main` — shows all exposed entities and their CDS view mappings. (`bindingDetails` tool is broken — don't use it.)

**Step 3 — Read each CDS view source** to understand fields, parameters, and annotations.

**Step 4 — VERIFY the OData URL with a runner class BEFORE building anything:**
```abap
cl_http_client=>create_by_destination( EXPORTING destination = 'NONE' IMPORTING client = lo_client ).
lo_client->request->set_header_field( name = '~request_uri'
  value = '/sap/opu/odata/znw_LCRB_PROJECTS/?$format=json&sap-client=100' ).
lo_client->send( ). lo_client->receive( ).
lo_client->response->get_status( IMPORTING code = lv_code ).
" Must be 200. If 403/404, the URL is wrong — do NOT proceed to build the dashboard.
```
This takes 1 runner class. Skipping this step and guessing cost us 15+ tool calls in the EV report project.

**Step 5 — Build proxy + dashboard** only after URL returns 200 from ABAP.

---

### OData URL Format (CRITICAL — namespaced services)

For `znw_` namespaced V2 services, the namespace is a **path segment** — NOT URL-encoded, NOT in the `sap` segment:

| URL | Result | Why |
|---|---|---|
| `/sap/opu/odata/znw_LCRB_PROJECTS/` | **200 OK** | Namespace as path segment |
| `/sap/opu/odata/sap/LCRB_PROJECTS/` | 403 | "No service found" — wrong namespace |
| `/sap/opu/odata/sap/%2FDRU%2FLCRB_PROJECTS/` | 403 | URL-encoded `/` parsed as literal chars |
| `/sap/opu/odata4/sap/LCRB_PROJECTS/0001/` | 404 | V4 path — service is V2 |

**Pattern:** `/sap/opu/odata/<namespace>/<service_name>/`

For SAP standard (no namespace): `/sap/opu/odata/sap/<service_name>/`

**Parameterized entity sets (OData V2):**
```
EntitySet(P_Param1='value1',P_Param2='value2')/Results?$filter=Field eq 'value'
```

---

### External Dashboard Hosting (Node.js proxy pattern)

Browsers cannot call SAP OData directly from local HTML files (CORS + TLS issues). **Always use a local proxy:**

1. **server.js** — Node.js `http` + `https` proxy (no npm dependencies needed):
   - Serves HTML on `http://localhost:<port>`
   - Forwards `/sap/*` requests to SAP with Basic Auth + CSRF token + cookies
   - Handles TLS (`rejectUnauthorized: false` for self-signed SAP certs)
2. **index.html** — Uses relative paths (`/sap/opu/odata/...`) — proxy rewrites to SAP host
3. **Never** use dual-mode (proxy vs direct) — it causes port-detection bugs. Always require the proxy.

**Proxy must:**
- Fetch CSRF token on startup via `x-csrf-token: Fetch` header
- Maintain SAP session cookies across requests
- Build clean headers (don't forward browser headers to SAP — causes 403)
- Auto-retry on 403 (session expired → clear cookies → re-auth)

**SAP credentials in proxy:** Read from env vars or hardcode for dev. Never prompt in browser — it adds complexity and fails with CORS.

---

### Known MY OData Services

| Service Binding | Gateway URL | Entities |
|---|---|---|
| `znw_LCRB_PROJECTS` | `/sap/opu/odata/znw_LCRB_PROJECTS/` | Project, WorkBreakdownStructure, WbsPerformance (params), ProjectPerfomance (params), ProjectCostLineItems, ProjectCommitAging |
| `ZCAP_KBED_SRV` | `/sap/opu/odata/sap/ZCAP_KBED_SRV/` | CapacityRequirementSet (ECC capacity) |

### MDE `@UI.facet` Placement (B23)

`@UI.facet` must be placed at **element level** inside the `annotate entity ... with { }` block — NOT at view level before `annotate entity`. Placing it before `annotate entity` causes "Annotation 'UI.facet.X' used at wrong position (wrong scope)" for every sub-element. `@UI.headerInfo` CAN go before `annotate entity` as a view-level annotation. Pattern:

```cds
@Metadata.layer: #CORE
@UI.headerInfo: { ... }          ← view-level: OK before annotate
annotate entity znw_C_X with
{
  @UI.facet: [{ purpose: #STANDARD, type: #IDENTIFICATION_REFERENCE, ... }]  ← inside {}
  @UI.hidden: true
  KeyField;
  ...
}
```

### Draft Table Rules

1. Field names = CDS view field names (CamelCase), NOT DB column names
2. Must include `sych_bdl_draft_admin_inc`
3. Calculated CDS fields (CASE) must exist in draft table with matching types
4. Use `cast(case ... as <explicit_type>)` to control types
5. Cannot shrink field after activation -- plan upfront or delete+recreate

### RAP BP Class — Local Handler Classes

The BP class shell (main source) contains only the `FOR BEHAVIOR OF` declaration. All handler classes go in the **`implementations` include**:
- URL: `/sap/bc/adt/oo/classes/{name}/includes/implementations`
- NOT `ccimp`, NOT `includes/ccimp` — the path is literally `includes/implementations`

Pattern (from `znw_BP_R_RISK`): define and implement both `lhc_<root>` and `lhc_<child>` handler classes in the same include.

### RAP BP Class — Reserved Words as Method Names

`LOCK` is a reserved ABAP keyword and **cannot** be used as a method name. Name the action handler method `execute_lock` (or similar). The method still handles the `Lock` action via the FOR MODIFY / FOR ACTION signature:

```abap
METHODS execute_lock FOR MODIFY
  IMPORTING keys FOR ACTION EvSnapshot~Lock
  RESULT result.
```

### RAP Early Numbering — CBA Child Entity

For a child entity created via association (CBA), early numbering belongs on the **parent** handler class (not the child handler), and references the association path:

```abap
" In lhc_<parent>:
METHODS earlynumbering_cba_items FOR NUMBERING
  IMPORTING entities FOR CREATE EvSnapshot\_Items.

METHOD earlynumbering_cba_items.
  LOOP AT entities INTO DATA(entity).
    LOOP AT entity-%target INTO DATA(target).
      TRY.
          APPEND VALUE #(
            %cid       = target-%cid
            %is_draft  = target-%is_draft
            EvItemUuid = cl_system_uuid=>create_uuid_x16_static( )
          ) TO mapped-evsnapshotitem.
        CATCH cx_uuid_error.
      ENDTRY.
    ENDLOOP.
  ENDLOOP.
ENDMETHOD.
```

Method naming convention: `earlynumbering_cba_<assoc>` where `<assoc>` is the association name without the leading underscore (e.g. `_Items` → `earlynumbering_cba_items`).

`cl_system_uuid=>create_uuid_x16_static()` raises `CX_UUID_ERROR` — always wrap in TRY/CATCH.

### RAP CBA Create — Explicit `%control` Required When Building Target Table Separately

**Problem:** When building a `%target` table via `APPEND VALUE #(...)` in a separate LOOP and then passing it via a `TABLE FOR CREATE BO\_Assoc` variable, the rows ARE created but ALL field values are blank in the database.

**Root cause:** `%control` bits are only auto-set when `VALUE #(...)` is used **inline** directly in the MODIFY statement's FROM clause. When you APPEND to a table variable and reference it in FROM, the `%control` bits remain `mk-off` → RAP writes nothing for those fields.

**Fix:** Explicitly set `%control` for every data field in the APPEND VALUE:

```abap
DATA lt_items TYPE TABLE FOR CREATE znw_R_EvSnapshot\_Items.
DATA ls_cba   LIKE LINE OF lt_items.

ls_cba-%tky = ls_snap-%tky.
LOOP AT lt_nodes INTO DATA(ls_node).
  lv_cnt += 1.
  APPEND VALUE #(
    %cid      = |ITEM{ lv_cnt }|
    %is_draft = if_abap_behv=>mk-on
    %control  = VALUE #(                          " <-- REQUIRED when building separately
      ObjectType          = if_abap_behv=>mk-on
      ObjectKey           = if_abap_behv=>mk-on
      ParentKey           = if_abap_behv=>mk-on
      Description         = if_abap_behv=>mk-on
      PlannedCostCC       = if_abap_behv=>mk-on
      CompanyCodeCurrency = if_abap_behv=>mk-on
      PctComplete         = if_abap_behv=>mk-on
    )
    ObjectType          = ls_node-object_type
    ObjectKey           = ls_node-object_key
    ...
  ) TO ls_cba-%target.
ENDLOOP.
APPEND ls_cba TO lt_items.

MODIFY ENTITIES OF znw_R_EvSnapshot IN LOCAL MODE
  ENTITY EvSnapshot CREATE BY \_Items FROM lt_items
  REPORTED DATA(lt_rep).
```

**Symptom to recognise:** CBA rows exist in the draft table, correct count, but every data column is blank/initial.

**Also required:** `%is_draft = if_abap_behv=>mk-on` on each `%target` item — omitting this causes `CX_ABAP_BEHV_RUNTIME_ERROR` ("Illegal mixture of ACTIVE and DRAFT") short dump.

### Object Types That Cannot Be Created via MCP `createObject`

| Object | Why | Workaround |
|---|---|---|
| `SRVB/SVB` Service Binding | Requires binding type + service def reference | Create in Eclipse: New → Service Binding, set OData V4 UI + service def, then MCP can publish |
| `DDLX` Metadata Extension | Unsupported object type | Create in Eclipse: New → Metadata Extension, set annotated entity, then MCP can lock/set source/activate |

### MDE Body — Association Rules

In a metadata extension (`annotate entity ... with { }`), every element listed in the body **must have at least one annotation**. Do NOT list association names without annotations. If you need to reference a navigation property for a `#LINEITEM_REFERENCE` facet, use `targetElement:` in the `@UI.facet` annotation — no need to list the association in the body.

```cds
" WRONG — causes "Element '_Items' must have at least one annotation"
_Items;

" CORRECT — reference via facet targetElement only
@UI.facet: [{ type: #LINEITEM_REFERENCE, targetElement: '_Items', ... }]
" No _Items; entry in body needed
```

---

## SAP PM / QM Data Model

### Equipment ↔ Functional Location Table Model

`EQUI` has **no TPLNR field**. The functional location assignment is time-based and stored in:

```
EQUZ (equipment time segment)
  key: EQUNR + DATBI + EQLFN
  EQUZ-ILOAN → ILOA-ILOAN
  ILOA-TPLNR = functional location where equipment is currently installed
```

**To find equipment currently installed at a FLOC:**

```abap
SELECT SINGLE e~equnr
  FROM equz AS e
  INNER JOIN iloa AS l ON e~iloan = l~iloan
  INTO @DATA(lv_equnr)
  WHERE l~tplnr = @lv_tplnr
    AND e~datbi  = '99991231'   " current installation (not yet removed)
    AND e~lvorm  = space.
```

- `DATBI = '99991231'` = current (not yet dismantled) installation record
- If multiple equipment at one FLOC, add filter on `EQUI-EQART` (equipment category)

### QALS Reference Object Fields

QALS uses `ls_` prefix for reference object fields — these are NOT named `equnr` / `tplnr` directly:

| Field | Type | Meaning |
|---|---|---|
| `qals-ls_equnr` | `equnr` | Equipment number for the inspection lot |
| `qals-ls_tplnr` | `tplnr` | Functional location for the inspection lot |

```abap
" Correct:
l_qals-ls_equnr = lv_equnr.   " NOT l_qals-equnr

" Check equipment field in QALS via class method:
" CLASS-METHODS check_equipment IMPORTING iv_equnr TYPE qals-ls_equnr (FG QPL1, lcl_access)
```

### IW31 / PM Order Enhancement Points

**All IWO1000x user exits are read-only** — `EXIT_SAPLCOIH_009`, `EXIT_SAPLCOIH_018` etc. all pass `CAUFVD_IMP` as `IMPORTING VALUE(CAUFVD_IMP) LIKE CAUFVD`. Cannot modify order header fields through them.

**WORKORDER_UPDATE BAdI** (`ENHS/XSB`, released) — all methods have only IMPORTING parameters. Cannot modify CAUFVD.

**To modify CAUFVD header fields** before order is written to AUFK: use ES_SAPLCOIH named spots (ENHS/XS — on-premise implementable, not released API). ES_SAPLCOIH and ES_SAPLCOQM are `ENHS/XS` (classic enhancement spots) — implementable via SE18 on on-premise S/4HANA but NOT on Public Cloud.

### QPL1 Inspection Lot Creation (PM Integration)

Inspection lot is created at **order RELEASE** (not save). Chain: `STATUS_CHANGE_FOR_ACTIVITY` (ILCR) → `CO_QM_INSPECTION_LOT_CREATE` (FG COQM) → `QPL1_INSPECTION_LOT_CREATE` (FG QPL1).

**Key**: `CO_QM_INSPECTION_LOT_CREATE` never sets `l_qals-ls_equnr`. QPL1's `FORM auftrag_db` reads AUFK into `caufvwa` but does NOT copy `caufvwa-equnr` to `qals-ls_equnr`. So whatever is set in `l_qals-ls_equnr` before calling QPL1 persists.

**Enhancement point `co_qm_inspection_lot_create_01` in ES_SAPLCOQM** fires before QPL1 is called and covers ALL order creation paths (IW31 dialog, BAPI, IP10/30, IW34).

---

## S/4HANA 2023: CRM Service Order Tables

**`CRMD_ORDERADM_H` and `CRMD_ORDERADM_I` are EMPTY in S/4HANA 2023.** Do not use them for service order lookups.

| Purpose | Correct Table (S/4 2023) | Key Fields |
|---|---|---|
| Service order header GUID | `CRMS4D_BTX_H` | `GUID` (header GUID), `OBJECT_ID` (service order number) |
| Service order items | `CRMS4D_BTX_I` | `ITEM_GUID` (item GUID), `HEADER_GUID` (FK to BTX_H), `OBJTYPE_I` (object type) |

### Linking a PM Order to a Service Order (Standalone — not via BTX framework)

After `BAPI_ALM_ORDER_MAINTAIN` creates the PM order, `CRMD_BRELVONAE` is NOT updated automatically. Must call:

1. `CL_CRMS4_SRV_MNO_UTIL->PROCESS_DOCFLOW` — writes to CRM buffer
2. `CRM_ORDER_SAVE` — flushes buffer to `CRMD_BRELVONAE`
3. `BAPI_TRANSACTION_COMMIT` (or equivalent) — commits both in one LUW

**Do NOT pass `SERVICE_DOC_ID/TYPE/ITEM_ID` on CREATE** — causes SD document validation failure. SAP's own code comments these out on create. Only set them on UPDATE after the order exists.

**RAP flag + IBAPI_PROC_INIT_REQUEST are mandatory** before calling `BAPI_ALM_ORDER_MAINTAIN` in S/4 2023:
```abap
cl_ibapi_t=>get_instance( )->set_rap_flag( abap_true ).
CALL FUNCTION 'IBAPI_PROC_INIT_REQUEST' EXPORTING iv_unlock_msco = ' '.
" ... BAPI call ...
cl_ibapi_t=>get_instance( )->set_rap_flag( abap_false ).
```

---

## MCP Tool: getObjectSource — Correct Parameter Name

**Parameter is `objectSourceUrl`, NOT `url`.** Passing `url` leaves `args.objectSourceUrl` as `undefined`, causing `Cannot read properties of undefined (reading 'match')` crash in `ValidateObjectUrl`.

```javascript
// WRONG — crashes with match on undefined
getObjectSource({ url: "/sap/bc/adt/..." })

// CORRECT
getObjectSource({ objectSourceUrl: "/sap/bc/adt/..." })
```

URL is obtained from `searchObject` → `adtcore:uri` field. For DDLS/DF (projection views), append `/source/main` is NOT needed — use the URI as-is.

---

## CDS Performance Analysis — Scope Rule

**Only analyse CDS views in the `znw_` namespace.** Do NOT trace into or flag issues in SAP standard views (e.g. `I_MaterialStock`, `I_Plant`, `I_ReservationItem`). The analysis scope ends at the boundary where a `znw_` view calls a non-`znw_` view. Note the SAP standard view name as a dependency, but do not analyse its internals.

Full pattern documented in `projects/sap-service-mgmt/knowledge/cl_crms4_proc_maint_fwd.md`.

---

## JCDS — Status Change History (CHIND field)

JCDS stores every status change for PM/QM objects. The `CHIND` field is critical:

| CHIND | Meaning |
|-------|---------|
| `' '` (blank) | Status was **SET** (activated) |
| `'U'` | Status was **DELETED** (deactivated / reset) |

**To get the most recent date a status was activated** (e.g. TSRL = `I0155`):
```abap
SELECT MAX( udate ) FROM jcds
  WHERE objnr = @lv_objnr
    AND stat  = 'I0155'
    AND chind = ' '        " blank = SET — NOT 'U'
  INTO @lv_date.
```

Using `chind = 'U'` returns the last time the status was **removed** — wrong if the status was reset and re-activated. Always use `chind = ' '` when you want the last activation date.

**OBJNR format for QM notification tasks:**
- `'QA' + QMNUM (12 chars) + task_number (4 chars)` → e.g. `QA0003000011080001`
- Type: `J_OBJNR` (22 chars, right-padded with spaces automatically)
