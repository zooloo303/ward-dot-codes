# Project Progress (Simple EV)

## Overview
Earned Value (EV) tracking app — two main views: EV Snapshots (main landing) and EV Enrolment (manage which projects are enrolled). Includes a status chart in the snapshot list report header.

## Stack
- UI type: Fiori Elements V4 — FPM (Flexible Programming Model)
- Template: `@sap/generator-fiori:fpm`
- OData: V4
- SAP system: B23 (`https://b23app.dassian.org:44300`, client 100)
- min UI5 version: 1.120.39

## Key Objects
| Object | Name |
|---|---|
| App ID | `drusimpleev` |
| Package | `/DRU/SEV` |
| BSP App | `/DRU/SIMPLE_EV` |
| Service Binding | `dru/sb_simple_ev_04` |
| Service Definition | `dru/sd_simple_ev` |
| OData URL | `/sap/opu/odata4/dru/sb_simple_ev_04/srvd/dru/sd_simple_ev/0001/` |
| Transport | B23K901197 |
| Entities | `EvSnapshot`, `EvEnRoll` |

## Routing
| Route | Pattern | Target |
|---|---|---|
| EvSnapshotMain | `:?query:` (default) | List Report — `/EvSnapshot` |
| EvSnapshotObjectPage | `EvSnapshot({key}):?query:` | Object Page — `/EvSnapshot` |
| EvEnRollMain | `enroll:?query:` | List Report — `/EvEnRoll` (inline creation) |
| EvEnRollObjectPage | `EvEnRoll({key}):?query:` | Object Page — `/EvEnRoll` |

## UI Extensions
- `ext/EvStatusChartController.controller.js` — ControllerExtension on `ListReportController` for snapshot view, renders status chart via `expandedHeaderFragment`
- `ext/EvStatusChart.fragment.xml` + `EvStatusChart.css` — chart fragment + styles
- `ext/NavHandler.js` — navigation helper, wires "Manage Enrolled Projects" toolbar action to enrolment route
- `ext/view/Main.*` — custom FPM main view
- `ext/view/EvEnRoll.*` — custom FPM enrolment view

## Notes
- `expandedHeaderFragment` may be silently ignored on FE ≤ 1.120 — min version here is 1.120.39 so apply dual-path fix if issues arise (see `frontend-development.md`)
- EvEnRoll list uses inline row creation (`creationMode: Inline`)
- "Manage Enrolled Projects" button added via `controlConfiguration.actions` — uses `NavHandler.navToEnrollment`
