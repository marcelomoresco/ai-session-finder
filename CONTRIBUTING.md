# Contributing to AI Session Finder

Thanks for your interest in contributing! This project is built in the open,
sprint by sprint. Whether it's a bug report, a feature idea, or a pull request,
you're welcome here.

## Code of Conduct

By participating, you agree to uphold our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

Requires **Node 20+** and **pnpm 9+** (`npm i -g pnpm`).

```bash
git clone https://github.com/OWNER/ai-session-finder.git
cd ai-session-finder
pnpm install
pnpm dev        # launch Electron in dev mode
```

Useful scripts:

| Command           | What it does                     |
| ----------------- | -------------------------------- |
| `pnpm dev`        | Electron + HMR                   |
| `pnpm test`       | run all tests (Vitest)           |
| `pnpm test:watch` | watch mode                       |
| `pnpm lint`       | ESLint                           |
| `pnpm typecheck`  | TypeScript across all workspaces |
| `pnpm format`     | Prettier                         |
| `pnpm build`      | production bundles               |

## Project principles

- **TypeScript strict** — no `any`; prefer `unknown` + type guards.
- **SOLID + DRY** with good sense (no over-engineering; rule of three).
- **Types first** — model the domain before the implementation.
- **Immutability by default** — `readonly`, no mutation outside boundaries.
- **Explicit errors** — `Result<T, E>` or `null`/`undefined`, not `throw` on normal paths.
- **Small functions** — extract when they grow past ~30 lines.
- **Tests** — TDD for new domain/application logic; aim for ≥80% coverage on new code.

## Making a change

1. **Open an issue first** for anything non-trivial, so we can align on approach.
2. **Branch** off `main`: `git checkout -b feat/short-description`.
3. **Write tests** alongside (or before) your change.
4. Make sure `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` a new feature
   - `fix:` a bug fix
   - `chore:` tooling/maintenance
   - `test:` adding or fixing tests
   - `docs:` documentation only
   - `refactor:` neither fixes a bug nor adds a feature
   - Scope is encouraged: `feat(domain): add Session type`.
6. **Open a pull request** against `main`. Fill in the PR template, link the
   issue, and describe what you changed and how you verified it.

## Working with sprints

Active work tracks the plans in [`.claude/sprints/`](./.claude/sprints/ROADMAP.md).
If you're picking up sprint work, read the relevant `sprint-XX-*.md` first.

## Questions

Open a [Discussion](https://github.com/OWNER/ai-session-finder/discussions) or an issue.
Thanks for helping build this! 💛
