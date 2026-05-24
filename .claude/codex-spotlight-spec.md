# Codex Spotlight — Spec Técnica (MVP)

> **Versão:** 0.1 (draft)
> **Data:** 22/05/2026
> **Autor:** Marcelo + Claude
> **Status:** Em discussão — pronto para fatiamento de sprint

---

## 1. Visão & Posicionamento

**Tagline:** _Spotlight para suas sessões de AI coding._

**Problema concreto:** Devs sêniores usam Claude Code, Codex CLI e Cursor diariamente, gerando dezenas de sessões por semana espalhadas em formatos diferentes (JSONL, SQLite). Quando precisam lembrar _"onde mexi naquele bug do webhook?"_ ou _"qual sessão refatorou o schema do User?"_, a única opção é grep manual em diretórios obscuros. Não há busca unificada, semântica, nem timeline.

**Proposta de valor:**

1. **Busca unificada** (keyword + semântica) em todas as sessões locais.
2. **Launcher estilo Spotlight** (⌘+Shift+Space) com preview e jump-back.
3. **Local-first absoluto** — nada sai da máquina. Auditável.
4. **Multi-tool** — Claude Code, Codex, Cursor no MVP. Aider, Windsurf, Cline no roadmap.
5. **100% open source** — Apache 2.0, contribuições da comunidade bem-vindas, sem feature gating.

**Modelo:** Projeto comunitário, sem versão paga. Sustentabilidade via GitHub Sponsors / Open Collective para quem quiser apoiar, mas o software é integralmente livre. Sem analytics, sem telemetria, sem upsell.

**Não-escopo (MVP):**

- Sync entre máquinas (entra como contribuição da comunidade depois).
- Edição/anotação de sessões.
- Compartilhamento social/team features.
- Análises avançadas de produtividade (heatmap, etc).

**Posicionamento competitivo:** Não há concorrente direto consolidado. Existem CLIs nichados (`codex-history-list`, `claude-JSONL-browser`, `cursor-history`) mas são single-tool e sem busca semântica. Janela de oportunidade ampla mas curta (~12–18 meses antes de Anthropic/OpenAI lançarem algo nativo).

---

## 2. Personas e Casos de Uso

### Persona principal: "Dev Sênior Multi-Tool"

- Usa Claude Code para refactor, Codex CLI para scripts rápidos, Cursor para edição visual.
- 5–15 sessões por dia, 50+ projetos no histórico.
- Valoriza velocidade, privacidade, integração com workflow existente.

### Casos de uso prioritários (MVP)

| ID  | Como dev, eu quero...                                                | Frequência |
| --- | -------------------------------------------------------------------- | ---------- |
| UC1 | Buscar sessões por keyword/conceito sem abrir terminal               | Diária     |
| UC2 | Ver preview da sessão antes de retomar                               | Diária     |
| UC3 | Saltar de volta para a sessão (retomar contexto na ferramenta certa) | 2-3x/dia   |
| UC4 | Filtrar por projeto, data, ferramenta                                | Diária     |
| UC5 | Ver quais arquivos foram tocados em cada sessão                      | Ocasional  |

### Casos de uso pós-MVP

- UC6: Timeline semanal/mensal de tempo gasto por projeto.
- UC7: Detectar duplicatas ("essa pergunta o time já respondeu").
- UC8: Export markdown limpo para PR/issue.

---

## 3. Decisões Arquiteturais (ADRs resumidos)

| #   | Decisão                                                         | Alternativa                  | Justificativa                                                                                                                 |
| --- | --------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 01  | **Electron + TypeScript**                                       | SwiftUI, Tauri               | Velocidade de iteração, ecossistema NPM, time conhece TS. Bundle pesado mitigado por `electron-builder` + tree-shaking.       |
| 02  | **SQLite + FTS5 + sqlite-vec**                                  | DuckDB, Tantivy, Meilisearch | Zero-deps, embedded, FTS5 nativo, `sqlite-vec` adiciona busca vetorial em <2MB. Backup = copiar 1 arquivo.                    |
| 03  | **Indexação em background via Worker Thread**                   | Child Process, BullMQ        | Worker Thread compartilha memória eficientemente, mais simples que IPC entre processos, sem dependência externa.              |
| 04  | **Embeddings locais (Transformers.js + nomic-embed-text-v1.5)** | OpenAI API, Ollama           | Privacidade absoluta, zero custo runtime, roda em CPU. Modelo ~140MB, dimensão 768. Ollama vira opcional para usuários power. |
| 05  | **Adapter pattern para fontes**                                 | Hardcoded parsers            | Cada fonte (Claude/Codex/Cursor) é um plugin via `SessionSource` interface. Princípio Open/Closed.                            |
| 06  | **tRPC para IPC**                                               | IPC raw, Comlink             | Tipagem end-to-end entre main↔renderer, validação Zod automática.                                                             |
| 07  | **Zero telemetria**                                             | Opt-in analytics             | Projeto comunitário precisa de confiança total. Métricas vêm de downloads do GitHub Releases e Homebrew, suficientes.         |
| 08  | **Sem auto-update no MVP**                                      | Sparkle/electron-updater     | Distribuir via Homebrew Cask + DMG no GitHub Releases. Auto-update entra na v0.3 via electron-updater.                        |
| 09  | **Licença Apache 2.0**                                          | MIT, GPL                     | Proteção contra patent trolling, compatível com uso comercial, padrão de projetos sérios de dev tools.                        |

