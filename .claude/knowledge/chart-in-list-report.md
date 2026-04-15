# Pattern: Custom Chart in a Fiori Elements List Report Header

**Reference app:** `apps/risk-register/dru-risk-register`
**Technique:** Controller Extension + `core:HTML` fragment injected into the List Report's expanded DynamicPage header
**Works on:** SAPUI5 1.120+ (with dual-path compatibility up to 1.136+)

---

## What this achieves

A fully custom visualisation (any HTML/JS rendering — not VizFrame) rendered inside the collapsible header of an FE List Report page. The chart receives its own OData data load and refreshes when the user applies filters.

---

## Files to create

| File | Purpose |
|------|---------|
| `webapp/ext/<Name>.fragment.xml` | Declares the `core:HTML` host control |
| `webapp/ext/<Name>Controller.controller.js` | Controller extension — injects fragment, loads data, renders chart |
| `webapp/ext/<Name>.css` | Chart styles |

One manifest change wires everything together.

---

## Step 1 — Create the fragment

`webapp/ext/MyChart.fragment.xml`

```xml
<core:FragmentDefinition
  xmlns="sap.m"
  xmlns:core="sap.ui.core">
  <core:HTML id="myChartHtml" content="" />
</core:FragmentDefinition>
```

The `core:HTML` control is the rendering surface. Its `content` property is set programmatically. The `id` must be unique within the app.

---

## Step 2 — Create the controller extension

`webapp/ext/MyChartController.controller.js`

The extension must extend `sap.fe.templates.ListReport.ListReportController`. It uses a **dual-path init** to handle two different FE behaviours:

- **UI5 1.136+** — FE loads the fragment from the manifest automatically; the controller finds the control by ID and initialises it.
- **UI5 ≤ 1.120** — FE silently ignores `expandedHeaderFragment`; the controller must load the fragment itself and inject it into the `sap.f.DynamicPageHeader`.

```js
sap.ui.define([
  "sap/ui/core/mvc/ControllerExtension",
  "sap/ui/core/Fragment",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (ControllerExtension, Fragment, Filter, FilterOperator) {
  "use strict";

  return ControllerExtension.extend("myapp.ext.MyChartController", {

    override: {
      onAfterRendering: function () {
        if (this._bChartReady) { return; }

        var oHtmlCtrl = this.getView().byId("myChartHtml");
        if (oHtmlCtrl) {
          // Fast path: FE 1.136+ loaded the fragment via manifest
          this._initChart(oHtmlCtrl);
        } else {
          // Slow path: FE ≤ 1.120 — inject manually
          this._injectFragment();
        }
      }
    },

    // ── Slow path ────────────────────────────────────────────────────────────
    _injectFragment: function () {
      var that = this;

      // Find the DynamicPageHeader from the element registry
      var oHeader = null;
      sap.ui.core.Element.registry.forEach(function (oEl) {
        if (!oHeader && oEl.isA && oEl.isA("sap.f.DynamicPageHeader")) {
          oHeader = oEl;
        }
      });

      if (!oHeader) { return; } // Not rendered yet — onAfterRendering will fire again

      setTimeout(function () {
        if (that._bChartReady) { return; }

        // Keep header expanded so the chart is visible
        var oDynamicPage = oHeader.getParent();
        if (oDynamicPage && oDynamicPage.setHeaderExpanded) {
          oDynamicPage.setHeaderExpanded(true);
        }

        Fragment.load({
          id: that.getView().getId(),
          name: "myapp.ext.MyChart",         // ← must match your fragment file path
          controller: that
        }).then(function (oFragment) {
          oHeader.addContent(oFragment);
          var oHtmlCtrl = that.getView().byId("myChartHtml");
          if (oHtmlCtrl) { that._initChart(oHtmlCtrl); }
        }).catch(function (err) {
          console.error("MyChart: fragment injection failed", err);
        });
      }, 500); // 500ms lets FE finish its own async setup before injection
    },

    // ── Shared init ──────────────────────────────────────────────────────────
    _initChart: function (oHtmlCtrl) {
      if (this._bChartReady) { return; }
      this._bChartReady = true;
      var that = this;

      // Re-attach click (or other DOM) events each time the control re-renders
      oHtmlCtrl.attachAfterRendering(function () {
        var oDomRef = oHtmlCtrl.getDomRef();
        if (oDomRef) {
          oDomRef.onclick = function (oEvent) {
            // Handle chart interaction here
          };
        }
      });

      this._loadData();
    },

    // ── Data loading ─────────────────────────────────────────────────────────
    _loadData: function () {
      var that = this;
      var oModel = this.getView().getModel();

      // Bind directly to the entity set — independent of the table binding
      var oBinding = oModel.bindList("/MyEntity", null, null, [
        new Filter("IsActiveEntity", FilterOperator.EQ, true)
      ]);

      // Initial load
      oBinding.requestContexts(0, Infinity).then(function (aContexts) {
        that._renderChart(aContexts.map(function (c) { return c.getObject(); }));
      });

      // Refresh when user hits Go or changes filters
      oBinding.attachDataReceived(function () {
        oBinding.requestContexts(0, Infinity).then(function (aContexts) {
          that._renderChart(aContexts.map(function (c) { return c.getObject(); }));
        });
      });
    },

    // ── Rendering ────────────────────────────────────────────────────────────
    _renderChart: function (aData) {
      // Build an HTML string from aData and push it into the core:HTML control
      var sHtml = "<div>…your chart HTML…</div>";

      var oHtmlCtrl = this.getView().byId("myChartHtml");
      if (oHtmlCtrl) {
        oHtmlCtrl.setContent(sHtml);
      }
    }

  });
});
```

