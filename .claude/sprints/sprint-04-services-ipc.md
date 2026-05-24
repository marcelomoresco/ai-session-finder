# Sprint 04 — Services & IPC

## Objetivo

Camada de aplicação: `SearchService`, `SessionService`, `ResumeService`. Tudo exposto via tRPC com tipos compartilhados em `@cs/contracts`. Renderer já consegue chamar busca e receber resultados tipados.

## Pré-requisitos

- Sprint 01 (repositories)
- Sprint 02 (sources)
- Sprint 03 (pipeline e embedder)

## Tasks

### Task 04.1 — `SearchService`

**Arquivos:**

- `apps/main/src/services/SearchService.ts`
- `apps/main/src/services/RankFusion.ts`
- `apps/main/src/services/QueryParser.ts`

**O que fazer:**

`QueryParser` extrai operadores estilo `tool:claude project:foo >2026-05-01`:

```typescript
export interface ParsedQuery {
  readonly text: string;
  readonly tools: ReadonlyArray<Tool>;
  readonly projectPath: string | null;
  readonly after: Date | null;
  readonly before: Date | null;
}

export class QueryParser {
  parse(raw: string): ParsedQuery {
    const tools: Tool[] = [];
    let projectPath: string | null = null;
    let after: Date | null = null;
    let before: Date | null = null;
    const textTokens: string[] = [];

    for (const token of raw.split(/\s+/).filter(Boolean)) {
      if (token.startsWith('tool:')) {
        const value = token.slice(5);
        if (isTool(value)) tools.push(value);
      } else if (token.startsWith('project:')) {
        projectPath = token.slice(8);
      } else if (token.startsWith('>')) {
        const d = new Date(token.slice(1));
        if (!isNaN(d.getTime())) after = d;
      } else if (token.startsWith('<')) {
        const d = new Date(token.slice(1));
        if (!isNaN(d.getTime())) before = d;
      } else {
        textTokens.push(token);
      }
    }

    return { text: textTokens.join(' '), tools, projectPath, after, before };
  }
}
```

`RankFusion` implementa Reciprocal Rank Fusion:

```typescript
export interface RankedItem {
  readonly id: string;
  readonly rank: number;
}

export class RankFusion {
  static fuse(
    rankings: ReadonlyArray<ReadonlyArray<RankedItem>>,
    k = 60,
  ): ReadonlyArray<{ id: string; score: number }> {
    const scores = new Map<string, number>();
    for (const ranking of rankings) {
      for (const item of ranking) {
        const prev = scores.get(item.id) ?? 0;
        scores.set(item.id, prev + 1 / (k + item.rank));
      }
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);
  }
}
```

`SearchService` orquestra:

```typescript
export interface SearchServiceDeps {
  readonly repo: SearchableRepository;
  readonly vectorRepo: VectorRepository | null;
  readonly embedder: Embedder;
  readonly logger: Logger;
}

export class SearchService {
  private readonly parser = new QueryParser();

  constructor(private readonly deps: SearchServiceDeps) {}

  async search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>> {
    const start = performance.now();
    const parsed = this.parser.parse(query.text);

    const enhanced: SearchQuery = {
      ...query,
      text: parsed.text || query.text,
      filters: {
        tools: parsed.tools.length ? parsed.tools : query.filters.tools,
        projectPath: parsed.projectPath ?? query.filters.projectPath,
        after: parsed.after ?? query.filters.after,
        before: parsed.before ?? query.filters.before,
      },
    };

    if (query.mode === 'quick' || !this.deps.embedder.enabled || !this.deps.vectorRepo) {
      const results = await this.deps.repo.search(enhanced);
      this.logElapsed('quick', start, results.length);
      return results;
    }

    return this.smartSearch(enhanced, start);
  }

  private async smartSearch(
    query: SearchQuery,
    start: number,
  ): Promise<ReadonlyArray<SearchResult>> {
    const [ftsResults, queryVector] = await Promise.all([
      this.deps.repo.search({ ...query, limit: 50 }),
      this.deps.embedder.embed(query.text),
    ]);

    const vecMatches = await this.deps.vectorRepo!.search(queryVector, 50);
    const fused = RankFusion.fuse([
      ftsResults.map((r, i) => ({ id: r.turnId, rank: i })),
      vecMatches.map((v, i) => ({ id: v.turnId, rank: i })),
    ]).slice(0, query.limit);

    // Hidratar fused com metadata
    const byId = new Map(ftsResults.map((r) => [r.turnId, r]));
    const results = fused
      .map((f) => byId.get(f.id))
      .filter((r): r is SearchResult => r !== undefined);

    this.logElapsed('smart', start, results.length);
    return results;
  }

  private logElapsed(mode: string, start: number, count: number): void {
    this.deps.logger.debug({ ms: performance.now() - start, mode, count }, 'search.done');
  }
}
```

