# Token Efficiency

Cross-cutting rules to minimize token waste across all development tasks.

---

## Model Selection — Highest Priority Rule

**Always use the cheapest model capable of the task. Wrong model = wasted money.**

| Task | Model | Why |
|---|---|---|
| **Think / Plan / Architecture** | **Opus** (`Plan` subagent) | Reasoning, trade-offs, best approach decisions |
| **Execute / Write code** | **Sonnet** | Best balance — capable enough, not overkill |
| **Test / Search / Read / Playwright** | **Haiku** | Mechanical tasks, no reasoning needed. ~20x cheaper than Opus |

### The Workflow (mandatory for multi-step tasks)

```
1. THINK  → spawn Plan subagent (Opus): "What is the best approach?"
2. PROPOSE → show plan to Adeel, wait for "go"
3. EXECUTE → Sonnet writes the code
4. TEST   → spawn general-purpose subagent (Haiku): Playwright, file reads, searches
```

### When to use each model

**Opus (Plan subagent):**
- Architecture decisions: which library, which pattern, which approach
- Evaluating trade-offs between options
- Planning a multi-file change (which files to touch, in what order)
- Researching unknowns before committing to an approach

**Sonnet (current/default):**
- Writing and editing code
- Complex logic (cross-filter engine, filter rendering, OData builders)
- Tasks requiring code + context together
- Any task needing more than Haiku but less than Opus

**Haiku (test/search agent, model: "haiku"):**
- Playwright browser testing (navigate, screenshot, evaluate)
- Grepping / searching files for patterns
- Reading files to confirm current state
- Any mechanical task with no ambiguity

### Cost reference (approx)
- Haiku: ~$0.25/M input tokens
- Sonnet: ~$3/M input tokens
- Opus: ~$15/M input tokens

A Playwright test that costs £0.01 on Haiku costs £0.60 on Opus. For 100 tests/day that's £215/month wasted.

---

## Data Fetching -- #1 Rule

**Before EVERY `getObjectSource`, `searchObject`, or any SAP fetch call: ASK "Do I already have this data in context?"**

If yes -- use what is in context. Never re-fetch. Never fetch "just to confirm". This is the #1 token-waste cause. Each unnecessary fetch wastes 5-50K tokens.

**Specific violations that must NEVER repeat:**
- Had method signatures from extraction -> still fetched full BDEF to "confirm" action signature
- Had CDS view source -> launched agents to re-fetch the same views
- Had handler class definition showing `FOR ACTION` -> fetched BDEF to verify

**Before every MCP read call, check:**
1. Is this data already in conversation from a previous fetch?
2. Can I derive what I need from data I already have?
3. Am I fetching "just to confirm"? If yes, STOP.

### Token Hierarchy

| Cost | Approach | When |
|---|---|---|
| Free | Memory + CLAUDE.md + knowledge files | Always check first |
| Very low | Catalog JSON read | Before "does X exist?" |
| Low | `fiori-mcp search_docs` / `abap-docs search` | Pattern/annotation questions |
| Low | `Grep` local files / `searchObject` | Finding objects |
| Medium | `getObjectSource` + Node.js extraction | One method only |
| Medium | `tableContents` / `runQuery` | Data lookup |
| High | `runClass` | Only when source analysis insufficient |
| Very High | Multiple `runClass` iterations | **Avoid** -- rethink approach |

---

## Source Code Handling

### ONE Script for ALL Changes -- NEVER Incremental

When patching ABAP source via Node.js:
1. Plan ALL changes first
2. Write ONE Node.js script that applies everything
3. Verify the result in the same script
4. Write the output file ONCE

**Never:** Script 1 for phase 1, Script 2 for phase 2, etc. This wastes 4-5 tool calls instead of 1, shifts line numbers between phases, and introduces bugs.

### Large Source (>10K chars) -- STOP AND ASK USER

Never push large source via `setObjectSource`. Instead:
1. Prepare patched source in temp file
2. Show user a diff summary
3. STOP and ask user to update via Eclipse ADT
4. Wait for confirmation

Root cause: three agent attempts to push 73K source created stuck locks requiring SM12 cleanup.

### Never Reuse Temp Files Across Sessions

`C:/tmp/*.txt` from a previous session may hold a completely different version. Always write fresh from current `getObjectSource` response.

### Large ABAP Classes (>100K tokens)

Do analysis directly in main conversation, NOT via agents. Agents cannot reliably use Bash for Node.js extraction. Flow: getObjectSource -> Node.js extraction -> analysis.

---

## MCP Response Handling

### Large Source Responses (tool-results files)

When `getObjectSource` returns >10KB (saved to tool-results file):
- **NEVER** read the file with `Read` tool -- floods context
- **ALWAYS** use Node.js extraction for only the needed section:

```javascript
const data = JSON.parse(raw);
const outer = JSON.parse(data[0].text);
const inner = JSON.parse(outer.content[0].text);
const src = inner.source;
// Extract only what you need
```

### Inline vs File Response

- Large classes (>10KB) -> saved to tool-results file -> Node.js extraction
- Small classes (<10KB) -> inline in MCP response -> parse directly, do NOT try to read a tool-results file

### Windows-Specific

- NEVER use heredoc or stdin for Node.js source parsing -- write to `C:/tmp/src.txt` first
- No `/dev/stdin` on Windows; heredoc escaping breaks CDS special chars

