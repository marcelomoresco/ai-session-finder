# Sprint 01 — Domain & Persistence

## Objetivo

Definir tipos de domínio puros (sem dependência de framework), schemas Zod compartilhados (`@cs/contracts`), e a camada de persistência SQLite com FTS5. Sem busca semântica ainda — sqlite-vec entra no Sprint 03.

## Pré-requisitos

- Sprint 00 concluído (`pnpm install`, lint, test rodando)

## Tasks

### Task 01.1 — Domain types em `@cs/domain`

**Arquivos:**

- `packages/domain/src/Session.ts`
- `packages/domain/src/Turn.ts`
- `packages/domain/src/SearchQuery.ts`
- `packages/domain/src/Tool.ts`
- `packages/domain/src/index.ts` (re-exports)

**O que fazer:**

```typescript
// packages/domain/src/Tool.ts
export const TOOLS = ['claude-code', 'codex-cli', 'cursor'] as const;
export type Tool = (typeof TOOLS)[number];

export function isTool(value: unknown): value is Tool {
  return typeof value === 'string' && (TOOLS as readonly string[]).includes(value);
}
```

```typescript
// packages/domain/src/Session.ts
export type SessionId = string & { readonly __brand: 'SessionId' };

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
}

export interface Session {
  readonly id: SessionId;
  readonly tool: Tool;
  readonly sourceId: string;
  readonly projectPath: string | null;
  readonly projectName: string | null;
  readonly gitBranch: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly turnCount: number;
  readonly model: string | null;
  readonly tokenUsage: TokenUsage;
  readonly filePath: string;
  readonly fileMtime: number;
  readonly indexedAt: Date;
}

export const SessionId = {
  from(value: string): SessionId {
    if (value.length === 0) throw new Error('SessionId cannot be empty');
    return value as SessionId;
  },
};
```

```typescript
// packages/domain/src/Turn.ts
export type TurnId = string & { readonly __brand: 'TurnId' };

export type TurnRole = 'user' | 'assistant' | 'system' | 'tool';
export type FileOperation = 'read' | 'write' | 'edit';

export interface ToolCall {
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: string | null;
}

export interface FileTouched {
  readonly path: string;
  readonly operation: FileOperation;
}

export interface Turn {
  readonly id: TurnId;
  readonly sessionId: SessionId;
  readonly index: number;
  readonly role: TurnRole;
  readonly contentText: string;
  readonly toolCalls: ReadonlyArray<ToolCall>;
  readonly filesTouched: ReadonlyArray<FileTouched>;
  readonly timestamp: Date;
}

export const TurnId = {
  from(value: string): TurnId {
    if (value.length === 0) throw new Error('TurnId cannot be empty');
    return value as TurnId;
  },
};
```

```typescript
// packages/domain/src/SearchQuery.ts
export interface SearchFilters {
  readonly tools?: ReadonlyArray<Tool>;
  readonly projectPath?: string;
  readonly after?: Date;
  readonly before?: Date;
}

export type SearchMode = 'quick' | 'smart';

export interface SearchQuery {
  readonly text: string;
  readonly mode: SearchMode;
  readonly filters: SearchFilters;
  readonly limit: number;
}

export interface SearchResult {
  readonly sessionId: SessionId;
  readonly turnId: TurnId;
  readonly snippet: string;
  readonly projectName: string | null;
  readonly tool: Tool;
  readonly lastActivityAt: Date;
  readonly score: number;
}
```

**Testes (`packages/domain/src/*.test.ts`):**

- `isTool` retorna true/false corretamente
- `SessionId.from` lança em string vazia
- Tipos são imutáveis (assert via `// @ts-expect-error`)

**Critério de aceite:**

- `pnpm --filter @cs/domain typecheck` passa
- Cobertura ≥95% no pacote

---

### Task 01.2 — Contracts Zod em `@cs/contracts`

**Arquivos:**

- `packages/contracts/src/Session.schema.ts`
- `packages/contracts/src/Turn.schema.ts`
- `packages/contracts/src/Search.schema.ts`
- `packages/contracts/src/index.ts`

**O que fazer:**

```typescript
// packages/contracts/src/Search.schema.ts
import { z } from 'zod';
import { TOOLS } from '@cs/domain';

export const SearchFiltersSchema = z.object({
  tools: z.array(z.enum(TOOLS)).optional(),
  projectPath: z.string().optional(),
  after: z.date().optional(),
  before: z.date().optional(),
});

export const SearchQuerySchema = z.object({
  text: z.string().min(1).max(500),
  mode: z.enum(['quick', 'smart']).default('quick'),
  filters: SearchFiltersSchema.default({}),
  limit: z.number().int().positive().max(100).default(30),
});

export const SearchResultSchema = z.object({
  sessionId: z.string(),
  turnId: z.string(),
  snippet: z.string(),
  projectName: z.string().nullable(),
  tool: z.enum(TOOLS),
  lastActivityAt: z.date(),
  score: z.number(),
});

export type SearchQueryInput = z.input<typeof SearchQuerySchema>;
export type SearchQueryParsed = z.output<typeof SearchQuerySchema>;
```