---

## 4. Stack Tecnológica

### Runtime & Build

- **Electron 32+** (Chromium 128, Node 20)
- **TypeScript 5.5+** (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Vite** (renderer) + **electron-vite** (main bundle)
- **electron-builder** (DMG, ZIP, .pkg notarized)
- **pnpm** workspaces (monorepo)

### Frontend

- **React 19** + **TanStack Query** (cache de queries)
- **Tailwind CSS 4** + **shadcn/ui** (componentes acessíveis)
- **cmdk** (Command Menu — base do launcher tipo Raycast)
- **fuse.js** apenas para fallback de fuzzy match em UI (não busca primária)

### Backend (main process)

- **better-sqlite3** (síncrono, ~3x mais rápido que `sqlite3` em queries pequenas)
- **sqlite-vec** (extensão nativa, vector search)
- **chokidar** (watcher robusto sobre FSEvents)
- **@huggingface/transformers** (Transformers.js v3, ONNX runtime)
- **zod** (validação de schemas)
- **pino** (logging estruturado)

### Comunicação

- **tRPC v11** com adaptador Electron customizado
- **superjson** (serialização rica: Date, Map, etc)

### Testes

- **Vitest** (unit + integration)
- **Playwright** (E2E renderer + main via `_electron`)
- **Testcontainers-node** (fixtures de SQLite com dados sintéticos)

---

## 5. Arquitetura de Alto Nível

```
┌──────────────────────────────────────────────────────────────────┐
│                       Renderer (React)                           │
│   ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│   │ Launcher UI  │  │  Preview Pane  │  │ Settings / Sources │   │
│   └──────┬───────┘  └────────┬───────┘  └─────────┬──────────┘   │
│          └──────────── tRPC client ────────────────┘             │
└──────────────────────────────│───────────────────────────────────┘
                               │ IPC (contextBridge + ipcRenderer)
┌──────────────────────────────▼───────────────────────────────────┐
│                       Main Process (Node)                        │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │                    tRPC Router                            │  │
│   └─────────┬──────────────────────┬────────────────┬─────────┘  │
│             │                      │                │            │
│   ┌─────────▼──────────┐ ┌─────────▼───────┐ ┌──────▼────────┐   │
│   │  SearchService     │ │  SessionService │ │ ResumeService │   │
│   └─────────┬──────────┘ └─────────┬───────┘ └──────┬────────┘   │
│             │                      │                │            │
│   ┌─────────▼──────────────────────▼────────────────▼────────┐   │
│   │              Persistence (SQLiteRepository)               │  │
│   │       sessions │ turns │ files_touched │ vec_turns        │  │
│   └────────────────────────────┬─────────────────────────────┘   │
└────────────────────────────────│─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│              Indexer Worker (Worker Thread)                      │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │  Watcher     │→ │  Source        │→ │  Chunker → Embedder  │  │
│  │ (chokidar)   │  │  Adapters      │  │  → Repository writer │  │
│  └──────────────┘  └────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
              ┌─────────────────────────────────────┐
              │            File System              │
              │  ~/.claude/projects/**/*.jsonl      │
              │  ~/.codex/sessions/**/*.jsonl       │
              │  ~/Library/Application Support/     │
              │  Cursor/User/workspaceStorage/**    │
              └─────────────────────────────────────┘
```

---

## 6. Estrutura de Pastas

```
codex-spotlight/
├── apps/
│   ├── main/                 # Electron main process
│   │   ├── src/
│   │   │   ├── bootstrap.ts          # entrypoint
│   │   │   ├── tray.ts               # menu bar
│   │   │   ├── shortcuts.ts          # global hotkey
│   │   │   ├── ipc/
│   │   │   │   ├── router.ts         # tRPC router root
│   │   │   │   └── procedures/
│   │   │   │       ├── search.ts
│   │   │   │       ├── session.ts
│   │   │   │       └── settings.ts
│   │   │   ├── services/
│   │   │   │   ├── SearchService.ts
│   │   │   │   ├── SessionService.ts
│   │   │   │   └── ResumeService.ts
│   │   │   └── persistence/
│   │   │       ├── SQLiteRepository.ts
│   │   │       ├── migrations/
│   │   │       └── schema.sql
│   │   └── package.json
│   ├── indexer/              # Worker thread (separado p/ tree-shake)
│   │   ├── src/
│   │   │   ├── worker.ts
│   │   │   ├── Watcher.ts
│   │   │   ├── Pipeline.ts
│   │   │   ├── sources/
│   │   │   │   ├── SessionSource.ts        # interface
│   │   │   │   ├── ClaudeCodeSource.ts
│   │   │   │   ├── CodexCliSource.ts
│   │   │   │   └── CursorSource.ts
│   │   │   ├── chunking/
│   │   │   │   └── TurnChunker.ts
│   │   │   └── embedding/
│   │   │       └── LocalEmbedder.ts
│   │   └── package.json
│   └── renderer/             # React app
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Launcher.tsx
│       │   │   ├── ResultList.tsx
│       │   │   ├── PreviewPane.tsx
│       │   │   └── FilterBar.tsx
│       │   ├── hooks/
│       │   │   ├── useSearch.ts
│       │   │   └── useShortcuts.ts
│       │   └── lib/
│       │       └── trpc.ts
│       └── package.json
├── packages/
│   ├── domain/               # Tipos compartilhados (pure TS)
│   │   └── src/
│   │       ├── Session.ts
│   │       ├── Turn.ts
│   │       └── SearchQuery.ts
│   ├── contracts/            # tRPC schemas + Zod
│   │   └── src/
│   │       └── index.ts
│   └── test-fixtures/        # JSONL e .vscdb sintéticos
│       └── src/
└── package.json
```

**Por que monorepo:** os pacotes `domain` e `contracts` precisam ser consumidos por main, renderer e indexer. Sem monorepo vira inferno de paths relativos.

---

## 7. Modelagem de Domínio

Tipos puros, sem dependência de framework. Ficam em `packages/domain`.

```typescript
// packages/domain/src/Session.ts

export type Tool = 'claude-code' | 'codex-cli' | 'cursor';

export interface Session {
  readonly id: SessionId; // hash estável: sha256(tool + sourceId)
  readonly tool: Tool;
  readonly sourceId: string; // uuid original do tool
  readonly projectPath: string | null; // cwd do projeto, null se não detectado
  readonly projectName: string | null; // basename do path
  readonly gitBranch: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly turnCount: number;
  readonly model: string | null;
  readonly tokenUsage: TokenUsage;
  readonly filePath: string; // path absoluto do arquivo fonte
}

export interface Turn {
  readonly id: TurnId;
  readonly sessionId: SessionId;
  readonly index: number; // ordem dentro da sessão (0-based)
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly contentText: string; // texto extraído, sem JSON wrapping
  readonly toolCalls: ReadonlyArray<ToolCall>;
  readonly filesTouched: ReadonlyArray<string>;
  readonly timestamp: Date;
}

export interface ToolCall {
  readonly name: string; // 'Edit', 'Read', 'Bash', etc
  readonly input: Record<string, unknown>;
  readonly result: string | null;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
}

// Branded types — evitam misturar IDs por engano
export type SessionId = string & { readonly __brand: 'SessionId' };
export type TurnId = string & { readonly __brand: 'TurnId' };
```

**Justificativa SOLID:**

- **SRP:** cada tipo modela uma única coisa.
- **Branded types:** segurança em tempo de compilação contra trocar `SessionId` por `TurnId`.
- **`readonly` + `ReadonlyArray`:** imutabilidade por padrão. Mutar = criar nova versão.

---

## 8. Camadas e SOLID

### Arquitetura em camadas (clean-ish, sem dogma)

```
┌────────────────────────────────────────────┐
│  UI (React components)                     │  ← apenas display
├────────────────────────────────────────────┤
│  Application (tRPC procedures + Services)  │  ← orquestração
├────────────────────────────────────────────┤
│  Domain (tipos + lógica pura)              │  ← regras de negócio
├────────────────────────────────────────────┤
│  Infrastructure (SQLite, FS, Adapters)     │  ← detalhes externos
└────────────────────────────────────────────┘
```

A dependência aponta sempre para dentro (UI → Application → Domain ← Infra).

### Princípios aplicados — exemplos concretos

**SRP (Single Responsibility):**

- `Watcher` apenas observa FS e emite eventos.
- `Chunker` apenas divide turnos em chunks indexáveis.
- `Embedder` apenas gera vetores.
- `Repository` apenas persiste.
- `Pipeline` orquestra os anteriores.

**OCP (Open/Closed):**

```typescript
// Adicionar suporte a Aider = criar nova classe, zero mudança no Pipeline.
export interface SessionSource {
  readonly tool: Tool;
  watchPaths(): string[];
  matches(filePath: string): boolean;
  parse(filePath: string): AsyncIterable<RawSession>;
}
```

**LSP:** todos os `SessionSource` são substituíveis sem o Pipeline saber qual é qual.

**ISP (Interface Segregation):**

```typescript
// Não forçar repository monolítico
export interface SessionReader {
  findById(id: SessionId): Promise<Session | null>;
  list(filter: SessionFilter): Promise<Session[]>;
}

export interface SessionWriter {
  upsert(session: Session, turns: Turn[]): Promise<void>;
}

export interface SearchableRepository {
  search(query: SearchQuery): Promise<SearchResult[]>;
}

// SQLiteRepository implementa as três, mas consumidores dependem só do que precisam.
```

**DIP (Dependency Inversion):**

- `SearchService` recebe `SearchableRepository` no construtor (não instancia).
- Em testes, injeta um in-memory mock.

```typescript
// apps/main/src/services/SearchService.ts
export class SearchService {
  constructor(
    private readonly repo: SearchableRepository,
    private readonly embedder: Embedder,
    private readonly logger: Logger,
  ) {}

  async search(query: string, opts: SearchOptions): Promise<SearchResult[]> {
    const startedAt = performance.now();
    const queryVector = opts.semantic ? await this.embedder.embed(query) : null;

    const results = await this.repo.search({
      text: query,
      vector: queryVector,
      filters: opts.filters,
      limit: opts.limit ?? 30,
    });

    this.logger.debug({ ms: performance.now() - startedAt, count: results.length }, 'search.done');
    return results;
  }
}
```

---

## 9. Adapters por Fonte

### 9.1 Claude Code Source

**Formato real (confirmado via pesquisa):**

- Path: `~/.claude/projects/<url-encoded-cwd>/<session-uuid>.jsonl`
- Cada linha é um evento JSON com campos: `type`, `uuid`, `parentUuid`, `timestamp`, `sessionId`, `cwd`, `gitBranch`, `version`.
- `message.content` contém blocos: `text`, `thinking`, `tool_use` (com `id`, `name`, `input`), `tool_result` (com `tool_use_id`).
- `message.usage` traz `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.
- Append-only — novos eventos = novas linhas.
- Primeiro registro contém o system prompt completo.

```typescript
// apps/indexer/src/sources/ClaudeCodeSource.ts
export class ClaudeCodeSource implements SessionSource {
  readonly tool: Tool = 'claude-code';

  watchPaths(): string[] {
    return [path.join(os.homedir(), '.claude', 'projects')];
  }

  matches(filePath: string): boolean {
    return filePath.includes('/.claude/projects/') && filePath.endsWith('.jsonl');
  }

  async *parse(filePath: string): AsyncIterable<RawSession> {
    const lineStream = readJsonLines(filePath);
    const accumulator = new ClaudeSessionAccumulator(filePath);
    for await (const line of lineStream) {
      accumulator.consume(line);
    }
    yield accumulator.finalize();
  }
}
```

**Decisão importante:** decodificar o `cwd` real da pasta — Claude Code faz URL-encode (`/Users/marcelo/repo/foo` vira `-Users-marcelo-repo-foo`). Reconstruir com regex + sanity check contra `cwd` dentro do JSONL.

### 9.2 Codex CLI Source

**Formato real:**

- Path: `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl`
- Cada linha = evento (prompt, response, tool call, tool result).
- Sem URL-encoded path no diretório (mais simples que Claude).

```typescript
export class CodexCliSource implements SessionSource {
  readonly tool: Tool = 'codex-cli';

  watchPaths(): string[] {
    return [path.join(os.homedir(), '.codex', 'sessions')];
  }

  matches(filePath: string): boolean {
    return /\/\.codex\/sessions\/\d{4}\/\d{2}\/\d{2}\/rollout-.+\.jsonl$/.test(filePath);
  }

  async *parse(filePath: string): AsyncIterable<RawSession> {
    // similar ao Claude, mas o accumulator é diferente — schema próprio
  }
}
```

### 9.3 Cursor Source (mais complexo)

**Formato real:**

- macOS path: `~/Library/Application Support/Cursor/User/workspaceStorage/<hash>/`
- Dois arquivos importantes por workspace:
  - `state.vscdb` — SQLite com tabela `cursorDiskKV` (chave-valor)
  - `workspace.json` — mapeia o hash para o path real do projeto
- Global: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- Schema interno do `cursorDiskKV`:
  - `composerData:<composerId>` → metadata da sessão
  - `bubbleId:<composerId>:<bubbleId>` → mensagem individual

```typescript
export class CursorSource implements SessionSource {
  readonly tool: Tool = 'cursor';

  watchPaths(): string[] {
    return [
      path.join(os.homedir(), 'Library/Application Support/Cursor/User/workspaceStorage'),
      path.join(os.homedir(), 'Library/Application Support/Cursor/User/globalStorage'),
    ];
  }

  matches(filePath: string): boolean {
    return filePath.endsWith('state.vscdb');
  }

  async *parse(filePath: string): AsyncIterable<RawSession> {
    const workspacePath = await this.resolveWorkspacePath(filePath);
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    try {
      const composers = db
        .prepare(
          `
        SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'
      `,
        )
        .all() as Array<{ key: string; value: Buffer }>;

      for (const { key, value } of composers) {
        const composerId = key.replace('composerData:', '');
        const meta = JSON.parse(value.toString('utf8'));
        const bubbles = db
          .prepare(
            `
          SELECT key, value FROM cursorDiskKV WHERE key LIKE ?
        `,
          )
          .all(`bubbleId:${composerId}:%`) as Array<{ key: string; value: Buffer }>;

        yield this.buildRawSession(meta, bubbles, workspacePath);
      }
    } finally {
      db.close();
    }
  }

  private async resolveWorkspacePath(vscdbPath: string): Promise<string | null> {
    const workspaceJson = path.join(path.dirname(vscdbPath), 'workspace.json');
    try {
      const content = await fs.readFile(workspaceJson, 'utf8');
      const parsed = JSON.parse(content) as { folder?: string };
      return parsed.folder?.replace(/^file:\/\//, '') ?? null;
    } catch {
      return null;
    }
  }
}
```

**Pegadinha do Cursor:** o `state.vscdb` está sob lock quando Cursor está aberto. Solução: abrir em modo `readonly` e tentar `WAL` mode; se falhar, copiar para `/tmp` e ler de lá.

---

## 10. Schema SQLite

```sql
-- packages/main/src/persistence/migrations/001_initial.sql

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,             -- SessionId (branded)
  tool              TEXT NOT NULL CHECK (tool IN ('claude-code','codex-cli','cursor')),
  source_id         TEXT NOT NULL,
  project_path      TEXT,
  project_name      TEXT,
  git_branch        TEXT,
  started_at        INTEGER NOT NULL,             -- epoch ms
  last_activity_at  INTEGER NOT NULL,
  turn_count        INTEGER NOT NULL,
  model             TEXT,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_read        INTEGER NOT NULL DEFAULT 0,
  cache_creation    INTEGER NOT NULL DEFAULT 0,
  file_path         TEXT NOT NULL,
  file_mtime        INTEGER NOT NULL,             -- p/ detectar staleness
  indexed_at        INTEGER NOT NULL,
  UNIQUE (tool, source_id)
);

CREATE INDEX idx_sessions_project ON sessions(project_path);
CREATE INDEX idx_sessions_activity ON sessions(last_activity_at DESC);
CREATE INDEX idx_sessions_tool ON sessions(tool);

CREATE TABLE turns (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index    INTEGER NOT NULL,
  role          TEXT NOT NULL,
  content_text  TEXT NOT NULL,
  tool_calls    TEXT,                             -- JSON
  timestamp     INTEGER NOT NULL,
  UNIQUE (session_id, turn_index)
);

CREATE INDEX idx_turns_session ON turns(session_id, turn_index);

CREATE TABLE files_touched (
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_id     TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('read','write','edit')),
  PRIMARY KEY (turn_id, file_path)
);

