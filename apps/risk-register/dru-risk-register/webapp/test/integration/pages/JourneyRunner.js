sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"druriskregister/test/integration/pages/RiskList",
	"druriskregister/test/integration/pages/RiskObjectPage"
], function (JourneyRunner, RiskList, RiskObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('druriskregister') + '/test/flpSandbox.html#druriskregister-tile',
        pages: {
			onTheRiskList: RiskList,
			onTheRiskObjectPage: RiskObjectPage
        },
        async: true
    });

    return runner;
});

