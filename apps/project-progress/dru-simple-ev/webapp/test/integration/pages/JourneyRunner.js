sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"drusimpleev/test/integration/pages/EvSnapshotMain"
], function (JourneyRunner, EvSnapshotMain) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('drusimpleev') + '/test/flpSandbox.html#drusimpleev-tile',
        pages: {
			onTheEvSnapshotMain: EvSnapshotMain
        },
        async: true
    });

    return runner;
});