CREATE INDEX idx_files_path ON files_touched(file_path);

-- FTS5 para busca por keyword
CREATE VIRTUAL TABLE turns_fts USING fts5(
  content_text,
  content='turns',
  content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 2'
);

-- Triggers para manter FTS sincronizado
CREATE TRIGGER turns_ai AFTER INSERT ON turns BEGIN
  INSERT INTO turns_fts(rowid, content_text) VALUES (new.rowid, new.content_text);
END;
CREATE TRIGGER turns_ad AFTER DELETE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content_text) VALUES('delete', old.rowid, old.content_text);
END;
CREATE TRIGGER turns_au AFTER UPDATE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content_text) VALUES('delete', old.rowid, old.content_text);
  INSERT INTO turns_fts(rowid, content_text) VALUES (new.rowid, new.content_text);
END;

-- sqlite-vec para busca semântica (carregado via extension)
-- Apenas se feature 'semantic_search' estiver habilitada
CREATE VIRTUAL TABLE vec_turns USING vec0(
  turn_id TEXT PRIMARY KEY,
  embedding FLOAT[768]
);
```

**Query híbrida (keyword + semantic) com Reciprocal Rank Fusion:**

```sql
WITH
  fts_results AS (
    SELECT t.id AS turn_id, t.session_id, t.content_text,
           rank AS fts_rank
    FROM turns_fts
    JOIN turns t ON t.rowid = turns_fts.rowid
    WHERE turns_fts MATCH :query_fts
    ORDER BY fts_rank LIMIT 50
  ),
  vec_results AS (
    SELECT turn_id, distance AS vec_dist
    FROM vec_turns
    WHERE embedding MATCH :query_vec AND k = 50
  ),
  fused AS (
    SELECT
      COALESCE(f.turn_id, v.turn_id) AS turn_id,
      (1.0 / (60 + COALESCE(f.fts_rank, 1000)))
      + (1.0 / (60 + COALESCE(v.vec_dist * 100, 1000))) AS score
    FROM fts_results f
    FULL OUTER JOIN vec_results v ON f.turn_id = v.turn_id
  )
