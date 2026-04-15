# FPM Experiment — Lessons Learned

The `dru-simple-ev` app was built using the Flexible Programming Model (FPM) template to explore its capabilities. Key findings:

## What FPM Gave Us
- Multi-view routing (EvSnapshot + EvEnRoll) within a single app component
- Inline creation on the EvEnRoll list (`creationMode: Inline`)
- Custom toolbar action wired via `NavHandler.js`
- Status chart in list report header (same dual-path pattern as risk-register)

## Why Moving Away from FPM for CRUD Apps

FPM's custom page approach (`ext/view/Main.*`, `ext/view/EvEnRoll.*`) required writing controller logic that standard Fiori Elements handles automatically:
- Explicit navigation wiring (`NavHandler.js`) vs FE's built-in routing
- Manual refresh logic vs FE's built-in draft handling
- More boilerplate for things that LROP/Object Page give for free

## Preferred Approach Going Forward

**Standard Fiori Elements (LROP + Object Page) backed by RAP** for all CRUD apps.

- Drafts, validation messages, side effects all work out of the box
- Annotations drive the UI — less JS to maintain
- Custom charts in the list report header still possible via controller extension (see risk-register pattern)
- FPM only if a floor plan genuinely cannot meet the UX requirement

## What to Do with This App

The EvSnapshot/EvEnRoll data model and RAP backend are worth keeping. If this app gets rebuilt, scaffold it as a standard LROP instead of FPM.
