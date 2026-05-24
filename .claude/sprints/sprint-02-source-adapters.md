# Sprint 02 — Source Adapters

## Objetivo

Implementar 3 adapters de leitura de sessões (Claude Code, Codex CLI, Cursor) atrás de uma interface comum. Cada adapter sabe onde estão os arquivos, como parsear e como gerar `RawSession` (ainda não normalizado para `Session` do domain — isso fica para o Pipeline no Sprint 03).

## Pré-requisitos

- Sprint 00 concluído (monorepo, tooling)
- Sprint 01 concluído (`@cs/domain` com tipos)

## Tasks

### Task 02.1 — Interface `SessionSource`

**Arquivos:**

- `apps/indexer/package.json`
- `apps/indexer/tsconfig.json`
- `apps/indexer/src/sources/SessionSource.ts`
- `apps/indexer/src/sources/RawSession.ts`

**O que fazer:**

`RawSession` é o tipo intermediário — antes da normalização para `Session`. Mantém dados crus do arquivo fonte, sem `SessionId` (gerado pelo Pipeline a partir de `tool + sourceId`):

```typescript
// apps/indexer/src/sources/RawSession.ts
import type { TokenUsage, Tool, TurnRole, FileOperation } from '@cs/domain';

export interface RawTurn {
  readonly index: number;
  readonly role: TurnRole;
  readonly contentText: string;
  readonly toolCalls: ReadonlyArray<{
    readonly name: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly result: string | null;
  }>;
  readonly filesTouched: ReadonlyArray<{
    readonly path: string;
    readonly operation: FileOperation;
  }>;
  readonly timestamp: Date;
}

export interface RawSession {
  readonly tool: Tool;
  readonly sourceId: string;
  readonly projectPath: string | null;
  readonly projectName: string | null;
  readonly gitBranch: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly model: string | null;
  readonly tokenUsage: TokenUsage;
  readonly filePath: string;
  readonly fileMtime: number;
  readonly turns: ReadonlyArray<RawTurn>;
}
```

```typescript
// apps/indexer/src/sources/SessionSource.ts
import type { Tool } from '@cs/domain';
import type { RawSession } from './RawSession.js';

export interface SessionSource {
  readonly tool: Tool;

  /**
   * Diretórios raiz para vigiar com chokidar.
   * Pode incluir paths que não existem ainda.
   */
  watchPaths(): ReadonlyArray<string>;

  /**
   * Decide se este source consegue parsear o arquivo.
   * Deve ser rápido (regex/extensão), sem I/O.
   */
  matches(filePath: string): boolean;

  /**
   * Parseia o arquivo e produz 0 ou mais RawSessions.
   * Async iterable porque Cursor pode emitir várias sessões por arquivo.
   */
  parse(filePath: string): AsyncIterable<RawSession>;
}
```

**Critério de aceite:**

- Tipos compilam
- Mock simples implementa a interface em <20 linhas

---

### Task 02.2 — Utilitário `readJsonLines`

**Arquivo:** `apps/indexer/src/util/readJsonLines.ts`

**O que fazer:**
Reader streaming de JSONL que tolera linhas vazias e quebradas:

```typescript
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface JsonLineError {
  readonly line: number;
  readonly raw: string;
  readonly error: Error;
}

export async function* readJsonLines<T>(
  filePath: string,
  onError?: (err: JsonLineError) => void,
): AsyncGenerator<T> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  for await (const raw of rl) {
    lineNumber += 1;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    try {
      yield JSON.parse(trimmed) as T;
    } catch (err) {
      onError?.({ line: lineNumber, raw, error: err as Error });
    }
  }
}
```

**Testes:**

- Arquivo válido com N linhas → N yields
- Arquivo com linha vazia → ignora
- Arquivo com linha quebrada → chama `onError` mas continua
- Arquivo inexistente → throw

**Critério de aceite:**

- Streaming real (não carrega arquivo inteiro em memória)
- Cobertura 100%

---

### Task 02.3 — `ClaudeCodeSource`

**Arquivos:**