SELECT t.*, s.project_name, s.tool, s.last_activity_at, fused.score
FROM fused
JOIN turns t ON t.id = fused.turn_id
JOIN sessions s ON s.id = t.session_id
ORDER BY fused.score DESC
LIMIT 30;
```

---

## 11. Indexação

### Fluxo

```
FSEvents → Watcher → Pipeline:
  1. Detectar fonte (matches?)
  2. Verificar mtime vs sessions.file_mtime → skip se igual
  3. Parsear arquivo via SessionSource.parse()
  4. Para cada RawSession:
     a. Normalizar → Session + Turn[]
     b. Extrair filesTouched de tool_use blocks
     c. Chunkear turnos longos (>800 tokens)
     d. Embedder.embedBatch(chunks)  ← async, batch de 32
     e. Repository.upsert() em transaction única
  5. Emitir evento 'session.indexed' para renderer
```

### Garantias

- **Idempotência:** upsert via `INSERT OR REPLACE` com PK estável.
- **Throughput:** worker thread separado, indexação inicial de 5.000 sessões em <2 min num M2 (estimativa).
- **Backpressure:** queue interna com max 100 sessões in-flight para evitar OOM.
- **Crash recovery:** índice é reconstruível 100% do FS; perda do `.db` = reindexar tudo.

### Embeddings

- **Modelo:** `nomic-embed-text-v1.5` (768d, quantizado q8) via Transformers.js.
- **Por que esse:** SOTA para text retrieval em modelo pequeno (137MB), licença Apache 2.0, roda CPU em ~50ms/chunk em M2.
- **Chunking:** por turno, com janela deslizante de 800 tokens (sobreposição 100) para turnos longos.
- **Quando rodar:** opcional no MVP (toggle "Enable Semantic Search" em Settings). Default ON.

---

## 12. Busca

### Modos

1. **Quick (FTS5 apenas)** — <50ms, default ao digitar.
2. **Smart (Híbrida com RRF)** — disparada após 300ms de pausa, ou Tab.
3. **Filtros estruturais:** `tool:claude`, `project:auth-service`, `branch:feature/x`, `>2026-05-01`.

### Parser de query

```typescript
// Suporte a operadores estilo GitHub Issues
const query = parseQuery('tool:claude webhook >2026-05-01');
// → { tools: ['claude-code'], text: 'webhook', after: Date(...) }
```

### Ranking

RRF (Reciprocal Rank Fusion) com k=60 — robusto sem precisar tunar pesos.
Boost adicional por recência: `score * exp(-decayRate * days_since_activity)`.

---

## 13. UI/UX

### Launcher (cmdk)

```
┌───────────────────────────────────────────────────────────┐
│ 🔍  webhook retry logic                              [ESC]│
├───────────────────────────────────────────────────────────┤
│ ▸ payment-service · refactor webhook retry  · claude   2d │
│   added exponential backoff with jitter…                 │
├───────────────────────────────────────────────────────────┤
│   billing-api · debug duplicate webhooks    · codex    5d │
│   tracked down race condition in PaymentEvent…           │
├───────────────────────────────────────────────────────────┤
│   payment-service · webhook signature       · cursor   2w │
│   migrate from HMAC-SHA1 to SHA256…                       │
└───────────────────────────────────────────────────────────┘
 ↑↓ navigate   ↵ resume   ⌘P preview   ⌘C copy path
