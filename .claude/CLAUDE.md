# AI Session Finder — Context for Claude Code

## What this is

Open-source macOS launcher for searching across Claude Code, Codex CLI, and
Cursor sessions. Local-first: indexing and embeddings run on-device.

## Stack

- Electron + TypeScript (strict) + React 19
- electron-vite (build/HMR); Vite 7 (electron-vite caps Vite at ^7), Tailwind 4
- SQLite via better-sqlite3 (synchronous) + FTS5 + sqlite-vec
- Transformers.js for local embeddings
- tRPC for IPC, Zod for schemas, Vitest for tests

## Conventions

- pnpm only (no npm/yarn). Workspaces under `apps/*` and `packages/*`.
- TypeScript strict — no `any`; use `unknown` + type guards.
- SOLID + DRY with good sense (rule of three; no over-engineering).
- Types first — model the domain before implementing.
- Immutability by default — `readonly`, no mutation outside boundaries.
- Explicit errors — `Result<T, E>` / `null` / `undefined`, not `throw` on normal paths.
- Dependency Injection — services take deps in the constructor.
- Branded domain types must NOT leak past the domain layer — convert at boundaries.
- SQL lives in `queries.ts` as const strings, never inline.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).
- TDD when feasible (tests first for new domain/application logic); ≥80% coverage on new code.

## Package scope & naming

- Workspace scope is `@asf/*` (e.g. `@asf/domain`, `@asf/contracts`, `@asf/main`).
- Root package + repo are named `ai-session-finder`.

## Where things live

- `apps/main` — Electron main process (electron-vite, frameless transparent window)
- `apps/renderer` — React UI (Tailwind 4 + shadcn/ui base)
- `apps/indexer` — indexing worker thread (Sprint 03)
- `packages/domain` — pure types + domain logic
- `packages/contracts` — tRPC/Zod IPC schemas
- `packages/test-fixtures` — anonymized session data (added when first needed)

## Commands

- `pnpm dev` — start Electron in dev mode (HMR)
- `pnpm build` — production bundles (`pnpm -r build`)
- `pnpm test` / `pnpm test:watch` — run tests (Vitest)
- `pnpm lint` / `pnpm lint:fix` — ESLint (flat config, type-aware)
- `pnpm typecheck` — TypeScript across all workspaces
- `pnpm format` — Prettier

## Gotchas

- pnpm 10 blocks dependency build scripts by default; allowed ones are listed in
  the root `package.json` under `pnpm.onlyBuiltDependencies` (electron, esbuild,
  @tailwindcss/oxide, @swc/core). Add native deps (e.g. better-sqlite3) there.
- electron-vite externalizes deps for the main process; `@asf/*` workspace
  packages are excluded so their source is bundled (see `electron.vite.config.ts`).

## When in doubt

Read the sprint file under `.claude/sprints/sprint-XX-*.md` matching the current
work. Start from `.claude/sprints/ROADMAP.md`.
