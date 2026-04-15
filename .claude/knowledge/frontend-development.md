# Frontend Development

UI5, Fiori Elements, and OData patterns for My development.

---

## FlexibleColumnLayout Setup

FCL needs `<m:App height="100%">` wrapper to take full viewport height. Without it, FCL renders at content height (~160px).

```xml
<mvc:View xmlns="sap.f" xmlns:m="sap.m" xmlns:mvc="sap.ui.core.mvc" displayBlock="true">
  <m:App height="100%">
    <FlexibleColumnLayout id="app" layout="{/layout}" />
  </m:App>
</mvc:View>
```

Also required in CSS: `html, body.sapUiBody, .sapUiComponentContainer { height: 100%; }`

---

## UI5 Rules

### Always Do

- Call `ui5` MCP server before writing any UI5 code -- get correct API version
- Run UI5 linter after every change via `ui5` server
- Use `sap.m` controls for mobile-first Fiori apps
- Use `sap.ui.model.odata.v4.ODataModel` for V4 services
- Search `fiori-mcp search_docs` before writing any annotation

### Never Do

- Never use deprecated UI5 APIs
- Never use `jQuery.sap.*` -- all deprecated since UI5 1.58
- Never hardcode URLs -- always relative paths or destination service
- Never use `sap.ui.commons` -- deprecated since UI5 1.38
- Never bypass Fiori Launchpad for production apps
- Never hand-code Fiori apps -- always use `fiori-mcp` for scaffolding

---

## Deprecated APIs

Check deprecation status of every API before use. Never propose a deprecated API as a fix.

| Deprecated API | Since | Replacement |
|---|---|---|
| `Core.getMessageManager()` | UI5 1.98 | `sap/ui/core/Messaging` (singleton module) |
| `sap.ui.core.Core` (lazy require) | UI5 1.98+ | Specific modules: `sap/ui/core/Messaging`, `sap/ui/core/EventBus` |
| `jQuery.sap.*` (all) | UI5 1.58 | `sap.ui.core` equivalents |
| `sap.ui.commons.*` | UI5 1.38 | `sap.m` equivalents |
| `$.sap.delayedCall()` | UI5 1.x | `setTimeout()` (native) |
| `sap.ui.model.odata.ODataModel` (v1) | UI5 1.x | `sap.ui.model.odata.v2.ODataModel` |
| `jQuery.Deferred` for async | -- | Native `Promise` |

Before proposing a fix:
1. Check API deprecation via `ui5` MCP server (`get_api_reference`)
2. If deprecated, use only the non-deprecated replacement
3. Confirm replacement requires UI5 version <= app's `minUI5Version` in `manifest.json`

If `ui5` MCP server unavailable: state that deprecation could not be verified, ask user to confirm.

---

## Fiori Elements vs Custom UI5

### Use Fiori Elements for:

- Standard transactional apps (List Report Object Page)
- Analytical apps (Analytical List Page)
- Standard CRUD operations
- RAP-backed services

### Use Custom/Freestyle UI5 only when:

- Fiori Elements floor plan cannot meet the UX requirement
- Always justify freestyle choice in transport description

### Analytical Apps with Large Datasets

See dedicated guide: `knowledge/analytical-app-best-practices.md` — covers CDS star schema, OData V2 auto-aggregation, AnalyticalBinding, virtual scrolling, Chart.js limits, filter pushdown, memory management, and WebWorker patterns.

### Estimation App -- Custom UI5 (NOT Fiori Elements)

The estimation app (MyConfig-manage) is a **custom UI5 app**:
- BDEF side effects do NOT drive UI refreshes (those only work with Fiori Elements)
- Refresh logic is in the UI5 controller code (`onSave`, `onAddObject`, etc.)
- To fix performance: change the UI5 controller, not the BDEF
- Fix target for $expand depth is OData model binding in controller/view XML

---

## MCP Server Usage for Frontend

### Which Tool for Which Question