- `apps/indexer/src/sources/claude/ClaudeCodeSource.ts`
- `apps/indexer/src/sources/claude/ClaudeJsonlEvent.ts` (tipos do JSONL)
- `apps/indexer/src/sources/claude/ClaudeSessionAccumulator.ts`
- `apps/indexer/src/sources/claude/decodeCwdFromDir.ts`
- `packages/test-fixtures/src/claude/` (10+ JSONL anonimizados)

**Conhecimento confirmado do formato (vide spec, Seção 9.1):**

- Path: `~/.claude/projects/<url-encoded-cwd>/<session-uuid>.jsonl`
- Cada linha = JSON com `type`, `uuid`, `parentUuid`, `timestamp`, `sessionId`, `cwd`, `gitBranch`, `version`
- `message.content` tem blocos: `text`, `thinking`, `tool_use` (com `id`, `name`, `input`), `tool_result`
- `message.usage` tem `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`
- Append-only
- Primeira linha geralmente tem system prompt

**O que fazer — `decodeCwdFromDir`:**
Claude Code substitui `/` por `-` no nome da pasta. Reconstruir é ambíguo (não dá pra distinguir `-` original de separador), então preferir extrair `cwd` do primeiro evento do JSONL e usar nome da pasta só como fallback:

```typescript
export function decodeCwdFromDir(dirName: string): string {
  // Fallback heurístico: '-Users-marcelo-foo' → '/Users/marcelo/foo'
  return '/' + dirName.replace(/^-/, '').replaceAll('-', '/');
}
```

**O que fazer — `ClaudeSessionAccumulator`:**
Consome eventos linha a linha e acumula uma `RawSession`:

```typescript
export class ClaudeSessionAccumulator {
  private sessionId: string | null = null;
  private cwd: string | null = null;
  private gitBranch: string | null = null;
  private startedAt: Date | null = null;
  private lastActivityAt: Date | null = null;
  private model: string | null = null;
  private tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  private readonly turns: RawTurn[] = [];

  constructor(
    private readonly filePath: string,
    private readonly fileMtime: number,
  ) {}

  consume(event: ClaudeJsonlEvent): void {
    if (event.sessionId && !this.sessionId) this.sessionId = event.sessionId;
    if (event.cwd && !this.cwd) this.cwd = event.cwd;
    if (event.gitBranch && !this.gitBranch) this.gitBranch = event.gitBranch;

    const ts = new Date(event.timestamp);
    if (!this.startedAt || ts < this.startedAt) this.startedAt = ts;
    if (!this.lastActivityAt || ts > this.lastActivityAt) this.lastActivityAt = ts;

    if (event.message) {
      this.consumeMessage(event.message, ts);
    }
  }

  finalize(): RawSession {
    if (!this.sessionId) throw new Error('No sessionId found in file');
    return {
      tool: 'claude-code',
      sourceId: this.sessionId,
      projectPath: this.cwd,
      projectName: this.cwd ? path.basename(this.cwd) : null,
      gitBranch: this.gitBranch,
      startedAt: this.startedAt ?? new Date(0),
      lastActivityAt: this.lastActivityAt ?? new Date(0),
      model: this.model,
      tokenUsage: {
        inputTokens: this.tokens.input,
        outputTokens: this.tokens.output,
        cacheReadTokens: this.tokens.cacheRead,
        cacheCreationTokens: this.tokens.cacheCreation,
      },
      filePath: this.filePath,
      fileMtime: this.fileMtime,
      turns: this.turns,
    };
  }

  private consumeMessage(message: ClaudeMessage, ts: Date): void {
    // extrai role, blocos text/thinking/tool_use/tool_result
    // calcula filesTouched a partir de tool_use.input.file_path
    // soma tokens
    // ...
  }
}
```

**Extração de `filesTouched`:**
Tools relevantes do Claude Code:

- `Read` → `operation: 'read'`, path em `input.file_path`
- `Write` → `operation: 'write'`, path em `input.file_path`
- `Edit` / `MultiEdit` → `operation: 'edit'`, path em `input.file_path`
- `NotebookEdit` → `operation: 'edit'`, path em `input.notebook_path`

**Testes:**

- 10+ fixtures reais anonimizados em `packages/test-fixtures/src/claude/`
- Para cada fixture: validar `sourceId`, `projectPath`, `turnCount`, `tokenUsage`
- Tolerância a JSONL parcialmente corrompido (linha quebrada não derruba parse)
- Tolerância a campos ausentes (versões antigas)