**Testes:**

- `QueryParser` property-based (operadores em qualquer ordem)
- `RankFusion`: rankings idênticos → ordem preservada; rankings diferentes → fusão balanceada
- `SearchService` com mocks: chama `vectorRepo` em smart, não chama em quick

**Critério de aceite:**

- Quick search <50ms p95 (fixture com 50k turnos)
- Smart search <250ms p95
- Cobertura ≥85%

---

### Task 04.2 — `SessionService`

**Arquivos:**

- `apps/main/src/services/SessionService.ts`
- `apps/main/src/services/SessionDetail.ts`

**O que fazer:**

```typescript
export interface SessionDetail {
  readonly session: Session;
  readonly turns: ReadonlyArray<Turn>;
}

export class SessionService {
  constructor(
    private readonly reader: SessionReader,
    private readonly turnReader: TurnReader,
  ) {}

  async findById(id: SessionId): Promise<SessionDetail | null> {
    const session = await this.reader.findById(id);
    if (!session) return null;
    const turns = await this.turnReader.listBySession(id);
    return { session, turns };
  }

  async list(filter: SessionListFilter): Promise<ReadonlyArray<Session>> {
    return this.reader.list(filter);
  }
}
```

Adicionar `TurnReader` ao `SessionReader` (extensão da ISP de Sprint 01):

```typescript
export interface TurnReader {
  listBySession(sessionId: SessionId): Promise<ReadonlyArray<Turn>>;
  findById(id: TurnId): Promise<Turn | null>;
}
```

Implementar em `SQLiteRepository` (mais um método).

**Critério de aceite:**

- `findById` retorna sessão + turnos ordenados por `index`
- `list` respeita filtros
- Cobertura ≥85%

---

### Task 04.3 — `ResumeService`

**Arquivos:**

- `apps/main/src/services/ResumeService.ts`
- `apps/main/src/services/ResumeCommand.ts`

**O que fazer:**
Constrói comando shell para retomar sessão na ferramenta original:

```typescript
export interface ResumeCommand {
  readonly command: string;
  readonly workingDirectory: string | null;
  readonly hint: string;
}

export class ResumeService {
  constructor(private readonly reader: SessionReader) {}

  async buildCommand(sessionId: SessionId): Promise<ResumeCommand | null> {
    const session = await this.reader.findById(sessionId);
    if (!session) return null;

    switch (session.tool) {
      case 'claude-code':
        return {
          command: `claude --resume ${session.sourceId}`,
          workingDirectory: session.projectPath,
          hint: 'Run in terminal at the project directory',
        };
      case 'codex-cli':
        return {
          command: `codex resume ${session.sourceId}`,
          workingDirectory: session.projectPath,
          hint: 'Run in terminal at the project directory',
        };
      case 'cursor':
        return {
          command: session.projectPath ? `cursor "${session.projectPath}"` : 'cursor',
          workingDirectory: null,
          hint: 'Opens Cursor at the project; chat history will be accessible in the sidebar',
        };
    }
  }
}
```

**Critério de aceite:**

- Cada tool retorna comando válido
- Sessão sem `projectPath` retorna comando sem cwd
- Cobertura 100%

---

### Task 04.4 — `Logger` adapter

**Arquivos:**

- `apps/main/src/observability/Logger.ts`
- `apps/main/src/observability/PinoLogger.ts`
- `apps/main/src/observability/SilentLogger.ts`

**O que fazer:**

```typescript
export interface Logger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

export class PinoLogger implements Logger {
  constructor(private readonly pino: pino.Logger) {}
  // delegação
}

export class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  child(): Logger {
    return this;
  }
}
```

Por que adapter: testes não precisam de logger real; futura troca de Pino por outra lib não quebra services.

**Critério de aceite:**

- Logs vão para `~/Library/Logs/codex-spotlight/main.log` em prod
- Sem logs em testes (SilentLogger)
- Sem PII nos logs (não logar `contentText`)

---

### Task 04.5 — `AppContext` (composition root)

**Arquivo:** `apps/main/src/AppContext.ts`

**O que fazer:**
Único lugar onde dependências são instanciadas e injetadas:

