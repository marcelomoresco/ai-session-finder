# Sprint 05 — UI Launcher

## Objetivo

Renderer React funcional: launcher estilo Spotlight (cmdk), lista de resultados, preview pane com markdown renderizado, filtros, dark mode. Ao final do sprint, app é usável (sem menu bar tray nem global shortcut ainda — isso no Sprint 06).

## Pré-requisitos

- Sprint 04 (tRPC + AppContext rodando)

## Tasks

### Task 05.1 — Setup do tRPC client + TanStack Query

**Arquivos:**

- `apps/renderer/src/lib/trpc.ts`
- `apps/renderer/src/lib/queryClient.ts`
- `apps/renderer/src/providers/AppProviders.tsx`

**O que fazer:**

```typescript
// trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@cs/main/ipc/router';

export const trpc = createTRPCReact<AppRouter>();
```

```typescript
// queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});
```

```typescript
// AppProviders.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [trpcClient] = useState(() => createElectronTrpcClient(window.trpc));
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
```

`createElectronTrpcClient`: adapter customizado que conecta tRPC client ao `window.trpc.invoke` do preload.

**Critério de aceite:**

- `trpc.search.query.useQuery({ text: 'x' })` chama main process e retorna dados tipados
- Erros aparecem em `query.error` com shape consistente

---

### Task 05.2 — Hook `useDebouncedValue`

**Arquivo:** `apps/renderer/src/hooks/useDebouncedValue.ts`

```typescript
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

**Critério de aceite:** testes com `vi.useFakeTimers()`.

---

### Task 05.3 — Hook `useSearch`

**Arquivo:** `apps/renderer/src/hooks/useSearch.ts`

```typescript
export interface UseSearchOptions {
  readonly query: string;
  readonly filters?: SearchFilters;
}

export function useSearch({ query, filters }: UseSearchOptions) {
  const debouncedQuery = useDebouncedValue(query, 150);
  const debouncedSmart = useDebouncedValue(query, 350);

  const quick = trpc.search.query.useQuery(
    { text: debouncedQuery, mode: 'quick', filters: filters ?? {}, limit: 30 },
    { enabled: debouncedQuery.length > 0 },
  );

  const smart = trpc.search.query.useQuery(
    { text: debouncedSmart, mode: 'smart', filters: filters ?? {}, limit: 30 },
    { enabled: debouncedSmart.length > 2 },
  );

  return {
    results: smart.data ?? quick.data ?? [],
    isLoading: quick.isLoading,
    isRefining: smart.isFetching && !smart.data,
  };
}
```

**Justificativa:** quick aparece rápido (150ms), smart refina (350ms). UX não trava esperando o semantic.

**Critério de aceite:**

- Testes com MSW mockando tRPC retornam resultados corretos
- Não dispara busca pra string vazia

---

### Task 05.4 — Componente `Launcher`

**Arquivos:**

- `apps/renderer/src/components/Launcher.tsx`
- `apps/renderer/src/components/ResultList.tsx`
- `apps/renderer/src/components/ResultItem.tsx`
- `apps/renderer/src/components/ToolBadge.tsx`

**O que fazer:**
Usar `cmdk` para CommandPalette acessível:

```tsx
import { Command } from 'cmdk';

export function Launcher() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const { results, isLoading, isRefining } = useSearch({ query, filters });

  return (
    <Command label="Search sessions" className="launcher">
      <Command.Input
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search across all your AI coding sessions…"
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <Command.List>
        {isLoading && <Command.Loading>Searching…</Command.Loading>}
        <Command.Empty>No results.</Command.Empty>
        {results.map((r) => (
          <ResultItem key={r.turnId} result={r} />
        ))}
      </Command.List>
      {isRefining && <RefiningIndicator />}
    </Command>
  );
}
```

`ResultItem`:

```tsx
export function ResultItem({ result }: { result: SearchResult }) {
  const navigate = useNavigate();
  return (
    <Command.Item
      value={result.turnId}
      onSelect={() => navigate(`/sessions/${result.sessionId}#turn-${result.turnId}`)}
    >
      <div className="flex items-center gap-2">
        <ToolBadge tool={result.tool} />
        <span className="font-medium">{result.projectName ?? 'Unknown project'}</span>
        <span className="text-muted-foreground text-xs">
          {formatRelative(result.lastActivityAt)}
        </span>
      </div>
      <p className="text-sm line-clamp-2 mt-1">{result.snippet}</p>
    </Command.Item>
  );
}
```

**Critério de aceite:**

- Setas ↑↓ navegam
- Enter abre sessão
- ESC limpa busca / fecha
- Loading state visível em <100ms
- Acessível (testes com `@testing-library/react` + `userEvent`)

---

### Task 05.5 — `FilterBar`

**Arquivo:** `apps/renderer/src/components/FilterBar.tsx`

**O que fazer:**
Chips clicáveis para tool / projeto / data:

```tsx
export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex gap-2 p-2 border-b">
      <ToolFilter
        selected={filters.tools ?? []}
        onChange={(tools) => onChange({ ...filters, tools })}
      />
      <ProjectFilter
        value={filters.projectPath ?? null}
        onChange={(projectPath) => onChange({ ...filters, projectPath: projectPath ?? undefined })}
      />
      <DateRangeFilter
        after={filters.after ?? null}
        before={filters.before ?? null}
        onChange={(after, before) => onChange({ ...filters, after, before })}
      />
    </div>
  );
}
```

**Critério de aceite:**

- Sincronizado com URL params (pra deep-link funcionar)
- Reset clica e zera tudo
- Mostra contador "3 filters active"

---

### Task 05.6 — `PreviewPane`

**Arquivos:**

- `apps/renderer/src/components/PreviewPane.tsx`
- `apps/renderer/src/components/TurnBlock.tsx`
- `apps/renderer/src/components/CodeBlock.tsx`
- `apps/renderer/src/lib/markdown.ts` (renderer com Shiki)

**O que fazer:**

```tsx
export function PreviewPane({ sessionId, focusedTurnId }: PreviewPaneProps) {
  const { data, isLoading } = trpc.session.get.useQuery({ id: sessionId });
  const focusedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: 'center' });
  }, [focusedTurnId]);

  if (isLoading) return <Skeleton />;
  if (!data) return <NotFound />;

  return (
    <article className="preview-pane">
      <header>
        <h2>{data.session.projectName ?? 'Untitled session'}</h2>
        <SessionMeta session={data.session} />
      </header>
      <div className="turns">
        {data.turns.map((turn) => (
          <TurnBlock
            key={turn.id}
            turn={turn}
            isFocused={turn.id === focusedTurnId}
            ref={turn.id === focusedTurnId ? focusedRef : undefined}
          />
        ))}
      </div>
      <ResumeButton sessionId={data.session.id} />
    </article>
  );
}
```

**Markdown rendering:**

```typescript
// lib/markdown.ts
import { getHighlighter } from 'shiki';
import { marked } from 'marked';