| Question | Primary Tool | Backup |
|---|---|---|
| Fiori Elements annotations | `fiori-mcp search_docs` | `abap-docs search` (`abap-fiori-showcase`) |
| Floor plans (LROP, ALP, OVP) | `fiori-mcp search_docs` | `sap-docs` |
| FE extensions (custom columns, actions) | `fiori-mcp search_docs` | `abap-docs search` |
| Draft handling | `fiori-mcp search_docs` | `abap-docs search` (`abap-cheat-sheets`) |
| UI5 API / deprecation | `ui5` MCP server | `fiori-mcp search_docs` |
| Is SAP object released? | `abap-docs sap_search_objects` | `sap-docs` |
| Error troubleshooting | `abap-docs sap_community_search` | exact error text |
| Value help config | `fiori-mcp search_docs` | `abap-docs search` |
| App scaffolding | `fiori-mcp` (3-step workflow) | -- |

### abap-docs Source Selection

| Source ID | Best for |
|---|---|
| `abap-fiori-showcase` | Annotation examples |
| `abap-cheat-sheets` | Quick how-to snippets |
| `abap-platform-rap-opensap` | End-to-end RAP |
| `sap-styleguides` | Clean ABAP style guide |

---

## Scaffolding (MANDATORY for new apps)

ALWAYS use `fiori-mcp generate-fiori-ui-application`. Never hand-code.

**3-step workflow:**
1. `fiori-mcp list_functionality` -> find the generator
2. `fiori-mcp get_functionality_details` -> get parameters
3. `fiori-mcp execute_functionality` -> generate app

**After scaffolding:**
1. Store SAP system: `Fiori: Add SAP System`
2. Verify service URL from Eclipse preview (F12 Network tab)
3. `fetch-service-metadata` with system name as `sapSystemQuery`
4. Generate app with `metadataFilePath` from result

**Never guess UI5 version** -- let `fiori-mcp` choose it.

Root cause: hand-coding Material Request POC wasted 3+ iterations on wrong CDN URL, wrong UI5 version, wrong OData path.

---

## Fiori Elements — Version Compatibility Traps

### `expandedHeaderFragment` silently ignored in FE ≤ 1.120

`customHeader.expandedHeaderFragment` in the List Report manifest routing target is **silently ignored by SAPUI5/FE ≤ 1.120** (on-premise S/4HANA 2023 ships with ~1.120). The fragment is never loaded; no error is thrown.

**Fix:** Use a dual-path ControllerExtension:
1. Fast path: `onAfterRendering` → `this.getView().byId(fragmentControlId)` — works if FE loaded it via manifest (1.136+)
2. Slow path: if control not found after 500ms, inject via `Fragment.load()` + `DynamicPageHeader.addContent()`

**Never call `getModel()` from `onInit`** — the OData model is not yet bound to the view at that point. `onAfterRendering` is the earliest safe hook for model access.

See full reusable pattern: `.claude/knowledge/chart-in-list-report.md`

---

## OData Patterns

### OData V4 URL on B23 (on-premise)

**Correct:** `/sap/opu/odata4/sap/<binding_name>/srvd/sap/<service_def>/0001/`
**Wrong:** `/sap/opu/odata4/sap/<binding_name>/srvd_a2x/sap/<service_def>/0001/`

Always verify from Eclipse preview F12 Network tab.

### After ANY Service Definition Change

1. Unpublish service binding
2. Republish service binding
3. Re-fetch `metadata.xml` via `fiori-mcp fetch-service-metadata`
4. Copy to `webapp/localService/mainService/metadata.xml`
5. Restart dev server

---

## Value Help Configuration

### 3 Requirements (non-negotiable)

1. `@Consumption.valueHelpDefinition` on field in **projection view**
2. Value help view MUST be **exposed in service definition**
3. After service def change: unpublish + republish binding + re-fetch metadata

Missing step 2 = silent failure (no F4, "entityType undefined" in console).

### additionalBinding -- Auto-Fill from F4

