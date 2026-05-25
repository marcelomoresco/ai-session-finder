# Session sources

The indexer reads AI coding sessions from three tools behind one interface,
`SessionSource` (`apps/indexer/src/sources/SessionSource.ts`). Each source:

- declares `watchPaths()` — the roots chokidar will watch (Sprint 03);
- implements `matches(filePath)` — a fast, I/O-free regex check of ownership;
- implements `parse(filePath)` — an async iterable of `RawSession`.

`RawSession` is the pre-normalization shape (no `SessionId` — the pipeline
derives that from `tool + sourceId` in Sprint 03). The `SourceRegistry` routes a
path to its owning source and aggregates watch paths.

```ts
import { createDefaultRegistry } from '@asf/indexer';

const registry = createDefaultRegistry();
const source = registry.findFor(path); // SessionSource | null
if (source) {
  for await (const raw of source.parse(path)) {
    /* RawSession */
  }
}
```

> **Schema confidence.** Only fields marked **confirmed** below are guaranteed by
> the spec. Everything else is best-effort and tolerant of drift (lenient Zod,
> `safeParse`, unknown keys stripped) — flagged in code and to be tuned against
> real anonymized fixtures (project Rule 2/5).

---

## Claude Code (`claude-code`)

- **Watch path:** `~/.claude/projects`
- **Matches:** `/\.claude/projects/<url-encoded-cwd>/<session-uuid>.jsonl$`
- **Format:** append-only JSONL; one JSON event per line.
- **`sourceId`:** the `sessionId` field from the events. **(confirmed)**
- **Project path:** the `cwd` field of the first event; the encoded directory
  name is only a fallback (`decodeCwdFromDir`, ambiguous because `/`→`-`).
- **Confirmed fields:** `type`, `uuid`, `parentUuid`, `timestamp`, `sessionId`,
  `cwd`, `gitBranch`, `version`; `message.content` blocks (`text`, `thinking`,
  `tool_use`, `tool_result`); `message.usage`
  (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`).
- **Files touched:** `Read`→read, `Write`→write, `Edit`/`MultiEdit`→edit (path in
  `input.file_path`), `NotebookEdit`→edit (path in `input.notebook_path`).
- **Resilience:** broken JSONL lines are skipped; missing fields tolerated.

## Codex CLI (`codex-cli`)

- **Watch path:** `~/.codex/sessions`
- **Matches:** `/\.codex/sessions/\d{4}/\d{2}/\d{2}/rollout-.+\.jsonl$`
- **Format:** JSONL rollout; one JSON event per line.
- **`sourceId`:** extracted from the filename
  `rollout-<timestamp>-<id>` (trailing id segment, basename as fallback) —
  Codex does not embed it in events. **(confirmed: path/filename only)**
- **Event schema:** **not confirmed** by the spec. A lenient schema captures the
  likely fields (`timestamp`, `role`, `cwd`, `model`, `text`/`content`, `usage`)
  and tolerates the rest. Tune against real rollouts.

## Cursor (`cursor`)

- **Watch path:** `~/Library/Application Support/Cursor/User/workspaceStorage`
- **Matches:** `/Cursor/User/workspaceStorage/<hash>/state.vscdb$`
- **Format:** SQLite (`state.vscdb`), table `cursorDiskKV (key TEXT, value BLOB)`.
  One file holds **many** sessions, so `parse` yields multiple `RawSession`s.
- **Confirmed (spec §9.3):**
  - `composerData:<composerId>` → session metadata (JSON);
  - `bubbleId:<composerId>:<bubbleId>` → one message (JSON);
  - bubbles are ordered by a numeric `createdAt`;
  - `workspace.json` (same folder) maps the hash → real project path.
- **`sourceId`:** the `composerId`. (Multi-machine sync would key on
  `<userId>:<composerId>` — deferred to v0.3.)
- **Not confirmed (best-effort, flagged for tuning):** the bubble fields for
  message role (`role` string, or numeric `type`: 1=user, 2=assistant) and body
  (`text`, falling back to `richText`); composer-meta `name`/timestamps/`model`;
  the `workspace.json` `folder` URL. Token usage is **always zero** — Cursor does
  not expose it in the vscdb.
- **Lock handling:** if the live DB is locked (Cursor running), the reader copies
  it to a temp file and reads the copy (`CursorVscdbReader.openSafely`).
- **Resilience:** rows whose JSON is malformed (composer or bubble) are skipped.

### Test fixtures

`@asf/test-fixtures` exposes `createCursorFixture(outPath, { composerCount,
bubblesPerComposer })`, which writes a synthetic `state.vscdb` for unit tests.
Real, anonymized fixtures are produced separately by running `redactSecrets` over
real sessions before committing.