Key points:
- `_bChartReady` guard prevents double-init across multiple `onAfterRendering` calls.
- The `setTimeout(500)` in the slow path is intentional — FE performs async setup after first render; injecting too early causes the header to be re-built and the fragment gets lost.
- The data binding is **independent** of the table. It loads from the same entity set but is not affected by the table's own pagination or sorters. It does respond to filter changes via `attachDataReceived`.
- DOM event listeners must be attached inside `attachAfterRendering` on the `core:HTML` control because `setContent()` replaces the DOM node entirely each refresh.

---

## Step 3 — Register everything in manifest.json

Three additions are needed under `sap.ui5`:

### 3a — Controller extension

```json
"extends": {
  "extensions": {
    "sap.ui.controllerExtensions": {
      "sap.fe.templates.ListReport.ListReportController": {
        "controllerName": "myapp.ext.MyChartController"
      }
    }
  }
}
```

### 3b — expandedHeaderFragment (FE 1.136+ fast path)

Inside the list report target's `settings.content.header`:

```json
"content": {
  "header": {
    "visible": true,
    "customHeader": {
      "expandedHeaderFragment": "myapp.ext.MyChart"
    }
  }
}
```

The value is the **module path** (dot-separated) of the fragment, not the file path. On FE 1.136+ this is loaded automatically. On 1.120 it is silently ignored — hence the slow-path fallback in the controller.

### 3c — CSS resource

```json
"resources": {
  "css": [
    { "uri": "ext/MyChart.css" }
  ]
}
```

---

## Step 4 — CSS

Write styles in `webapp/ext/MyChart.css`. This file is loaded globally for the app — prefix all class names to avoid collision with SAP's own classes.

---

## Step 5 — Navigation from chart to object page (optional)

The FE template components do not own the router — it lives on the app Component. Retrieve it via the Component registry:

```js
var oRouter = null;
sap.ui.core.Component.registry.forEach(function (oComp) {
  if (!oRouter && oComp.getMetadata().getName() === "myapp.Component") {
    oRouter = oComp.getRouter();
  }
});
if (oRouter) {
  oRouter.navTo("MyObjectPage", { key: "MyId=" + sId + ",IsActiveEntity=true" });
}
```

---

## Summary of the dual-path strategy

```
onAfterRendering
  └─ byId("myChartHtml") found?
       ├─ YES → FE loaded it (1.136+)  → _initChart()
       └─ NO  → FE ignored manifest    → _injectFragment()
                    └─ Element.registry walk → find DynamicPageHeader
                         └─ setTimeout(500) → Fragment.load() → addContent()
                              └─ _initChart()
```

This makes the app forward-compatible (manifest path works on newer FE) while remaining functional on S/4HANA 2023 which ships UI5 1.120.
