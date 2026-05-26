# Active Claude Sessions in Launcher — Design

- **Date:** 2026-05-25
- **Status:** Approved (pending plan)
- **Branch:** sprint-06-macos-integration

## Problem

The launcher opens to an empty "Type to search" state. The user wants it to open
already showing the Claude Code sessions that are **active right now**, and clicking
one should reopen that session in a terminal at its original working directory.

## Decisions

1. **"Active" = `lastActivityAt >= now - 15min`.** Use the indexed `lastActivityAt`
   (queryable in SQL), not raw `fileMtime` — functionally equivalent for an active
   session and already filterable. Window is a constant `ACTIVE_WINDOW_MS = 15 * 60_000`.
2. **Default source filter = Claude** (`tools: ['claude-code']`). Codex/Cursor chips
   still available, just not preselected.
3. **Empty query → browse active Claude sessions** (one row per session, newest first).
   **Typed query → normal search scoped to Claude** (NOT active-only, so search stays
   useful for finding older sessions).
4. **Click → open in tool directly.** Fire the existing `resume.run` mutation, which
   opens Terminal.app and runs `cd <projectPath> && claude --resume <sourceId>`. This
   replaces the current click→preview navigation. The session reopens at its exact
   recorded working directory (`session.projectPath`).

## Behavior

| State | UI |
|-------|-----|
| Launcher opens, empty query | List of Claude sessions active in last 15 min, `ORDER BY last_activity_at DESC`. Each row: project name + git branch + relative time ("active 3m ago"). |
| User types | Normal FTS+vector search, filtered to `tools: ['claude-code']`. |
| User clicks a row / presses ↵ | `resume.run` → Terminal opens at `projectPath`, runs `claude --resume`. Launcher window hides. |
| 0 active sessions | Empty-state copy: "No active Claude sessions (last 15 min)". |

## Data model

- **No new `Session` field.** "Active" is derived at query time from `lastActivityAt`.
- `SearchFilters` already has `tools` and timestamp filters — reused. No new field.
- New shared constant `ACTIVE_WINDOW_MS`.

## Architecture — files to change

1. `apps/main/src/persistence/queries.ts` — add `buildBrowseActiveQuery(tools, sinceEpochMs, limit)`:
   no FTS MATCH; `WHERE s.tool IN (...) AND s.last_activity_at >= @since`; one row per
   session (latest turn for `turnId`/snippet); `ORDER BY s.last_activity_at DESC LIMIT @limit`.
2. `apps/main/src/services/SearchService.ts` — add `browseActive(filters, limit)` (runs the
   browse query, no embeddings). Returns the same row shape as `search.query`.
3. `packages/contracts` + `apps/main/src/ipc/router.ts` — add procedure `search.browseActive`
   (input `{ filters, limit }`, output = existing search-result array schema).
4. `apps/renderer/src/hooks/useSearch.ts` — when `query.length === 0`, call `browseActive`
   (enabled); otherwise the existing search. Unify into one `results` array.
5. `apps/renderer/src/components/Launcher.tsx` — initialise `filters` to `{ tools: ['claude-code'] }`;
   render the list on open (results now populate at empty query).
6. `apps/renderer/src/router.tsx` (or `Launcher`) — change `onOpen` to call `resume.run`
   mutation and hide the window, instead of navigating to `/sessions/:id`.
7. `apps/renderer/src/components/ResultList.tsx` — empty-state copy for 0 active sessions.
8. `apps/renderer/src/components/FilterBar.tsx` — reflect the default Claude selection.

## Data flow

```
open launcher (query "")
  → useSearch sees empty query
  → trpc search.browseActive({ tools:['claude-code'], since: now-15min, limit })
  → SearchService.browseActive → buildBrowseActiveQuery → SQLite
  → rows (one per active session) → ResultList

click row
  → resume.run({ sessionId })
  → LaunchService.launch → osascript → Terminal: cd projectPath && claude --resume sourceId
  → window.hide()
```

## Error / edge cases

- **`projectPath` is null:** resume runs `claude --resume <id>` with no `cd` (existing
  LaunchService behaviour). Document as a known limitation.
- **0 active sessions:** show empty-state copy; do not error.
- **Launch failure (Terminal/osascript):** `resume.run` returns `false`; surface a toast/inline
  error, keep window open.
- **Many active sessions:** capped by `limit` (e.g. 20).

## Testing

- `buildBrowseActiveQuery` — SQL shape: tool filter, `since` bound, ordering, limit, one row/session.
- `SearchService.browseActive` — returns only Claude sessions within window, newest first.
- `useSearch` — empty query routes to `browseActive`; typed query routes to `search.query`.
- Launcher integration — opens with active list; click triggers `resume.run`.

## Out of scope

- Real "process is running" detection (chosen recency proxy instead).
- Active filtering for Codex / Cursor (Claude only for now).
- Active-only scoping of the typed search.
