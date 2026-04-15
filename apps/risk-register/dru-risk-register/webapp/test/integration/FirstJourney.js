sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();

            Then.onTheRiskList.iSeeThisPage();
            Then.onTheRiskList.onFilterBar().iCheckFilterField("RiskDesc");
            Then.onTheRiskList.onFilterBar().iCheckFilterField("Status");
            Then.onTheRiskList.onFilterBar().iCheckFilterField("Category");
            Then.onTheRiskList.onFilterBar().iCheckFilterField("RiskOwner");
            Then.onTheRiskList.onTable().iCheckColumns(9, {"RiskDesc":{"header":"RiskDesc"},"Status":{"header":"Status"},"Category":{"header":"Category"},"RiskOwner":{"header":"RiskOwner"},"DueDate":{"header":"DueDate"},"Probability":{"header":"Probability"},"Impact":{"header":"Impact"},"RiskScore":{"header":"RiskScore"},"FinancialImpact":{"header":"FinancialImpact"}});

        });


        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            
            When.onTheRiskList.onFilterBar().iExecuteSearch();
            
            Then.onTheRiskList.onTable().iCheckRows();

            When.onTheRiskList.onTable().iPressRow(0);
            Then.onTheRiskObjectPage.iSeeThisPage();

        });

        opaTest("Teardown", function (Given, When, Then) { 
            // Cleanup
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});