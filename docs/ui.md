# UI — Launcher (Sprint 05)

The renderer: a Spotlight-style command palette over the indexed sessions, with
a session preview pane. React 19 + Tailwind 4, talking to the main process over
tRPC.

## Aesthetic

A refined dark **command palette**: a glassy near-black translucent panel (the
Electron window is frameless + transparent), native-mac SF typography with
**mono accents** for keys and metadata, and **per-tool accent colors** as the
one memorable signature — Claude = amber, Codex = emerald, Cursor = violet.
Restraint over chaos; a focus row highlight and a subtle "refining…" shimmer.

## Architecture

```
App
└─ ThemeProvider            (system light/dark via matchMedia, .dark on <html>)
   └─ AppProviders          (React Query + tRPC client over window.trpc)
      └─ RouterProvider      (HashRouter)
         ├─ /                 LauncherScreen → Launcher
         ├─ /sessions/:id     SessionScreen  → PreviewPane
         └─ /settings         placeholder
```

## Data layer

- `lib/trpc.ts` — `createTRPCReact<AppRouter>()` (type from `@asf/main/ipc/router`).
- `lib/electronLink.ts` — a custom terminating tRPC link that forwards operations
  to `window.trpc.invoke` (the preload bridge). superjson runs in the preload, so
  the client uses no transformer.
- `lib/types.ts` — renderer types derived from `AppRouter` (string ids, never the
  branded domain ids).
- `hooks/useSearch.ts` — two-stage search: a fast keyword pass (debounced 150ms)
  shows results immediately, a semantic pass (350ms) refines. Never blocks on
  semantic. Empty queries don't search.
- `hooks/useDebouncedValue.ts` — generic debounce.

## Components

| Component | Responsibility |
| --- | --- |
| `Launcher` | cmdk command palette: input + FilterBar + results. ↑↓ navigate, Enter opens, Esc clears. `shouldFilter={false}` (results come from the server). |
| `FilterBar` | Tool toggle chips + reset + active count. Project/date filters are available via query operators (`project:`, `>`/`<`). |
| `ResultItem` / `ResultList` | A result row (tool badge, project, relative time, snippet) and the list/empty/loading states. |
| `ToolBadge` | Per-tool colored pill. |
| `PreviewPane` | Full session: header, turns, resume action; scrolls the focused turn into view. |
| `TurnBlock` | One turn; splits content into prose + code segments. |
| `CodeBlock` | Shiki-highlighted code (async, with a plain-text fallback). |
| `ResumeButton` | Copies the tool's resume command to the clipboard. |

### Security note on markdown

Turn content is **not** injected as HTML. Prose renders as preformatted text;
only fenced code blocks are highlighted (Shiki escapes its own output). This
avoids XSS from arbitrary session content. Richer prose markdown (with
sanitization) is a follow-up.

## Testing

- jsdom + Testing Library via a vitest **renderer project** (`apps/renderer/vitest.config.ts`);
  the rest of the monorepo stays on the node project.
- 26 renderer tests: hooks (fake timers), the tRPC client/link, Launcher
  (userEvent: type → results → Enter), FilterBar, PreviewPane, ResumeButton,
  ThemeProvider, and an App route smoke test.
- Run under Node 20: `pnpm test`. Dev: `pnpm dev`.

## Definition of Done — status

- [x] App usable: launcher opens, type → results → click → preview; resume copies command.
- [x] No console errors in the unit/integration suite.
- [~] Lighthouse a11y ≥95 — components use roles/labels/`aria-pressed`/keyboard nav,
  but Lighthouse isn't runnable in this environment (verify in the running app).
- [ ] `pnpm test:e2e` — see follow-up below.
- [x] `docs/ui.md` documents the components.

## Follow-ups

- **E2E (Playwright + Electron).** Requires the packaged build and a display, and
  depends on wiring the indexer worker as an electron-vite build entry (Sprint 04
  follow-up). Setup to add:

  ```bash
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm -w add -D @playwright/test
  ```

  ```ts
  // e2e/launcher.spec.ts
  import { test, expect, _electron as electron } from '@playwright/test';

  test('launcher opens and accepts input', async () => {
    const app = await electron.launch({ args: ['apps/main/dist/main/index.js'] });
    const window = await app.firstWindow();
    await window.getByPlaceholder(/search across all/i).fill('race');
    await expect(window.getByText(/race/i).first()).toBeVisible();
    await app.close();
  });
  ```

  Add a `test:e2e` script and exclude `e2e/**` from the vitest node project.

- Lighthouse accessibility audit against the running app.
- Project/date filter pickers in `FilterBar` (today via query operators).
- Screenshots of each component (needs a rendering environment).