**Critério de aceite:**

- Schemas inferem para os mesmos tipos de `@cs/domain` (com diferenças mínimas: domain tem branded types, contracts trabalha em strings cruas)
- Testes de roundtrip: `parse(validInput)` retorna valor esperado; `parse(invalidInput)` lança

---

### Task 01.3 — Migrations system simples

**Arquivos:**

- `apps/main/src/persistence/migrations/Migrator.ts`
- `apps/main/src/persistence/migrations/001_initial.sql`
- `apps/main/src/persistence/migrations/index.ts`

**O que fazer:**
Migrator sem dependências externas:

```typescript
// apps/main/src/persistence/migrations/Migrator.ts
import type Database from 'better-sqlite3';

interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export class Migrator {
  constructor(
    private readonly db: Database.Database,
    private readonly migrations: ReadonlyArray<Migration>,
  ) {}

  run(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);

    const applied = new Set(
      this.db
        .prepare('SELECT version FROM schema_migrations')
        .all()
        .map((row: { version: number }) => row.version),
    );

    const pending = this.migrations
      .filter((m) => !applied.has(m.version))
      .sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      const tx = this.db.transaction(() => {
        this.db.exec(migration.sql);
        this.db
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, Date.now());
      });
      tx();
    }
  }
}
```

**Critério de aceite:**

- Roda 2x sem aplicar migrations duplicadas
- Falha numa migration aborta a transação (DB fica consistente)
- Testes com SQLite in-memory cobrem happy + failure paths

---

### Task 01.4 — Schema inicial (`001_initial.sql`)

**Arquivo:** `apps/main/src/persistence/migrations/001_initial.sql`

Copiar exatamente o schema da spec (Seção 10), exceto `vec_turns` (que entra no Sprint 03 como migration 002).

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  tool              TEXT NOT NULL CHECK (tool IN ('claude-code','codex-cli','cursor')),
  source_id         TEXT NOT NULL,
  project_path      TEXT,
  project_name      TEXT,
  git_branch        TEXT,
  started_at        INTEGER NOT NULL,
  last_activity_at  INTEGER NOT NULL,
  turn_count        INTEGER NOT NULL,
  model             TEXT,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_read        INTEGER NOT NULL DEFAULT 0,
  cache_creation    INTEGER NOT NULL DEFAULT 0,
  file_path         TEXT NOT NULL,
  file_mtime        INTEGER NOT NULL,
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
  tool_calls    TEXT,
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

CREATE VIRTUAL TABLE turns_fts USING fts5(
  content_text,
  content='turns',
  content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 2'
);

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
```

**Critério de aceite:**

- Migrator aplica o schema sem erro
- Tabelas e índices existem (`SELECT name FROM sqlite_master`)

---

### Task 01.5 — Interfaces de Repository (ISP)

**Arquivos:**

- `apps/main/src/persistence/SessionReader.ts`
- `apps/main/src/persistence/SessionWriter.ts`
- `apps/main/src/persistence/SearchableRepository.ts`

**O que fazer:**

```typescript
// SessionReader.ts
import type { Session, SessionId, Tool } from '@cs/domain';

export interface SessionListFilter {
  readonly tools?: ReadonlyArray<Tool>;
  readonly projectPath?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SessionReader {
  findById(id: SessionId): Promise<Session | null>;
  findByToolAndSourceId(tool: Tool, sourceId: string): Promise<Session | null>;
  list(filter: SessionListFilter): Promise<ReadonlyArray<Session>>;
  countAll(): Promise<number>;
}
```

```typescript
// SessionWriter.ts
import type { Session, Turn } from '@cs/domain';

export interface SessionWriter {
  upsert(session: Session, turns: ReadonlyArray<Turn>): Promise<void>;
  delete(id: SessionId): Promise<void>;
  pruneOrphans(): Promise<number>;
}
```

```typescript
// SearchableRepository.ts
import type { SearchQuery, SearchResult } from '@cs/domain';

export interface SearchableRepository {
  search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>>;
}
```

**Critério de aceite:**

- Interfaces puras, sem implementação
- Importáveis em outros packages

---

### Task 01.6 — `SQLiteRepository` (implementação)

**Arquivos:**

- `apps/main/src/persistence/SQLiteRepository.ts`
- `apps/main/src/persistence/queries.ts` (SQL como const strings, reusáveis)

**O que fazer:**
Implementar as 3 interfaces num único repositório:

```typescript
export class SQLiteRepository implements SessionReader, SessionWriter, SearchableRepository {
  constructor(private readonly db: Database.Database) {}

