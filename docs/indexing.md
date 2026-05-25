# Indexing pipeline (Sprint 03)

How sessions get from disk into the searchable database, and the performance you
can expect.

## Flow

```
            ┌─────────────────────────── Worker thread ───────────────────────────┐
 FS events  │  FsWatcher ──fileChanged──▶ Pipeline.indexFile(path)                 │
 (~/.claude,│                                  │                                   │
  ~/.codex, │     SourceRegistry.findFor(path) ─┤ no source → skip                 │
  Cursor)   │                                  ▼                                   │
            │     source.parse(path)  ──▶ RawSession(s)                            │
            │            │                                                          │
            │            ├─ SessionIdGenerator (sha256 of tool:sourceId)            │
            │            ├─ incremental skip: stored.fileMtime ≥ raw.fileMtime?     │
            │            ├─ normalize → domain Session/Turn                         │
            │            ├─ redactSecrets() BEFORE persist (content, tool result,   │
            │            │                                  tool input)             │
            │            ├─ SessionWriter.upsert(session, turns)  ─▶ sessions/turns │
            │            │                                            + FTS5        │
            │            └─ if embedder.enabled && vectorRepo:                      │
            │                 TurnChunker → Embedder.embedBatch → vec_turns (k-NN)  │
            └──────────────────────────────────────────────────────────────────────┘
                                  │ WorkerToMain messages
                                  ▼
              IndexerService (main process) ─▶ UI callbacks (ready / sessionIndexed / progress / error)
```

## Components

| Piece | Location | Responsibility |
| --- | --- | --- |
| `FsWatcher` | `apps/indexer/src/Watcher.ts` | chokidar wrapper; debounced `fileChanged` (coalesces JSONL appends via `awaitWriteFinish`). Does **not** ignore dotfiles — Claude/Codex live under `~/.claude` / `~/.codex`. |
| `Pipeline` | `apps/indexer/src/Pipeline.ts` | Orchestrates parse → normalize → redact → persist → (chunk → embed → store). Fully constructor-injected (DIP); returns the `SessionId`s it indexed. |
| `TurnChunker` | `apps/indexer/src/chunking/` | Sliding-window chunking (sentence-aware, char fallback) with fixed overlap. Only used when embedding is enabled. |
| `Embedder` | `apps/indexer/src/embedding/` | `LocalEmbedder` (Transformers.js, nomic-embed-text-v1.5, 768-dim, lazy + dynamic import) or `NoopEmbedder` fallback. |
| `redactSecrets` | `apps/indexer/src/security/` | Strips credentials before persisting. Secret-only by design (keeps emails/paths searchable — different from the PII-aggressive `@asf/test-fixtures` variant). |
| `SQLiteRepository` | `apps/main/src/persistence/` | Writes sessions/turns (+ FTS5). |
| `SqliteVecRepository` | `apps/main/src/persistence/` | k-NN vector store over `vec_turns`. delete-then-insert upsert (vec0 has no UPSERT). |
| `worker.ts` | `apps/main/src/services/` | Composition root for the worker thread (`buildIndexer` + `runWorker`). |
| `IndexerService` | `apps/main/src/services/` | Controls the worker from the main process over `WorkerProtocol`. |

## Architecture notes

- **Worker owns its own database handle.** The worker calls `createDatabase`
  itself (`apps/main/src/services/worker.ts`) — it never shares the main
  process's `better-sqlite3` connection. SQLite **WAL** mode lets the main
  process keep reading while the worker writes. (Verified in
  `worker.test.ts`: a second connection reads what the worker wrote.)
- **Ports & adapters (no dependency cycle).** The Pipeline depends on small
  port interfaces it owns (`apps/indexer/src/ports.ts`); the concrete `@asf/main`
  repositories satisfy them structurally. Dependency direction is strictly
  `main → indexer → domain`, so the worker wiring lives in `apps/main`.
- **Semantic search is optional.** `createDatabase` tries to load the
  `sqlite-vec` extension. On success it applies migration `002_vector_search`
  and sets `semanticSearch: true`; on failure (e.g. an unsupported CPU) it skips
  002 and runs keyword-only. When disabled, the Pipeline gets a `NoopEmbedder`
  and a `null` vector repo — the whole app still works.
- **Secrets never reach the DB.** `redactSecrets` runs on turn content, tool
  results, and tool inputs (serialized to JSON) before `upsert`.
- **Incremental.** A session is re-indexed only when the source file's mtime is
  newer than the stored copy; unchanged files are a no-op.

## Performance (measured, M2-class, Node 20, NoopEmbedder)

From the gated benchmark (`indexer.bench.test.ts`, 5 000 synthetic sessions ×
3 turns):

| Metric | Target | Measured |
| --- | --- | --- |
| Full index of 5 000 sessions | < 2 min | **~1.7 s** (0.35 ms/session) |
| Re-index one changed file | < 300 ms | **~0.3 ms** |
| Unchanged re-index (skip) | — | **~0.04 ms** |
| RSS during indexing | < 800 MB | **~200 MB** |

Semantic embedding is the separate cost: `LocalEmbedder` targets ~100 turns in
< 30 s on first-use after the model downloads to `~/.cache/huggingface/`.

## Running

Tests and the app build against **Node 20** (`.nvmrc`); `better-sqlite3` is
compiled for it.

```bash
pnpm test                  # full suite (fast; benchmark + model tests are gated)

# Benchmark (DoD perf numbers):
ASF_BENCH=1 pnpm vitest run apps/main/src/services/indexer.bench.test.ts

# Real embedding model (downloads weights, slow, networked):
ASF_EMBEDDER_E2E=1 pnpm vitest run apps/indexer/src/embedding/LocalEmbedder.test.ts
```

## Definition of Done

- [x] Pipeline indexes 5 000 fixture sessions in < 2 min (M2) — ~1.7 s
- [x] Incremental re-index (1 file) < 300 ms — ~0.3 ms
- [x] RAM during indexing < 800 MB — ~200 MB
- [x] Embedder works with model cached in `~/.cache/huggingface/` (lazy-loaded;
      covered by the gated E2E test)
- [x] Worker thread isolates crashes from the main process
      (`IndexerService` handles `error`/`exit`)
- [x] `docs/indexing.md` documents the flow and performance