```typescript
export interface AppContext {
  readonly searchService: SearchService;
  readonly sessionService: SessionService;
  readonly resumeService: ResumeService;
  readonly indexerService: IndexerService;
  readonly logger: Logger;
  close(): Promise<void>;
}

export function createAppContext(): AppContext {
  const logger = createProductionLogger();
  const { db, close: closeDb } = createDatabase();
  const repo = new SQLiteRepository(db);

  let vectorRepo: VectorRepository | null = null;
  try {
    vectorRepo = new SqliteVecRepository(db);
  } catch (err) {
    logger.warn({ err: String(err) }, 'sqlite-vec unavailable; semantic search disabled');
  }

  const embedder = vectorRepo ? new LocalEmbedder() : new NoopEmbedder();

  const searchService = new SearchService({ repo, vectorRepo, embedder, logger });
  const sessionService = new SessionService(repo, repo);
  const resumeService = new ResumeService(repo);
  const indexerService = new IndexerService(logger);

  return {
    searchService,
    sessionService,
    resumeService,
    indexerService,
    logger,
    async close() {
      await indexerService.stop();
      closeDb();
    },
  };
}
```

**Critério de aceite:**

- Único ponto de instanciação
- Falha graciosamente se sqlite-vec não carregar
- Testes podem criar contexto com mocks

---

### Task 04.6 — tRPC router e procedures

**Arquivos:**

- `apps/main/src/ipc/router.ts`
- `apps/main/src/ipc/createContext.ts`
- `apps/main/src/ipc/procedures/search.ts`
- `apps/main/src/ipc/procedures/session.ts`
- `apps/main/src/ipc/procedures/indexer.ts`
- `apps/main/src/ipc/electronAdapter.ts`

**O que fazer:**

```typescript
// createContext.ts
export interface TrpcContext {
  readonly app: AppContext;
}

export function createTrpcContext(app: AppContext): TrpcContext {
  return { app };
}
```

```typescript
// router.ts
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { TrpcContext } from './createContext.js';

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  search: searchProcedures,
  session: sessionProcedures,
  indexer: indexerProcedures,
});

export type AppRouter = typeof appRouter;
```

```typescript
// procedures/search.ts
import { SearchQuerySchema, SearchResultSchema } from '@cs/contracts';
import { z } from 'zod';

export const searchProcedures = router({
  query: publicProcedure
    .input(SearchQuerySchema)
    .output(z.array(SearchResultSchema))
    .query(({ input, ctx }) => ctx.app.searchService.search(input)),
});
```

**`electronAdapter.ts`** — bridge entre tRPC e Electron IPC:

```typescript
import { ipcMain, type WebContents } from 'electron';
import { callProcedure } from '@trpc/server';

const IPC_CHANNEL = 'trpc';

export function attachTrpcToElectron(router: AppRouter, ctx: TrpcContext): void {
  ipcMain.handle(IPC_CHANNEL, async (_event, { path, type, input }) => {
    try {
      const result = await callProcedure({
        procedures: router._def.procedures,
        path,
        rawInput: input,
        ctx,
        type,
      });
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: serializeError(err) };
    }
  });
}
```

`preload.ts` expõe um client tipado para o renderer:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('trpc', {
  invoke: (path: string, type: 'query' | 'mutation', input: unknown) =>
    ipcRenderer.invoke('trpc', { path, type, input }),
});
```

**Critério de aceite:**

- Type-safe end-to-end: renderer chama `trpc.search.query.query({ text: 'x' })` com autocomplete
- Erros são serializados sem perder stack
- Cobertura ≥80%

---

## Testes obrigatórios deste sprint

- Cada service com mocks dos repositories
- `QueryParser` property-based
- `RankFusion` casos edge (rankings vazios, IDs duplicados)
- Integration: router + AppContext real com SQLite in-memory

## Definition of Done (Sprint 04)

- [ ] `AppContext` é único composition root
- [ ] Renderer pode importar `AppRouter` type e ter autocomplete
- [ ] Erros tRPC têm shape consistente (`{ code, message, cause? }`)
- [ ] `docs/services.md` documenta cada service e seus contratos

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 04 do projeto Codex Spotlight.

Leia .claude/sprints/sprint-04-services-ipc.md e execute as 6 tasks em ordem.

Regras críticas:
1. Dependency Injection religiosa — services recebem TUDO no construtor
2. Logger SEMPRE injetado, nunca importado direto
3. tRPC: usar superjson como transformer (Date, Map roundtrip)
4. NÃO logar conteúdo de turn (privacidade) — só metadata
5. Integration tests devem rodar com SQLite in-memory, não tocar filesystem real
6. Pare e me consulte se algum schema Zod do contracts precisar mudar

Comece pela Task 04.1.
```