**Critério de aceite:**

- `matches('/Users/x/.claude/projects/-foo/abc.jsonl')` → true
- `matches('/Users/x/.codex/sessions/2026/05/22/rollout-x.jsonl')` → false
- Parse de fixture real produz `RawSession` com todos os campos preenchidos
- Cobertura ≥85%

---

### Task 02.4 — `CodexCliSource`

**Arquivos:**

- `apps/indexer/src/sources/codex/CodexCliSource.ts`
- `apps/indexer/src/sources/codex/CodexJsonlEvent.ts`
- `apps/indexer/src/sources/codex/CodexSessionAccumulator.ts`
- `packages/test-fixtures/src/codex/` (10+ rollouts anonimizados)

**Formato confirmado:**

- Path: `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl`
- JSONL com prompt, response, tool calls, tool results
- Path tem timestamp + UUID embutido (extrair sourceId do filename)

**O que fazer:**
Estrutura espelhada ao Claude, mas com formato próprio. Re-aproveitar `readJsonLines`.

`matches`:

```typescript
matches(filePath: string): boolean {
  return /\/\.codex\/sessions\/\d{4}\/\d{2}\/\d{2}\/rollout-.+\.jsonl$/.test(filePath);
}
```

Para `sourceId`, extrair do filename:

```typescript
function extractSourceId(filePath: string): string {
  const basename = path.basename(filePath, '.jsonl');
  // 'rollout-2026-05-22T14-30-00-abc123' → 'abc123' ou full basename como fallback
  const match = basename.match(/rollout-.+-([a-z0-9]+)$/);
  return match?.[1] ?? basename;
}
```

**Testes:**

- 10 fixtures anonimizadas
- Mesma cobertura do Claude

**Critério de aceite:**

- Idem Claude
- `matches` distingue corretamente de Claude e Cursor

---

### Task 02.5 — `CursorSource` (complexo)

**Arquivos:**

- `apps/indexer/src/sources/cursor/CursorSource.ts`
- `apps/indexer/src/sources/cursor/CursorVscdbReader.ts` (encapsula SQLite leitura)
- `apps/indexer/src/sources/cursor/CursorBubble.ts` (tipos do payload)
- `packages/test-fixtures/src/cursor/createFixture.ts` (script p/ gerar .vscdb sintético)
- `packages/test-fixtures/src/cursor/fixtures/` (3 .vscdb gerados)

**Formato confirmado (vide spec, Seção 9.3):**

- macOS path: `~/Library/Application Support/Cursor/User/workspaceStorage/<hash>/state.vscdb` (SQLite)
- Tabela `cursorDiskKV` com chave-valor
- Chaves importantes:
  - `composerData:<composerId>` → metadata da sessão (JSON)
  - `bubbleId:<composerId>:<bubbleId>` → mensagem individual (JSON)
- `workspace.json` na mesma pasta mapeia hash → path real do projeto

**O que fazer — `CursorVscdbReader`:**

