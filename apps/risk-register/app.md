# Risk Register

## Overview
Risk register app — list of risks with an object page per risk. Includes a heatmap chart in the list report header and risk score sliders on the object page.

## Stack
- UI type: Fiori Elements V4 — List Report / Object Page
- Template: `@sap/generator-fiori:lrop`
- OData: V4
- SAP system: B23 (`https://b23app.dassian.org:44300`, client 100)
- min UI5 version: 1.136.7

## Key Objects
| Object | Name |
|---|---|
| App ID | `druriskregister` |
| Package | `/DRU/RISK` |
| BSP App | `/DRU/RISK_REG` |
| Service Binding | `dru/sb_risk_o4` |
| Service Definition | `dru/sd_risk` |
| OData URL | `/sap/opu/odata4/dru/sb_risk_o4/srvd/dru/sd_risk/0001/` |
| Transport | B23K901197 |
| Root entity | `Risk` |

## UI Extensions
- `ext/RiskHeatmapController.controller.js` — ControllerExtension on `ListReportController`, renders heatmap in list report header via `expandedHeaderFragment` (see `.claude/knowledge/chart-in-list-report.md` for the reusable pattern)
- `ext/RiskHeatmap.fragment.xml` + `RiskHeatmap.css` — heatmap fragment + styles
- `ext/RiskScoreSliders.fragment.xml` — custom subsection on Object Page (after `RiskDetails` section)

## Notes
- Draft-enabled entity — always include `IsActiveEntity=true` in navTo keys
- `expandedHeaderFragment` may be silently ignored on FE ≤ 1.120 — see `frontend-development.md` for dual-path fix
- ControllerExtension registered at `sap.ui5 > extends > extensions > sap.ui.controllerExtensions`
- Uses `Component.registry.forEach` pattern to get router (not `getRouterFor`)