```cds
@Consumption.valueHelpDefinition: [{
  entity: { name: 'I_ProductVH', element: 'Product' },
  additionalBinding: [{ localElement: 'QuantityUnit', element: 'BaseUnit', usage: #RESULT }]
}]
Material,
```

**Rules:**
1. For auto-fill: ALWAYS use `additionalBinding` `usage: #RESULT` -- never a determination
2. Choose VH view that has ALL needed fields
3. Never `@UI.hidden` a field that should be auto-filled
4. Determinations + side effects = for COMPUTED values only, not master data lookups
5. Use `I_ProductVH` (has BaseUnit), NOT `I_ProductStdVH` (cross-service issues on B23)

### Value Help Lookup Order (MANDATORY)

Before selecting a VH view, ASK user: "Do you want /DRU/ artifacts or standard SAP only?"

1. `/DRU/I_*VH` -- check `catalogs/my_VH-reference.md` + `my_VH-catalog.json`
2. `/DRU/C_*VH`
3. `I_*VH` -- SAP standard released
4. Other standard CDS -- last resort

**NEVER select a VH view from `$TMP` package.**

**NEVER use a non-VH view (e.g. `I_User`) as a value help source.** Generic CDS views lack the `@Search` and `@UI` annotations required for Fiori Elements to wire up the F4 dialog. Always use a dedicated `*VH` view (e.g. `/DRU/I_UserVH` not `I_User`).

### Key SAP Standard Value Helps

| View | Key | Notable Fields | Use When |
|---|---|---|---|
| `I_ProductVH` | Product | BaseUnit, ProductType, ProductGroup | Material + auto-fill UoM |
| `I_MaterialStdVH` | Material | Material_Text only | Material + description (no UoM) |
| `I_PlantStdVH` | Plant | PlantName | Standard plant selection |
| `I_MaintenanceOrderStdVH` | MaintenanceOrder | Equipment, Plant, OrderType | PM work order |
| `I_UnitOfMeasureStdVH` | UnitOfMeasure | text | UoM manual selection |

Full reference table with all views: see fiori-developer agent file.

---

## Side Effects

For COMPUTED values only (totals, calculations). NOT for F4 field auto-fill.
```
side effects { field BookingFee affects field TotalPrice; }
```

---

## Fiori Elements Specific

### Duplicate Toolbar Buttons (FE V4 LROP)

`controlConfiguration.actions` keys in manifest add NEW buttons -- they do NOT override annotation-driven `DataFieldForAction` buttons. Fix: override `@UI.LineItem` in `webapp/annotations/annotation.xml` to suppress duplicates. Target entity type name (e.g. `SAP__self.JobType`).

### SheetJS Integration for XLSX

Load `xlsx.min.js` in `webapp/lib/`, add `<script>` in `index.html` BEFORE `sap-ui-bootstrap`, access as `window.XLSX`. Not AMD -- cannot use `sap.ui.require`.

---

## Debugging Checklist (Fiori/OData issues)

1. **Get raw HTTP response** from user (F12 -> Network -> Response) -- replaces 10+ runClass iterations
2. Classify using response diagnostics:

| Response | Root Cause | Fix |
|---|---|---|
| `{ "error": { "message": "..." } }` | Backend exception | Fix ABAP method |
| `{ "FileName": "x", "CsvContent": "" }` | Backend returns empty string | Debug ABAP logic |
| `{ "value": [] }` | `it_action_instance` empty | URL mismatch (static vs instance) |
| HTTP 204 | No result declared in BDEF | Frontend must not parse body |

3. Only proceed to backend after confirming response is wrong/empty

---

## LCRB Config Format — Key Gotchas

