sap.ui.define(
    [
        'sap/fe/core/PageController'
    ],
    function(PageController) {
        'use strict';

        return PageController.extend('drusimpleev.ext.view.Main', {

            onNavToEnrollment: function () {
                var oRouter = null;
                sap.ui.core.Component.registry.forEach(function(oComp) {
                    if (!oRouter && oComp.getMetadata().getName() === "drusimpleev.Component") {
                        oRouter = oComp.getRouter();
                    }
                });
                if (oRouter) {
                    oRouter.navTo("EvEnRollMain");
                }
            },

            //  onInit: function () {
            //      PageController.prototype.onInit.apply(this, arguments); // needs to be called to properly initialize the page controller
            //  },

            /**
             * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
             * (NOT before the first rendering! onInit() is used for that one!).
             * @memberOf drusimpleev.ext.view.Main
             */
            //  onBeforeRendering: function() {
            //
            //  },

            /**
             * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
             * This hook is the same one that SAPUI5 controls get after being rendered.
             * @memberOf drusimpleev.ext.view.Main
             */
            //  onAfterRendering: function() {
            //
            //  },

            /**
             * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
             * @memberOf drusimpleev.ext.view.Main
             */
            //  onExit: function() {
            //
            //  }
        });
    }
);