```typescript
export class CursorVscdbReader {
  constructor(private readonly filePath: string) {}

  async *readSessions(): AsyncGenerator<{
    composerId: string;
    meta: CursorComposerMeta;
    bubbles: ReadonlyArray<CursorBubble>;
  }> {
    const db = this.openSafely();
    try {
      const composers = db
        .prepare(`SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'`)
        .all() as Array<{ key: string; value: Buffer }>;

      for (const { key, value } of composers) {
        const composerId = key.replace('composerData:', '');
        let meta: CursorComposerMeta;
        try {
          meta = JSON.parse(value.toString('utf8'));
        } catch {
          continue; // skip malformed
        }

        const bubbleRows = db
          .prepare(`SELECT key, value FROM cursorDiskKV WHERE key LIKE ?`)
          .all(`bubbleId:${composerId}:%`) as Array<{ key: string; value: Buffer }>;

        const bubbles = bubbleRows
          .map((r) => this.safeParse<CursorBubble>(r.value))
          .filter((b): b is CursorBubble => b !== null)
          .sort((a, b) => a.createdAt - b.createdAt);

        yield { composerId, meta, bubbles };
      }
    } finally {
      db.close();
    }
  }

  /** Cursor pode estar com lock; fallback copia pra tmp. */
  private openSafely(): Database.Database {
    try {
      return new Database(this.filePath, { readonly: true, fileMustExist: true });
    } catch (err) {
      const tmpPath = path.join(os.tmpdir(), `cursor-${randomUUID()}.vscdb`);
      fs.copyFileSync(this.filePath, tmpPath);
      const db = new Database(tmpPath, { readonly: true });
      db.on('close', () => fs.unlinkSync(tmpPath));
      return db;
    }
  }
}
```

**`CursorSource.parse`:**

- Para cada sessão extraída do vscdb, mapear bubbles → RawTurns
- `sourceId` = `composerId` (estável dentro da máquina; multi-machine sync resolveria com `<userId>:<composerId>` mas isso é v0.3)
- `projectPath` vem de `workspace.json` da mesma pasta

**Script de fixture sintética:**

```typescript
// packages/test-fixtures/src/cursor/createFixture.ts
import Database from 'better-sqlite3';

export function createCursorFixture(
  outPath: string,
  opts: {
    composerCount: number;
    bubblesPerComposer: number;
  },
): void {
  const db = new Database(outPath);
  db.exec(`CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)`);
  // ... gera dados sintéticos
  db.close();
}
```

**Testes:**

- Gerar 3 fixtures com `createFixture` antes dos testes
- Parse extrai N sessões e M bubbles
- Lock handling: testar com DB aberto em outro processo (skip em CI Linux)

**Critério de aceite:**

- Parse de vscdb real (anonimizado) extrai sessões
- Lock fallback funciona em Mac
- Cobertura ≥80%

---

### Task 02.6 — Registry de sources

**Arquivo:** `apps/indexer/src/sources/SourceRegistry.ts`

**O que fazer:**

```typescript
export class SourceRegistry {
  constructor(private readonly sources: ReadonlyArray<SessionSource>) {}

  findFor(filePath: string): SessionSource | null {
    return this.sources.find((s) => s.matches(filePath)) ?? null;
  }

  allWatchPaths(): ReadonlyArray<string> {
    return this.sources.flatMap((s) => s.watchPaths());
  }

  all(): ReadonlyArray<SessionSource> {
    return this.sources;
  }
}

export function createDefaultRegistry(): SourceRegistry {
  return new SourceRegistry([new ClaudeCodeSource(), new CodexCliSource(), new CursorSource()]);
}
```

**Critério de aceite:**

- `findFor` retorna source correto pra cada path
- `findFor` retorna `null` pra path sem match
- Teste de regressão: paths de cada source não dão match cruzado

---

## Testes obrigatórios deste sprint

- Cada source com ≥10 fixtures
- `readJsonLines` 100% coverage
- `SourceRegistry` cobre matching cruzado

## Definition of Done (Sprint 02)

- [ ] 3 sources implementam `SessionSource`
- [ ] 30+ fixtures totais (10 Claude, 10 Codex, 10 Cursor)
- [ ] `pnpm test --filter @cs/indexer` passa
- [ ] Cobertura ≥85% no pacote indexer
- [ ] `docs/sources.md` documenta o formato de cada source
- [ ] Nenhum acesso de filesystem fora dos paths declarados em `watchPaths()`

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 02 do projeto Codex Spotlight.

Leia .claude/sprints/sprint-02-source-adapters.md e execute as 6 tasks em ordem.

Regras críticas:
1. Para gerar as fixtures anonimizadas, eu vou rodar manualmente um script que pega sessões REAIS do meu Mac e roda redactSecrets. Você só implementa o redactSecrets e o formato. Depois eu commito as fixtures.
2. Cursor source é o mais complicado — não invente o schema. Use APENAS os campos confirmados na spec. Se encontrar algo diferente nas fixtures reais, me consulte.
3. TDD obrigatório para o accumulator de cada source
4. NÃO use `any` em nenhum momento — use `unknown` + type guards Zod se precisar
5. Pare e me consulte se algum source precisar de funcionalidade não documentada

Comece pela Task 02.1.
```