When reading LCRB tile configs (Base64 JSON from `xmyxLCRB_I_REPORT.Configuration`):
- **Filters:** `preFilters[].property` (not `field`) is the field name. Always read both.
- **Chart type:** `chartSettings.type` (not `chartType`). ChartTile reads `type || chartType`.
- **Sorters:** `preSorters[].property` + `preSorters[].descending` — must map to OData `$orderby`.
- **Date filters:** `preFilters[].dateValue.operator` (LASTYEAR, THISYEAR, etc.) — null operator/value means date filter, not skip.
- **VH meta:** `preFilters[].meta.valueHelpEntity` + `valueHelpProperty` + `valueHelpColumns` — the correct VH entity from LCRB, not the transactional entity.
- **Metadata:** `chartSettings.metadata[]` stores `sap:label` per field — use for axis labels via `_getLabel()`.

## Reusable Value Help Library

`apps/dat-ai/webapp/lib/ValueHelpDialog.ts` — annotation-driven VH dialog for any UI5 app:
- Reads `@Common.ValueList` from OData MetaModel automatically
- V2: `ODataMetaModel.getODataValueLists(propertyContext)` / V4: `requestValueListInfo(path)`
- Opens `sap.m.SelectDialog` — key + description, server-side search, growing list
- Fallback to manual config when annotations unavailable
- `openValueHelp({ model, entitySet, property })` → `{ key, description }`

## UI5 Controls + Raw DOM — Do Not Mix

UI5 controls must NOT be placed into DOM that gets destroyed by `innerHTML = ""`. Controls own their DOM — external destruction orphans them. If using a full DOM rebuild pattern (like `_renderAllSections`), keep sections as raw DOM OR manage UI5 controls independently from the rebuild cycle.

## OData V4 — Edm.Decimal (CURR/QUAN fields) Must Be Strings

ABAP `CURR` and `QUAN` fields map to `Edm.Decimal` in OData V4. The OData V4 JSON format spec requires `Edm.Decimal` values to be **strings**, not numbers.

| Payload | Result |
|---|---|
| `"FinancialImpact": 100000` | 400 Bad Request — "invalid value '100000'" |
| `"FinancialImpact": "100000"` | OK |
| `"FinancialImpact": null` | 400 — ABAP CURR type does not support null |
| `"FinancialImpact": "0"` | OK — use as default when field is empty |

**Rule:** Always use `String(value)` for Edm.Decimal. Use `"0"` not `null` when no value provided.

```js
FinancialImpact: oData.FinancialImpact ? String(oData.FinancialImpact) : "0"
```

Same applies to quantity fields (`QUAN` type).

---

## FE V4 Controller Extension Rules (confirmed 2026-03-30)

### Base class and file naming
- MUST use `sap/ui/core/mvc/ControllerExtension` — NOT `sap/fe/core/PageController`. Using `PageController.extend()` causes `t.getMetadata is undefined` crash.
- File MUST be named `ControllerName.controller.js` — UI5 appends `.controller` when resolving `controllerName` in `sap.ui.controllerExtensions`.
- Register at `sap.ui5 > extends > extensions > sap.ui.controllerExtensions` (NOT inside routing target settings — causes "unknown setting" error).

### Lifecycle in ControllerExtension
- Use `override.onAfterRendering` for setup. `onAfterBinding` is NOT reliable for getting the list binding.
- Guard with `if (this._bHeatmapReady) { return; }` since `onAfterRendering` fires on every re-render.
- `this.getView()` and `this.base` are available. `this.base` does NOT have `getOwnerComponent`.

### Navigation from ControllerExtension
`sap.ui.core.UIComponent.getRouterFor(view)` only checks the immediate owner (FE template component) — returns undefined. `_oAppComponent` is an internal FE property that does NOT exist in UI5 1.136+. Walking up `getOwnerComponent()` also fails. Use `Component.registry` with the known app component name:
```javascript
var oRouter = null;
sap.ui.core.Component.registry.forEach(function (oComp) {
  if (!oRouter && oComp.getMetadata().getName() === "<appId>.Component") {
    oRouter = oComp.getRouter();
  }
});
if (oRouter) { oRouter.navTo("TargetName", { key: "..." }); }
```