### CRLF Detection (MANDATORY)

SAP source uses `\r\n`. Always detect before string operations:
```javascript
const NL = src.includes('\r\n') ? '\r\n' : '\n';
```

---

## Batch Performance Analysis

### Workflow (prevents the 12-agent token waste incident)

1. **ASK about JSON fix-plans EXPLICITLY** before launching -- "Do you want JSON fix-plans to share with the team, or just HTML reports?" NEVER assume.
2. **Group 2 views per agent** to halve agent count
3. **Agents return structured text only** -- no Write, no Bash, no temp classes, no locks
4. **Pass SAP version in prompt** -- skip adtCoreDiscovery calls (saves 1-2 per agent)
5. **Static analysis only** for batch -- skip T1-T4 runtime tests
6. **Main conversation writes all files** from agent findings
7. **Max 4 agents in parallel** -- prevents SAP session contention

**Token progression:** 92K/view (batch 1) -> 65K (batch 2) -> 46K (batch 3) -> 33.5K (batch 4). Target: <=35K/view.

### Agent Prompt Must Include

- "Return findings as structured text. Do NOT write files."
- "Do NOT create temp test classes."
- "SAP version is X, SAP_BASIS NNN. Do NOT call adtCoreDiscovery."
- Lock prevention rules inline (do not rely on agents reading governance docs)

### CDS View Stack Optimization

For parameterized stacks (C_ -> I_ -> P_ -> base):
- Skip I_ source fetch entirely -- always a pass-through
- Fetch P_ metadata, then P_ source + base view IN PARALLEL
- Saves ~3 getObjectSource calls per view

### For #XXL / #CUBE Views

Never fetch full source. Extract only:
1. `as select from` base name
2. WHERE clause
3. First 30 lines

---

## Report Generation

### Output Rules

| Output | Required | Notes |
|---|---|---|
| HTML performance report | ALWAYS | Write first, never skip |
| JSON fix-plan | ASK USER | Only if sharing with team |

**File naming -- MUST include system+client prefix:**
- `[SYSTEM_CLIENT]-[viewname]-performance-report.html`
- `[SYSTEM_CLIENT]-[viewname]-fix-plan.json`

### After Every Batch Analysis (automatic)

1. Analyze improvements vs previous batches
2. Update knowledge files with new learnings
3. Push to git: fix-plans + HTML reports + updated knowledge files
4. Report efficiency metrics to user

---

## On Failure: STOP

### MCP Tool Failure

When an MCP tool fails (HTML error, 401, timeout):
1. STOP immediately
2. Investigate root cause
3. If fixable: fix and verify
4. If not: tell user explicitly, suggest alternatives
5. Never silently skip research

### SAP Change Failure

Each SAP change cycle costs ~8 tool calls (lock + set + unlock + activate + unpublish + republish + fetch + restart). Before ANY change:
1. Research completely first
2. Verify all fields/views/syntax exist
3. Plan the complete change
4. Execute once

**Root cause:** Material Request POC wasted 5+ iterations (40+ tool calls) trying different value help views because it changed before researching.

### Playwright Failure

On ANY action failure: STOP, tell user what failed, ask what to do. Never try random alternatives -- each attempt wastes tokens and leaves dirty state.

---

## Research Before Coding

The most expensive mistakes (each wastes 10+ tool calls):
1. Assuming annotation syntax without checking `fiori-mcp search_docs`
2. Assuming OData response format without checking `$metadata`
3. Assuming ABAP API parameters without RTTI dump
4. Rewriting entire source files when one line needs changing
5. Debugging backend when issue is frontend (or vice versa)
6. **Guessing SAP OData URLs** — namespace encoding, service names, parameters (see backend-development.md)

**Golden rule:** Investigate first, code second. The agent that searches first writes correct code on the first try.

---

## Pre-Push Checklist (HTML/JS dashboards)

Before EVERY `git commit && push` of an HTML file:

1. **No duplicate `const`/`let`** — search for all variable names declared in each function scope
2. **Function call chain complete** — every parameter in `renderX(a, b, c)` must be passed from the caller
3. **No references to removed elements** — if you deleted an HTML element, grep for its ID in JS
4. **No fake/demo data** — only real SAP data. If no data, show clear error.
5. **Console test mentally** — trace: page loads → loadProjects() → user clicks → loadProjectData() → renderReport() → all render functions. Any variable undefined?

Root cause: EV report session (2026-03-27/28) had 8+ broken pushes because code wasn't traced before committing. Each broken push wastes the user's time restarting the server and reporting errors back.

---

## Performance Analysis Pre-Check

Before starting any analysis:
1. Confirm agent type (performance-analyser or main conversation for large classes)
2. List all applicable efficiency rules
3. Verify no data re-fetching will occur
4. For large ABAP classes (>100K): do directly, not via agents
5. Check `performance-analysis/` for existing fix-plan -- skip to review if one exists

---

## Performance Comparison Pattern

For comparing original vs optimised classes:
1. Create a small **separate runner class** (`ZCL_AI_PERF_COMPARE`) -- never modify the large target class
2. Use `GET RUN TIME FIELD` with warmup call
3. Create + activate on dev client, run on test client
4. Run 5+ times, take median
5. Delete runner class when done

Total tool calls should be ~10-12, not 30+.
