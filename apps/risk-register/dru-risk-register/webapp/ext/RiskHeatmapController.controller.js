sap.ui.define([
  "sap/ui/core/mvc/ControllerExtension",
  "sap/ui/core/Fragment",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (ControllerExtension, Fragment, Filter, FilterOperator) {
  "use strict";

  // ── Heatmap colour zones ─────────────────────────────────────────────────
  var CELL_CLASS = (function () {
    var map = {};
    for (var p = 1; p <= 5; p++) {
      for (var i = 1; i <= 5; i++) {
        var score = p * i;
        map[p + "_" + i] = score >= 15 ? "druCellRed" : score >= 6 ? "druCellAmber" : "druCellGreen";
      }
    }
    return map;
  }());

  return ControllerExtension.extend("druriskregister.ext.RiskHeatmapController", {

    override: {
      // ── onAfterRendering fires when the List Report view is ready ──────────
      onAfterRendering: function () {
        if (this._bHeatmapReady) { return; }

        var oHtmlCtrl = this.getView().byId("druHeatmapHtml");
        if (oHtmlCtrl) {
          // Fast path: FE 1.136+ loaded the fragment via manifest
          this._initHeatmap(oHtmlCtrl);
        } else {
          // Slow path: FE ≤ 1.120 silently ignores expandedHeaderFragment —
          // load the fragment ourselves and inject it into the DynamicPageHeader
          this._injectFragment();
        }
      }
    },

    // ── Slow path: programmatic fragment injection ───────────────────────────
    _injectFragment: function () {
      var that = this;

      // Find the DynamicPageHeader rendered by the List Report template
      var oHeader = null;
      sap.ui.core.Element.registry.forEach(function (oEl) {
        if (!oHeader && oEl.isA && oEl.isA("sap.f.DynamicPageHeader")) {
          oHeader = oEl;
        }
      });

      if (!oHeader) {
        // Header not in DOM yet — retry on the next rendering cycle
        return;
      }

      // Delay 500ms so FE finishes its own async setup before we inject
      var that2 = this;
      setTimeout(function () {
        if (that2._bHeatmapReady) { return; }

        // Ensure the header area is visible and expanded
        var oDynamicPage = oHeader.getParent();
        if (oDynamicPage && oDynamicPage.setHeaderExpanded) {
          oDynamicPage.setHeaderExpanded(true);
        }

        // Load the fragment (same file FE would have loaded via manifest)
        Fragment.load({
          id: that2.getView().getId(),
          name: "druriskregister.ext.RiskHeatmap",
          controller: that2
        }).then(function (oFragment) {
          oHeader.addContent(oFragment);
          var oHtmlCtrl = that2.getView().byId("druHeatmapHtml");
          if (oHtmlCtrl) {
            that2._initHeatmap(oHtmlCtrl);
          }
        }).catch(function (oErr) {
          // eslint-disable-next-line no-console
          console.error("RiskHeatmap: fragment injection failed", oErr);
        });
      }, 500);
    },

    // ── Shared init — called from either path ────────────────────────────────
    _initHeatmap: function (oHtmlCtrl) {
      if (this._bHeatmapReady) { return; }
      this._bHeatmapReady = true;

      var that = this;

      // Attach click delegation whenever the HTML control re-renders
      oHtmlCtrl.attachAfterRendering(function () {
        var oDomRef = oHtmlCtrl.getDomRef();
        if (oDomRef) {
          oDomRef.onclick = function (oEvent) {
            var oDot = oEvent.target.closest(".druRiskDot");
            if (oDot && oDot.dataset.riskId) {
              that._onDotClick(oDot.dataset.riskId);
            }
          };
        }
      });

      // Load all risks and build the heatmap
      this._loadRisks();
    },

    // ── Data loading ─────────────────────────────────────────────────────────
    _loadRisks: function () {
      var that = this;
      var oModel = this.getView().getModel();
      var oListBinding = oModel.bindList("/Risk", null, null,
        [new Filter("IsActiveEntity", FilterOperator.EQ, true)]
      );

      // Initial load
      oListBinding.requestContexts(0, Infinity).then(function (aContexts) {
        that._buildHeatmap(aContexts.map(function (c) { return c.getObject(); }));
      });

      // Refresh whenever the model reloads data (user hits Go / changes filters)
      oListBinding.attachDataReceived(function () {
        oListBinding.requestContexts(0, Infinity).then(function (aContexts) {
          that._buildHeatmap(aContexts.map(function (c) { return c.getObject(); }));
        });
      });
    },

    // ── Heatmap rendering ────────────────────────────────────────────────────
    _buildHeatmap: function (aRisks) {
      var oGrid = {};
      var kpi = { high: 0, medium: 0, low: 0 };

      aRisks.forEach(function (oRisk) {
        var key = oRisk.Probability + "_" + oRisk.Impact;
        if (!oGrid[key]) { oGrid[key] = []; }
        oGrid[key].push(oRisk);
        var score = oRisk.RiskScore || (oRisk.Probability * oRisk.Impact);
        if (score >= 15)    { kpi.high++; }
        else if (score >= 6) { kpi.medium++; }
        else                 { kpi.low++; }
      });

      // ── Grid HTML ────────────────────────────────────────────────────────
      var sHtml = '<div class="druHeatmapContainer">'
        + '<div class="druHeatmapWrap">'
        + '<div class="druHeatmapInner">'
        + '<div class="druHeatmapYLabel">\u2190 Probability \u2192</div>'
        + '<div class="druHeatmapRowLabels">';

      for (var p = 1; p <= 5; p++) {
        sHtml += '<div class="druHeatmapRowLabel">' + p + '</div>';
      }
      sHtml += '</div><div class="druHeatmapGrid">';

      for (var pr = 5; pr >= 1; pr--) {
        for (var ic = 1; ic <= 5; ic++) {
          var cellKey = pr + "_" + ic;
          var cellClass = CELL_CLASS[cellKey] || "druCellGreen";
          var aCell = oGrid[cellKey] || [];

          sHtml += '<div class="druHeatmapCell ' + cellClass + '">';
          aCell.forEach(function (oRisk) {
            var sId = oRisk.RiskId || "";
            var sLabel = (oRisk.RiskDesc || "").substring(0, 2).toUpperCase() || "R";
            sHtml += '<div class="druRiskDot" title="' + _esc(oRisk.RiskDesc) + '"'
              + ' data-risk-id="' + _esc(sId) + '">'
              + sLabel + '</div>';
          });
          sHtml += '</div>';
        }
      }

      sHtml += '</div></div>'
        + '<div class="druHeatmapColLabels">';

      for (var il = 1; il <= 5; il++) {
        sHtml += '<div class="druHeatmapColLabel">' + il + '</div>';
      }
      sHtml += '</div>'
        + '<div class="druHeatmapXAxisLabel">\u2190 Impact \u2192</div>'
        + '</div>';  // close wrap

      // ── KPI tiles ────────────────────────────────────────────────────────
      sHtml += '<div class="druKpiBox">'
        + '<div class="druKpiTile red">'
        + '<div class="druKpiCount">' + kpi.high + '</div>'
        + '<div class="druKpiLabel">High Risks</div>'
        + '</div>'
        + '<div class="druKpiTile amber">'
        + '<div class="druKpiCount">' + kpi.medium + '</div>'
        + '<div class="druKpiLabel">Medium Risks</div>'
        + '</div>'
        + '<div class="druKpiTile green">'
        + '<div class="druKpiCount">' + kpi.low + '</div>'
        + '<div class="druKpiLabel">Low Risks</div>'
        + '</div>'
        + '</div>'
        + '</div>';  // close container

      var oHtmlCtrl = this.getView().byId("druHeatmapHtml");
      if (oHtmlCtrl) {
        oHtmlCtrl.setContent(sHtml);
      }
    },

    // ── Navigation ───────────────────────────────────────────────────────────
    _onDotClick: function (sRiskId) {
      // Find the app router via Component registry — FE template components do
      // not own the router, so we look for our known app component by name
      var oRouter = null;
      sap.ui.core.Component.registry.forEach(function (oComp) {
        if (!oRouter && oComp.getMetadata().getName() === "druriskregister.Component") {
          oRouter = oComp.getRouter();
        }
      });
      if (oRouter) {
        oRouter.navTo("RiskObjectPage", { key: "RiskId=" + sRiskId + ",IsActiveEntity=true" });
      }
    }

  });

  // Private helper — escape HTML attribute values
  function _esc(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

});