### Draft entity navTo keys — always include IsActiveEntity
For draft-enabled entities, omitting `IsActiveEntity=true` from the navTo key causes silent failure (no navigation, no error):
```javascript
// Wrong — silent failure for draft BOs:
oRouter.navTo("RiskObjectPage", { key: "RiskId=" + sId });
// Correct:
oRouter.navTo("RiskObjectPage", { key: "RiskId=" + sId + ",IsActiveEntity=true" });
```

### List Report extensibility positions
- `content.body.sections` → **Object Page only** — NOT supported in List Report
- List Report custom content: `content.header.customHeader.expandedHeaderFragment` (above filter bar)
- For custom columns, table toolbar actions: use `controlConfiguration`

---

## BSP Deploy Workflow — Build First, Then Deploy

**The correct sequence for deploying any Fiori app to ABAP:**

```
npm run build    ← creates/refreshes the dist folder
npm run deploy   ← deploys from dist to BSP
```

**Why this matters:**
- `npm run deploy` (`fiori deploy`) reads from the existing `dist` folder
- If `dist` is absent or stale, it may silently deploy old content — delta mode will skip files it thinks haven't changed
- The first `npm run deploy` after scaffolding (no prior dist) triggers a build internally, but any subsequent deploy without a fresh build can miss file changes
- Confirmed on Risk Register: `annotation.xml` change was not deployed on first attempt because `fiori deploy` used stale build state; running `npm run build` first then re-deploying fixed it

**Always verify the deploy landed:** after deploying, curl or fetch a changed file directly from the BSP URL to confirm the new content is live before debugging further.

```bash
curl -u "${SAP_B23_USER}:${SAP_B23_PASSWORD}" \
  "https://b23app.dassian.org:44300/sap/bc/ui5_ui5/<app>/annotations/annotation.xml?sap-client=100"
```

---

## FPM Custom Page — macros:Table / macros:FilterBar Rules

### View structure (confirmed 2026-04-03)
- Building blocks MUST be inside a `VBox` wrapper — placing them directly in `Page > content` causes "Trailing text was found in the XML" error
- Use `metaPath` (NOT `contextPath`) on the building block — the entity context is inherited from the FPM page's `contextPath` in the manifest
- `macros:FilterBar`: `metaPath="@com.sap.vocabularies.UI.v1.SelectionFields"`
- `macros:Table`: `metaPath="@com.sap.vocabularies.UI.v1.LineItem"`
- Add `initialLoad="true"` on the Table to trigger data load without requiring filter bar interaction

### CRUD / New button
- FPM `macros:Table` does NOT auto-show Create/New button even when the entity is draft-enabled
- Must set `creationMode` explicitly: `"NewPage"` (navigates to Object Page) or `"Inline"`
- RAP managed-UUID entities set `Insertable=false` in OData metadata — override in local `annotation.xml`:
  ```xml
  <Annotations Target="<namespace>.Container/<EntitySet>">
      <Annotation Term="Capabilities.InsertRestrictions">
          <Record Type="Capabilities.InsertRestrictionsType">
              <PropertyValue Property="Insertable" Bool="true"/>
          </Record>
      </Annotation>
  </Annotations>
  ```

### Navigation from FPM PageController
- `this.getOwnerComponent()` returns `undefined` — FPM page runs in a sub-component
- Use `Component.registry.forEach` to find the app component:
  ```javascript
  var oRouter = null;
  sap.ui.core.Component.registry.forEach(function(oComp) {
      if (!oRouter && oComp.getMetadata().getName() === "<appId>.Component") {
          oRouter = oComp.getRouter();
      }
  });
  if (oRouter) { oRouter.navTo("TargetName"); }
  ```

---

## B23 Known Limitations (SAP_BASIS 758 / S/4HANA 2023)

- `[draft]` action modifier: NOT supported
- `FOR STATIC ACTION`: may not compile -- use `FOR ACTION`
- OData V4 Guid key: NO quotes around UUID
- Always check `sap-docs` for minimum release when keyword fails
