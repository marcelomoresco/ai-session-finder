<!-- Badges use the OWNER placeholder; replace `OWNER` with your GitHub org/user once the repo is pushed. -->

# AI Session Finder

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/OWNER/ai-session-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/ai-session-finder/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/badge/downloads-coming_soon-lightgrey.svg)](#)

> **Status: 🚧 Work in progress.** Building in the open, sprint by sprint.

A fast, open-source macOS launcher for searching across your **Claude Code**, **Codex CLI**, and **Cursor** sessions — one keystroke to find that conversation you half-remember.

## Why

Your AI coding history is scattered across tools, each with its own log format. AI Session Finder indexes them locally and gives you a single Spotlight-style search over everything: full-text and semantic, fully on-device.

## Stack

- **Electron** + **TypeScript** (strict) + **React 19**
- **SQLite** via `better-sqlite3` (FTS5 + `sqlite-vec` for vector search)
- **Transformers.js** for local embeddings (no data leaves your machine)
- **tRPC** for IPC, **Vitest** for tests
- **pnpm** workspaces, **ESLint** + **Prettier**

## Project layout

```
apps/
  main/        Electron main process (electron-vite)
  renderer/    React UI (Tailwind 4 + shadcn/ui)
  indexer/     indexing worker thread        (Sprint 03)
packages/
  domain/      pure types + domain logic     (Sprint 01)
  contracts/   tRPC/Zod IPC schemas          (Sprint 04)
```

## Quick start

Requires **Node 20+** and **pnpm 9+** (`npm i -g pnpm`).

```bash
pnpm install     # install workspace deps
pnpm dev         # launch Electron in dev mode (HMR)
pnpm test        # run the test suite
pnpm lint        # ESLint
pnpm typecheck   # TypeScript across all workspaces
pnpm build       # production bundles
```

## Roadmap

Development is organized into eight sprints (00 → 07). The plans live in
[`.claude/sprints/`](./.claude/sprints/ROADMAP.md) — start with the
[roadmap](./.claude/sprints/ROADMAP.md).

| Sprint | Theme                | Status         |
| ------ | -------------------- | -------------- |
| 00     | Foundation (setup)   | 🟢 in progress |
| 01     | Domain & Persistence | ⬜             |
| 02     | Source Adapters      | ⬜             |
| 03     | Indexer Pipeline     | ⬜             |
| 04     | Services & IPC       | ⬜             |
| 05     | UI Launcher          | ⬜             |
| 06     | macOS Integration    | ⬜             |
| 07     | Release              | ⬜             |

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md). To report a security issue, see
[SECURITY.md](./SECURITY.md).

## License

[Apache License 2.0](./LICENSE) © AI Session Finder contributors