```

### Preview Pane

- Renderiza conversa em markdown estilo Claude Code (user / assistant blocks).
- Syntax highlight para code blocks (`shiki`).
- Sidebar: arquivos tocados, branch, modelo, tokens consumidos.

### Atalhos globais

- `⌘+Shift+Space` → toggle launcher (configurável).
- `⌘+,` → settings.
- `⌘+R` → reindex tudo.
- `Esc` → fechar.

---

## 14. IPC e Contratos

```typescript
// packages/contracts/src/index.ts
import { z } from 'zod';

export const SearchInput = z.object({
  text: z.string().min(1),
  mode: z.enum(['quick', 'smart']).default('quick'),
  filters: z
    .object({
      tools: z.array(z.enum(['claude-code', 'codex-cli', 'cursor'])).optional(),
      projectPath: z.string().optional(),
      after: z.date().optional(),
      before: z.date().optional(),
    })
    .optional(),
  limit: z.number().int().positive().max(100).default(30),
});

export type SearchInput = z.infer<typeof SearchInput>;

export const SearchResult = z.object({
  sessionId: z.string(),
  turnId: z.string(),
  snippet: z.string(),
  projectName: z.string().nullable(),
  tool: z.enum(['claude-code', 'codex-cli', 'cursor']),
  lastActivityAt: z.date(),
  score: z.number(),
});
```

```typescript
// apps/main/src/ipc/router.ts
export const appRouter = router({
  search: publicProcedure
    .input(SearchInput)
    .output(z.array(SearchResult))
    .query(({ input, ctx }) => ctx.searchService.search(input)),

  session: router({
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input, ctx }) => ctx.sessionService.findById(input.id)),
    list: publicProcedure
      .input(SessionListInput)
      .query(({ input, ctx }) => ctx.sessionService.list(input)),
  }),

  resume: router({
    buildCommand: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ input, ctx }) => ctx.resumeService.buildCommand(input.sessionId)),
  }),

  reindex: publicProcedure.mutation(({ ctx }) => ctx.indexerService.fullReindex()),
});

