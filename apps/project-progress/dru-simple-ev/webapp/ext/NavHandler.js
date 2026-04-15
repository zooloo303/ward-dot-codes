sap.ui.define([], function() {
    'use strict';

    return {
        navToEnrollment: function() {
            var oRouter = null;
            sap.ui.core.Component.registry.forEach(function(oComp) {
                if (!oRouter && oComp.getMetadata().getName() === "drusimpleev.Component") {
                    oRouter = oComp.getRouter();
                }
            });
            if (oRouter) {
                oRouter.navTo("EvEnRollMain");
            }
        }
    };
});
