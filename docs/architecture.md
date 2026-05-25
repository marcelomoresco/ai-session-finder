# Architecture

> Growing document. As of Sprint 01 it covers the domain model and the SQLite
> persistence layer. Source adapters, the indexer, IPC, and the UI arrive in
> later sprints.

## Layers

```
@asf/domain      pure types + domain logic (no framework deps)
@asf/contracts   Zod schemas for IPC boundaries (raw strings, no brands)
apps/main        Electron main process — persistence lives here for now
```

Branded ids (`SessionId`, `TurnId`) exist only inside the domain. They are
converted to/from raw strings at boundaries: the SQLite repository maps rows to
branded domain objects (and back), and `@asf/contracts` works in raw strings for
serialization across IPC.

## SQLite schema (migration `001_initial`)

Stored at `<userData>/ai-session-finder.db`. Timestamps are epoch milliseconds
(`INTEGER`).

### `sessions`

One row per indexed session. `id` is the primary key; `(tool, source_id)` is
unique so a source session maps to exactly one row. Token counts are flat
columns (`input_tokens`, `output_tokens`, `cache_read`, `cache_creation`).
Indexed by `project_path`, `last_activity_at DESC`, and `tool`.

`tool` is constrained by `CHECK (tool IN ('claude-code','codex-cli','cursor'))`.

### `turns`

One row per turn, `FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE
CASCADE`, unique on `(session_id, turn_index)`. `tool_calls` is a JSON string
(single column — simpler than a join table for the MVP).

### `files_touched`

Files referenced by a turn, cascading from both `sessions` and `turns`.

### `turns_fts`

An external-content FTS5 index over `turns.content_text`
(`tokenize='porter unicode61 remove_diacritics 2'`). Triggers `turns_ai`,
`turns_ad`, and `turns_au` keep it in sync on insert/delete/update. Search
ranks results with `bm25()`. Vector search (`sqlite-vec`) is deferred to
Sprint 03 as migration `002`.

## Migrations

`Migrator` tracks applied versions in `schema_migrations` and applies pending
migrations in version order, each in its own transaction (a failure rolls that
migration back). Connection PRAGMAs (`journal_mode=WAL`, `synchronous=NORMAL`,
`foreign_keys=ON`) are set on the connection in `createDatabase`, not in a
migration, because `PRAGMA journal_mode` cannot run inside a transaction.

## Repository (ISP)

Three segregated interfaces — `SessionReader`, `SessionWriter`,
`SearchableRepository` — are implemented by `SQLiteRepository`. SQL is kept as
const strings and query builders in `queries.ts`, never inline. `upsert` is
transactional (session + turns + files replaced atomically).