  // ---- SessionReader ----
  async findById(id: SessionId): Promise<Session | null> {
    const row = this.db
      .prepare<[string], SessionRow>('SELECT * FROM sessions WHERE id = ?')
      .get(id);
    return row ? this.mapRowToSession(row) : null;
  }

  // ---- SessionWriter ----
  async upsert(session: Session, turns: ReadonlyArray<Turn>): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `
          INSERT INTO sessions (id, tool, source_id, project_path, ...)
          VALUES (@id, @tool, @sourceId, @projectPath, ...)
          ON CONFLICT(id) DO UPDATE SET
            last_activity_at = excluded.last_activity_at,
            turn_count = excluded.turn_count,
            ...
        `,
        )
        .run(this.mapSessionToRow(session));

      this.db.prepare('DELETE FROM turns WHERE session_id = ?').run(session.id);

      const insertTurn = this.db.prepare(`
        INSERT INTO turns (id, session_id, turn_index, role, content_text, tool_calls, timestamp)
        VALUES (@id, @sessionId, @index, @role, @contentText, @toolCalls, @timestamp)
      `);
      const insertFile = this.db.prepare(`
        INSERT INTO files_touched (session_id, turn_id, file_path, operation)
        VALUES (?, ?, ?, ?)
      `);
      for (const turn of turns) {
        insertTurn.run(this.mapTurnToRow(turn));
        for (const file of turn.filesTouched) {
          insertFile.run(session.id, turn.id, file.path, file.operation);
        }
      }
    });
    tx();
  }

  // ---- SearchableRepository ----
  async search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>> {
    const fts = this.toFtsQuery(query.text);
    const rows = this.db
      .prepare(/* FTS5 + filtros */)
      .all({ fts, limit: query.limit, ...this.buildFilters(query.filters) });
    return rows.map(this.mapRowToResult);
  }

  private toFtsQuery(text: string): string {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => `"${token.replace(/"/g, '""')}"`)
      .join(' AND ');
  }
}
```

**Decisões:**

- `tool_calls` armazenado como JSON string (single column, simpler than join table for MVP)
- `pruneOrphans` é placeholder vazio agora; preenchido depois quando indexer detectar arquivos deletados

**Critério de aceite:**

- Testes integration com SQLite in-memory cobrem CRUD completo
- `upsert` é atômico (testar: força erro no meio, DB volta ao estado anterior)
- FTS search retorna resultados ordenados por rank
- Cobertura ≥85%

---

### Task 01.7 — Factory e ciclo de vida do DB

**Arquivo:** `apps/main/src/persistence/createDatabase.ts`

**O que fazer:**

```typescript
import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import { Migrator } from './migrations/Migrator.js';
import { migrations } from './migrations/index.js';

export interface DatabaseHandle {
  readonly db: Database.Database;
  close(): void;
}

export function createDatabase(): DatabaseHandle {
  const dbPath = path.join(app.getPath('userData'), 'codex-spotlight.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrator = new Migrator(db, migrations);
  migrator.run();

  return {
    db,
    close: () => {
      try {
        db.close();
      } catch (err) {
        // already closed
      }
    },
  };
}
```

**Crítica de aceite:**

- App não trava se DB já existe
- DB fica em `~/Library/Application Support/codex-spotlight/codex-spotlight.db`

---

## Testes obrigatórios deste sprint

- `packages/domain` — 95%+ coverage
- `packages/contracts` — todos os schemas com testes happy + invalid
- `apps/main/src/persistence` — 85%+ coverage, incluindo migrations, repository CRUD, FTS

## Definition of Done (Sprint 01)

- [ ] `pnpm typecheck` passa em todos os pacotes
- [ ] `pnpm test --coverage` reporta ≥80% no código novo
- [ ] Schema SQLite documentado em `docs/architecture.md`
- [ ] Exemplo de uso do repository em `docs/persistence.md` (10-20 linhas)
- [ ] Commits separados por task ou tema lógico

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 01 do projeto Codex Spotlight.

Leia .claude/sprints/sprint-01-domain-persistence.md e execute as 7 tasks em ordem.

Regras:
1. TDD obrigatório: escreva teste antes da implementação em Tasks 01.1, 01.2, 01.3, 01.5, 01.6
2. Use better-sqlite3 (síncrono), não sqlite3
3. SQL queries devem ser const strings em `queries.ts`, não inline
4. Branded types do domain NÃO devem vazar para fora da camada de domain — converter em boundaries
5. Pare e me consulte se algum schema precisar mudar vs o documento
6. Commit por task com mensagem Conventional Commits

Comece pela Task 01.1.
```