let highlighterPromise: ReturnType<typeof getHighlighter> | null = null;

async function getOrCreateHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['typescript', 'javascript', 'python', 'rust', 'go', 'bash', 'sql', 'json'],
    });
  }
  return highlighterPromise;
}

export async function renderMarkdown(md: string, theme: 'light' | 'dark'): Promise<string> {
  const highlighter = await getOrCreateHighlighter();
  marked.setOptions({
    highlight: (code, lang) => {
      try {
        return highlighter.codeToHtml(code, {
          lang,
          theme: theme === 'light' ? 'github-light' : 'github-dark',
        });
      } catch {
        return code;
      }
    },
  });
  return marked.parse(md);
}
```

**Critério de aceite:**

- Render de sessão grande (200 turnos) em <500ms
- Code blocks com syntax highlight
- Scroll automático para turno focado
- Botão "Resume" copia comando pro clipboard

---

### Task 05.7 — `ResumeButton`

**Arquivo:** `apps/renderer/src/components/ResumeButton.tsx`

**O que fazer:**

```tsx
export function ResumeButton({ sessionId }: { sessionId: SessionId }) {
  const [copied, setCopied] = useState(false);
  const { data } = trpc.resume.buildCommand.useQuery({ sessionId });

  const handleClick = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleClick} disabled={!data}>
      {copied ? '✓ Copied' : `Copy: ${data?.command ?? 'Loading…'}`}
    </button>
  );
}
```

**Critério de aceite:**

- Copia comando para clipboard
- Mostra feedback visual
- Acessível via Cmd+C quando focado

---

### Task 05.8 — Theming (dark/light)

**Arquivos:**

- `apps/renderer/src/providers/ThemeProvider.tsx`
- `apps/renderer/src/styles/globals.css`
- `apps/renderer/tailwind.config.ts`

**O que fazer:**

- ThemeProvider lê preferência do sistema via `nativeTheme` do Electron (exposto via preload)
- Toggle manual em Settings
- Tailwind 4 com `@theme` directive para cores semânticas

**Critério de aceite:**

- Trocar tema do sistema reflete no app em <1s
- Sem flash branco no boot

---

### Task 05.9 — Routing simples

**Arquivos:**

- `apps/renderer/src/router.tsx`

**O que fazer:**
Usar `react-router-dom` (HashRouter, sem servidor) com rotas:

- `/` — Launcher
- `/sessions/:id` — PreviewPane fullscreen
- `/settings` — Settings page (placeholder)

**Critério de aceite:**

- Navegação funciona
- Deep-links abrem direto

---

## Testes obrigatórios deste sprint

- `useDebouncedValue` com fake timers
- `useSearch` com MSW
- `Launcher` E2E com Playwright (digitar → ver resultado → enter)
- `PreviewPane` render snapshot

## Definition of Done (Sprint 05)

- [ ] App rodando: ⌘+Space (manual, sem global ainda) abre launcher, digita, vê resultados, clica, vê preview
- [ ] Sem console errors no DevTools
- [ ] Lighthouse accessibility ≥95
- [ ] `pnpm test:e2e` passa
- [ ] `docs/ui.md` com screenshots dos componentes principais

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 05 do projeto Codex Spotlight.

Leia .claude/sprints/sprint-05-ui-launcher.md e execute as 9 tasks em ordem.

Regras críticas:
1. Componentes pequenos e focados — máx 80 linhas, extrair se passar
2. NÃO use Redux/Zustand. TanStack Query + useState bastam.
3. Acessibilidade obrigatória: labels, roles, keyboard nav
4. Estilos com Tailwind, NUNCA CSS-in-JS
5. shadcn/ui components quando aplicável (instalar via CLI conforme precisar)
6. Para Playwright, configurar com electron support: import { _electron as electron }

Comece pela Task 05.1.
```
