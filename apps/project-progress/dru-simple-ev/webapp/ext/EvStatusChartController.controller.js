sap.ui.define([
  "sap/ui/core/mvc/ControllerExtension",
  "sap/ui/core/Fragment",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (ControllerExtension, Fragment, Filter, FilterOperator) {
  "use strict";

  var STATUS_LABEL = { D: "Draft", S: "Saved", L: "Locked" };
  var STATUS_CLASS = { D: "druEvDraft", S: "druEvSaved", L: "druEvLocked" };

  return ControllerExtension.extend("drusimpleev.ext.EvStatusChartController", {

    override: {
      onAfterRendering: function () {
        if (this._bChartReady) { return; }

        var oHtmlCtrl = this.getView().byId("druEvStatusChartHtml");
        if (oHtmlCtrl) {
          // Fast path: FE 1.136+ loaded the fragment via manifest
          this._initChart(oHtmlCtrl);
        } else {
          // Slow path: FE ≤ 1.120 ignores expandedHeaderFragment — inject manually
          this._injectFragment();
        }
      }
    },

    // ── Slow path ─────────────────────────────────────────────────────────────
    _injectFragment: function () {
      var that = this;

      var oHeader = null;
      sap.ui.core.Element.registry.forEach(function (oEl) {
        if (!oHeader && oEl.isA && oEl.isA("sap.f.DynamicPageHeader")) {
          oHeader = oEl;
        }
      });

      if (!oHeader) { return; }

      setTimeout(function () {
        if (that._bChartReady) { return; }

        var oDynamicPage = oHeader.getParent();
        if (oDynamicPage && oDynamicPage.setHeaderExpanded) {
          oDynamicPage.setHeaderExpanded(true);
        }

        Fragment.load({
          id: that.getView().getId(),
          name: "drusimpleev.ext.EvStatusChart",
          controller: that
        }).then(function (oFragment) {
          oHeader.addContent(oFragment);
          var oHtmlCtrl = that.getView().byId("druEvStatusChartHtml");
          if (oHtmlCtrl) { that._initChart(oHtmlCtrl); }
        }).catch(function (err) {
          console.error("EvStatusChart: fragment injection failed", err);
        });
      }, 500);
    },

    // ── Shared init ───────────────────────────────────────────────────────────
    _initChart: function (oHtmlCtrl) {
      if (this._bChartReady) { return; }
      this._bChartReady = true;
      this._loadData();
    },

    // ── Data loading ──────────────────────────────────────────────────────────
    _loadData: function () {
      var that = this;
      var oModel = this.getView().getModel();

      var oBinding = oModel.bindList("/EvSnapshot", null, null, [
        new Filter("IsActiveEntity", FilterOperator.EQ, true)
      ]);

      oBinding.requestContexts(0, Infinity).then(function (aContexts) {
        that._renderChart(aContexts.map(function (c) { return c.getObject(); }));
      });

      oBinding.attachDataReceived(function () {
        oBinding.requestContexts(0, Infinity).then(function (aContexts) {
          that._renderChart(aContexts.map(function (c) { return c.getObject(); }));
        });
      });
    },

    // ── Rendering ─────────────────────────────────────────────────────────────
    _renderChart: function (aData) {
      var counts = { D: 0, S: 0, L: 0 };

      aData.forEach(function (oSnap) {
        var s = oSnap.EvStatus;
        if (counts.hasOwnProperty(s)) { counts[s]++; }
      });

      var total = counts.D + counts.S + counts.L;
      var maxCount = Math.max(counts.D, counts.S, counts.L, 1);

      var sHtml = '<div class="druEvChartWrap">'
        + '<div class="druEvChartTitle">Snapshot Status</div>'
        + '<div class="druEvChartContent">';

      ["D", "S", "L"].forEach(function (sKey) {
        var n = counts[sKey];
        var heightPx = Math.round((n / maxCount) * 78);
        sHtml += '<div class="druEvBarGroup">'
          + '<div class="druEvCountLabel">' + n + '</div>'
          + '<div class="druEvBarTrack">'
          + '<div class="druEvBar ' + STATUS_CLASS[sKey] + '" style="height:' + heightPx + 'px"></div>'
          + '</div>'
          + '<div class="druEvBarLabel">' + STATUS_LABEL[sKey] + '</div>'
          + '</div>';
      });

      sHtml += '</div>'
        + '<div class="druEvChartTotal">Total: ' + total + ' snapshot' + (total !== 1 ? "s" : "") + '</div>'
        + '</div>';

      var oHtmlCtrl = this.getView().byId("druEvStatusChartHtml");
      if (oHtmlCtrl) {
        oHtmlCtrl.setContent(sHtml);
      }
    }

  });
});