export type AppRouter = typeof appRouter;
```

---

## 15. Segurança / Privacidade / Permissões macOS

### Princípios

1. **Zero network calls.** Sem exceção. Não há opt-in, não há telemetria — projeto comunitário não pede confiança, prova.
2. **Read-only nos arquivos fonte** — nunca escrever em `~/.claude`, `~/.codex` ou `workspaceStorage`.
3. **Sem secrets logging** — redact patterns conhecidos (`sk-…`, `ghp_…`, JWTs) antes de indexar.
4. **DB criptografado opcional** — `better-sqlite3-multiple-ciphers` com chave do Keychain. Toggle em Settings.

### Permissões necessárias no macOS

- **Full Disk Access** ou **App Management** — para ler `~/Library/Application Support/Cursor/...` (Apple bloqueia desde Ventura).
- **Acessibilidade** (opcional) — só se for implementar focus-stealing prevention.
- **Notifications** (opcional) — para feedback de indexação concluída.

### Onboarding de permissões

Tela dedicada com:

- Botão "Open System Settings" via `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles`
- Vídeo curto (5s) mostrando como ativar.
- Verificação periódica via `app.getPath()` test reads.

### Redaction de secrets (exemplo)

```typescript
const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /sk-[A-Za-z0-9]{32,}/g, // OpenAI / Anthropic keys
  /ghp_[A-Za-z0-9]{36}/g, // GitHub personal tokens
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/g, // JWT
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g,
];

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), text);
}
```

---

## 16. Performance Targets

| Métrica                               | Alvo MVP   | Alvo v1.0  |
| ------------------------------------- | ---------- | ---------- |
| Tempo de boot até launcher pronto     | <800ms     | <400ms     |
| Query FTS (5k sessões, 50k turnos)    | <50ms p95  | <30ms p95  |
| Query híbrida (mesmo dataset)         | <250ms p95 | <150ms p95 |
| Indexação inicial (5k sessões, M2)    | <120s      | <60s       |
| Indexação incremental (1 sessão nova) | <300ms     | <100ms     |
| RAM idle                              | <250MB     | <150MB     |
| RAM durante reindex                   | <800MB     | <500MB     |
| Bundle DMG                            | <180MB     | <120MB     |

Medir via Vitest benchmarks com fixture sintético em `packages/test-fixtures`.

---

## 17. Estratégia de Testes

### Pirâmide

- **70% Unit** — Domain types, parsers de cada source, query parser, ranking algorithm. Mock de Repository via in-memory.
- **25% Integration** — SQLite real (tmp dir), source parser → repository → search end-to-end.
- **5% E2E** — Playwright lançando Electron, simulando ⌘+Shift+Space + digitação.

### Fixtures críticas

- `packages/test-fixtures/claude/` — 20 JSONL reais anonimizados (com `redactSecrets`).
- `packages/test-fixtures/codex/` — idem.
- `packages/test-fixtures/cursor/` — 3 `state.vscdb` sintéticos (criados via script).
- `packages/test-fixtures/edge-cases/` — arquivos corrompidos, JSONL com linha quebrada, vscdb sob lock.

### Property-based testing

Usar `fast-check` para o parser de query — gerar combinações arbitrárias de operadores e validar invariantes (`parse(serialize(q)) == q`).

---

## 18. Plano de Sprint MVP (2 semanas)

### Semana 1 — Backend & Indexador

| Dia | Entrega                                                                                        | Critério de aceite                                               |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| D1  | Setup monorepo, Electron + Vite + TS bootstrap, ESLint/Prettier, CI básica                     | `pnpm dev` abre janela vazia; `pnpm test` roda Vitest            |
| D2  | `packages/domain` + `packages/contracts`; `SessionSource` interface; testes unit do schema Zod | 100% cobertura em domain; types compilam em strict mode          |
| D3  | `ClaudeCodeSource` completo + testes contra 20 fixtures reais                                  | Parser extrai todas as sessões dos fixtures sem perda            |
| D4  | `CodexCliSource` + testes; `TurnChunker` + testes property-based                               | Idem Codex; chunker preserva ordem e cobre 100% do texto         |
| D5  | `SQLiteRepository` (sem vec ainda), migrations, FTS5; benchmark de indexação                   | Indexar 5k sessões em <120s no M2                                |
| D6  | `Watcher` (chokidar) + `Pipeline` orquestrador; recovery de crash mid-index                    | Matar processo no meio e relançar termina indexação sem duplicar |
| D7  | `CursorSource` (mais chato — SQLite lock handling)                                             | Parsear `state.vscdb` mesmo com Cursor aberto                    |

### Semana 2 — UI, IPC, polish

| Dia | Entrega                                                                        | Critério de aceite                                                             |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| D8  | tRPC router + procedures search/session/resume; injeção de deps                | `pnpm test:integration` cobre fluxo search end-to-end                          |
| D9  | Renderer base: Launcher (cmdk) + ResultList; useSearch hook + TanStack Query   | Digitar busca FTS retorna em <100ms                                            |
| D10 | PreviewPane com markdown renderer + shiki; FilterBar com operadores            | Preview de qualquer sessão renderiza corretamente                              |
| D11 | LocalEmbedder (Transformers.js) + sqlite-vec; query híbrida                    | Busca semântica "webhook retry" encontra sessões sem palavra "webhook" literal |
| D12 | Atalho global (⌘+Shift+Space), menu bar tray, settings page de permissões      | App pode ficar fechada e launcher abre via atalho                              |
| D13 | Onboarding de permissões macOS; redaction de secrets; bug fixes                | Primeiro launch guia até primeiro resultado em <2min                           |
| D14 | DMG build assinado (sem notarize ainda), homepage estática, README, demo video | DMG instala e roda em Mac limpo                                                |

### Definition of Done (DoD)

- TS strict + ESLint sem warnings.
- Cobertura ≥80% nas camadas Domain e Application.
- Benchmarks passando nos alvos da seção 16.
- README com troubleshooting de permissões macOS.
- DMG instalável (mesmo unsigned no MVP) — assinatura/notarização em sprint 3.

---

## 19. Roadmap Pós-MVP

### v0.2 (Sprint 3, ~1 semana)

- Code signing + notarization (Apple Developer ID — custeado por sponsors ou bolso).
- Auto-update via `electron-updater` + GitHub Releases.
- Aider source (`.aider.chat.history.md`) — primeira boa task para contribuidores externos.

### v0.3 — Recursos avançados (todos gratuitos)

- Multi-machine sync via E2E encrypted backup (S3, R2 ou self-hosted — usuário traz storage).
- Analytics local: timeline, time-per-project, modelo mais usado.
- Export markdown limpo para PR/issue.
- Exposição de MCP server (vira fonte de contexto para Claude/Codex!).

### v1.0

- Linux + Windows (mesmo bundle Electron, só ajustar paths).
- Modo time: índice compartilhado read-only por repo (auto-hospedado).
- Plugin API: terceiros adicionam fontes (Windsurf, Cline, etc).

### Governança do projeto

- **Maintainer principal:** você (BDFL inicialmente).
- **Contribuições:** PRs precisam de 1 review + CI verde.
- **Roadmap público** via GitHub Projects, RFCs para mudanças grandes.
- **Code of Conduct:** Contributor Covenant 2.1.
- **Triagem de issues:** labels `good-first-issue`, `help-wanted`, `bug`, `enhancement`.

---

## 20. Riscos e Mitigações

| Risco                                      | Severidade | Mitigação                                                                                                      |
| ------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Anthropic/OpenAI lançam busca nativa       | Alta       | Diferencial é multi-tool unificado + ser OSS auditável. Mesmo se eles lançarem, devs querem ferramenta neutra. |
| Formato JSONL muda silenciosamente         | Média      | Adapter pattern + parser versionado + suite de fixtures grande. Comunidade abre PR rapidamente.                |
| Permissão Full Disk Access assusta usuário | Alta       | Vídeo de onboarding + código aberto (qualquer um pode auditar que não há network calls).                       |
| Cursor mudar pra schema novo               | Média      | Encapsular schema knowledge no source; testes contra cada versão do Cursor.                                    |
| Embedding model muito lento em Intel Macs  | Baixa      | Fallback p/ FTS-only quando CPU < threshold; modelo quantizado q4 como opção.                                  |
| Bundle DMG fica >200MB                     | Média      | Electron fuses, tree-shaking, lazy-load do modelo ONNX (download on first use).                                |
| Manutenção solo desgastar (burnout de OSS) | Alta       | Documentação forte de arquitetura, `good-first-issue` desde o dia 1, co-maintainers cedo.                      |
| Fork hostil que diverge                    | Baixa      | License Apache 2.0 permite, mas comunidade tende a seguir o maintainer original. Comunicação clara.            |

---

## 21. Métricas de Sucesso (comunitárias)

### Lançamento (mês 1)

- 500 GitHub stars.
- 1.000 downloads do DMG nos GitHub Releases.
- 3 menções em newsletters de dev tools (Hacker Newsletter, TLDR, etc).
- 10 issues abertas por usuários reais (sinal de uso, não só de tráfego).

### Mês 3

- 2.000 stars.
- 5.000 downloads.
- 5 contribuidores externos com PR mergeado.
- 1 source plugin contribuído pela comunidade (Aider, Windsurf, etc).
- Aceitação no Homebrew Cask.

### Mês 6

- 5.000 stars.
- 15.000 downloads.
- 10+ contribuidores ativos.
- Apresentação aceita em meetup local de dev tools.
- Citação em "best dev tools of 2026" lists.

Métricas são coletadas a partir de fontes públicas (GitHub API, Homebrew analytics) — zero telemetria embarcada no app.

---

## Apêndice A — Glossário

- **FTS5:** Full-Text Search v5, extensão nativa do SQLite para busca por keyword com BM25.
- **sqlite-vec:** Extensão nova (~2024) que adiciona busca vetorial ao SQLite. Substitui Faiss/HNSW em escalas <1M vetores.
- **RRF:** Reciprocal Rank Fusion. Algoritmo simples para combinar rankings de fontes diferentes sem tunar pesos.
- **JSONL:** JSON Lines. Um JSON por linha, append-friendly, streaming-friendly.
- **WAL mode:** Write-Ahead Logging do SQLite. Permite leituras concorrentes durante escrita.
- **tRPC:** Type-safe RPC sem codegen. Cliente e servidor compartilham tipos via TypeScript inference.

## Apêndice B — Decisões pendentes

1. Nome final do produto. "Codex Spotlight" funciona mas pode confundir com OpenAI Codex. Alternativas: **Stash**, **Recall**, **Replay**, **Trail**, **Lookback**.
2. Hospedar landing onde — Cloudflare Pages (grátis em qualquer escala) > Vercel.
3. GitHub Sponsors vs Open Collective para receber contribuições financeiras opcionais (favorecer GH Sponsors por simplicidade).
4. CLA (Contributor License Agreement) — não usar no início para reduzir fricção; reavaliar se projeto crescer muito.
