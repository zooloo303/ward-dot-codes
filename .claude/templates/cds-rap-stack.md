# Template: RAP Managed BO Stack

## Reference Implementation
/DRU/ESTIMATION package — 12 entities, full managed BO with draft.

## Objects to Create (in order)

### 1. Tables (if custom persistence)
- `/DRU/<entity>` — transparent table, delivery class C
- `/DRU/<entity>_D` — draft table (same fields + draft admin fields)

### 2. R_ Root/Child Views (restricted, RAP internal)
- `/DRU/R_<Entity>TP`
- `define root view entity` (or `define view entity` for children)
- All DB fields + associations to children
- `@AccessControl.authorizationCheck: #CHECK`

### 3. I_ Interface Views (reusable, read-only consumers)
- `/DRU/I_<Entity>`
- `define view entity as projection on R_`
- `@ObjectModel`, `@Semantics` annotations HERE
- `@Metadata.allowExtensions: true`

### 4. C_ Consumption Views (OData-exposed)
- `/DRU/C_<Entity>TP`
- `define root view entity as projection on R_`
- `provider contract transactional_query`
- NO @UI annotations here

### 5. MDE_ Metadata Extensions
- `/DRU/MDE_<Entity>TP`
- All @UI annotations: lineItem, fieldGroup, headerInfo
- @Search.searchable, @Consumption.filter, @Consumption.valueHelpDefinition

### 6. BDEF (Behavior Definition)
Root: `managed implementation in class /DRU/BP_R_<Entity>TP`
Projection: `projection`
Include: `use create; use update; use delete;` in projection

### 7. BP_ Handler Class
- `/DRU/BP_R_<Entity>TP`
- Implements: determinations, validations, actions

### 8. DCL (Access Control)
- Must match CDS view name exactly
- One for each exposed view

### 9. SD_ Service Definition
- `/DRU/UI_<Entity>`
- Expose main entity + ALL value help views

### 10. SRVB_ Service Binding
- `/DRU/UI_<Entity>_O4` (OData V4 - UI)

## Naming Checklist
- [ ] All names <= 30 chars including /DRU/ prefix?
- [ ] R_, I_, C_ follow CamelCase entity name?
- [ ] MDE_ matches C_ entity name?
- [ ] BP_ matches R_ view name?
- [ ] DCL names match view names?

## Activation Order
Table → R_ views → I_ views → C_ views → MDE → Handler + BDEF + DCL → Projection BDEF + SD → SRVB
