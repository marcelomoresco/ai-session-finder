# Services & IPC (Sprint 04)

The application layer and how the renderer reaches it. Everything is wired in one
place (`AppContext`) and exposed over tRPC across the Electron IPC boundary.

## Services

| Service | File | Contract |
| --- | --- | --- |
| `SearchService` | `services/SearchService.ts` | `search(query: SearchQuery): Promise<readonly SearchResult[]>` — `quick` = FTS only; `smart` = FTS + vector fused via RRF. Inline operators (`tool:`, `project:`, `>`/`<` dates) override filters. |
| `SessionService` | `services/SessionService.ts` | `findById(id): Promise<SessionDetail \| null>` (session + turns ordered by index); `list(filter): Promise<readonly Session[]>`. |
| `ResumeService` | `services/ResumeService.ts` | `buildCommand(id): Promise<ResumeCommand \| null>` — the shell command to resume a session in its original tool. |
| `IndexerService` | `services/IndexerService.ts` | Controls the indexer worker thread (`start`/`stop`/`fullReindex`) and relays status. |

Supporting pieces: `QueryParser` (operator extraction), `RankFusion` (Reciprocal
Rank Fusion).

## Dependency injection

- **Everything is constructor-injected.** Services never construct their own
  collaborators (not even `QueryParser` — it's injected into `SearchService`).
- **`AppContext` is the single composition root** (`AppContext.ts`). It takes an
  opened `DatabaseHandle` and a worker factory, instantiates repos + services,
  and is the only place `new` appears for collaborators.
- Degrades gracefully: if sqlite-vec is unavailable, the vector repo is `null`
  and the embedder is `NoopEmbedder`, so search still works (keyword-only).

## Logging

- `observability/Logger.ts` — pino-style `(obj, msg?)` interface with `child()`.
  `PinoLogger` (prod, writes to `~/Library/Logs/ai-session-finder/main.log`),
  `SilentLogger` (tests).
- **Always injected, never imported by a service directly.** The single
  main-process logger is injected everywhere (the indexer worker keeps its own
  `@asf/indexer` logger internally).
- **No PII**: services log metadata only (e.g. `{ ms, mode, count }`) — never
  turn content.

## tRPC over Electron IPC

- `ipc/trpc.ts` — `initTRPC` with the **superjson** transformer (Date/Map
  round-trip).
- `ipc/router.ts` — `appRouter` (`search` / `session` / `indexer`); export
  `AppRouter` type for the renderer (end-to-end autocomplete).
- Procedures validate I/O with the `@asf/contracts` Zod schemas. Outputs use the
  contract schemas (string ids) so **branded domain ids never leak** to the
  renderer.
- `ipc/handleTrpcRequest.ts` — transport-agnostic dispatch: superjson-decodes
  input, runs the procedure via `createCaller`, superjson-encodes the result.
  Electron-free, so it's unit-tested without a running Electron process.
- `ipc/electronAdapter.ts` — thin `ipcMain.handle('trpc', …)` glue.
- `preload.ts` — exposes `window.trpc.invoke(path, type, input)` to the renderer.

### Error shape

Every failure returns a consistent envelope:

```ts
{ ok: false, error: { code: string, message: string } }
```

`code` is the tRPC error code (`BAD_REQUEST` for input validation, `NOT_FOUND`
for an unknown path, `INTERNAL_SERVER_ERROR` otherwise).

## Testing

- Each service is unit-tested with mocked repositories.
- `QueryParser` is property-tested; `RankFusion` covers empty/duplicate edges.
- Integration: `ipc/router.integration.test.ts` runs the real router + services
  against an **in-memory** SQLite database (`createInMemoryDatabase`) — no
  filesystem. Run under Node 20 (`.nvmrc`).

## Definition of Done

- [x] `AppContext` is the single composition root
- [x] Renderer can import `AppRouter` and get autocomplete
- [x] tRPC errors have a consistent shape (`{ code, message }`)
- [x] `docs/services.md` documents each service and its contract

## Follow-ups (not blocking Sprint 04)

- The indexer worker needs a dedicated electron-vite build entry
  (`src/services/worker.ts` → `dist/main/worker.js`) before `indexer.start`
  works in the packaged app. No UI consumes it yet.
- `SearchService` p95 latency targets are bounded by SQLite FTS throughput
  (validated in the Sprint 03 benchmark); a dedicated 50k-turn search benchmark
  is a follow-up.
