# Sprint 03 — Indexer Pipeline

## Objetivo

Conectar tudo: watcher de FS dispara o Pipeline, que usa `SourceRegistry` para parsear, `Chunker` para fatiar, `Embedder` para vetorizar (opcional) e `SQLiteRepository` para persistir. Tudo rodando num Worker Thread separado.

## Pré-requisitos

- Sprint 01 (`SQLiteRepository`)
- Sprint 02 (`SessionSource`, `SourceRegistry`)

## Tasks

### Task 03.1 — Migration 002: `vec_turns`

**Arquivos:**

- `apps/main/src/persistence/migrations/002_vector_search.sql`
- `apps/main/src/persistence/extensions/loadSqliteVec.ts`

**O que fazer:**

```sql
-- 002_vector_search.sql
-- requer sqlite-vec loaded
CREATE VIRTUAL TABLE vec_turns USING vec0(
  turn_id TEXT PRIMARY KEY,
  embedding FLOAT[768]
);
```

```typescript
// loadSqliteVec.ts
import * as sqliteVec from 'sqlite-vec';
import type Database from 'better-sqlite3';

export function loadSqliteVec(db: Database.Database): void {
  sqliteVec.load(db);
}
```

Atualizar `createDatabase.ts` para chamar `loadSqliteVec(db)` antes do Migrator.

**Critério de aceite:**

- Migration roda após ext carregada
- `SELECT vec_version()` retorna versão
- Fallback: se extensão falhar (Intel Mac sem suporte), pular migration 002 e marcar feature flag `semanticSearch: false`

---

### Task 03.2 — `TurnChunker`

**Arquivos:**

- `apps/indexer/src/chunking/TurnChunker.ts`
- `apps/indexer/src/chunking/tokenize.ts` (estimativa rápida sem tokenizer pesado)

**O que fazer:**
Quebrar turnos longos em chunks com sobreposição:

```typescript
export interface Chunk {
  readonly turnId: TurnId;
  readonly chunkIndex: number;
  readonly text: string;
  readonly tokenCount: number;
}

export interface ChunkerOptions {
  readonly maxTokens: number; // default 800
  readonly overlapTokens: number; // default 100
}

export class TurnChunker {
  constructor(private readonly opts: ChunkerOptions = { maxTokens: 800, overlapTokens: 100 }) {}

  chunk(turn: Turn): ReadonlyArray<Chunk> {
    const tokens = estimateTokens(turn.contentText);
    if (tokens <= this.opts.maxTokens) {
      return [{ turnId: turn.id, chunkIndex: 0, text: turn.contentText, tokenCount: tokens }];
    }
    return this.slideWindow(turn);
  }

  private slideWindow(turn: Turn): ReadonlyArray<Chunk> {
    // sliding window por sentenças, fallback p/ caracteres
    // ...
  }
}
```

**`tokenize.ts`:** estimativa heurística rápida (~chars/4) — não precisa ser exata, é só pra decidir chunking:

```typescript
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

**Testes property-based:**

- Para qualquer turno: `chunks.map(c => c.text).join('')` cobre todo o texto original (descontando sobreposição)
- `chunks` mantém ordem
- Nenhum chunk excede `maxTokens`

**Critério de aceite:**

- Cobertura 100%
- Property tests passam com 100 casos gerados

---

### Task 03.3 — `LocalEmbedder` (Transformers.js)

**Arquivos:**

- `apps/indexer/src/embedding/Embedder.ts` (interface)
- `apps/indexer/src/embedding/LocalEmbedder.ts` (impl)
- `apps/indexer/src/embedding/NoopEmbedder.ts` (fallback)

**O que fazer:**

```typescript
// Embedder.ts
export interface Embedder {
  readonly enabled: boolean;
  readonly dimension: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: ReadonlyArray<string>): Promise<ReadonlyArray<Float32Array>>;
}
```

```typescript
// LocalEmbedder.ts
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export class LocalEmbedder implements Embedder {
  readonly enabled = true;
  readonly dimension = 768;
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = pipeline('feature-extraction', 'nomic-ai/nomic-embed-text-v1.5', {
        quantized: true,
      });
    }
    return this.pipelinePromise;
  }

  async embed(text: string): Promise<Float32Array> {
    const pipe = await this.getPipeline();
    const result = await pipe(text, { pooling: 'mean', normalize: true });
    return new Float32Array(result.data);
  }

  async embedBatch(texts: ReadonlyArray<string>): Promise<ReadonlyArray<Float32Array>> {
    const pipe = await this.getPipeline();
    const results = await pipe([...texts], { pooling: 'mean', normalize: true });
    return Array.from({ length: texts.length }, (_, i) => new Float32Array(results[i].data));
  }
}
```

```typescript
// NoopEmbedder.ts — usado quando semantic search desabilitado
export class NoopEmbedder implements Embedder {
  readonly enabled = false;
  readonly dimension = 0;
  async embed(): Promise<Float32Array> {
    return new Float32Array();
  }
  async embedBatch(): Promise<ReadonlyArray<Float32Array>> {
    return [];
  }
}
```

**Testes:**

- LocalEmbedder retorna vetor de tamanho 768
- Dois textos similares têm cosine similarity > 0.7
- Dois textos não relacionados têm similarity < 0.5
- NoopEmbedder não baixa modelo (importante p/ testes rápidos)

**Critério de aceite:**

- Modelo é lazy-loaded (não baixa no construtor)
- Primeira chamada baixa modelo, cacheia em `~/.cache/huggingface/`
- Embed de 100 turnos em <30s (M2)

---

### Task 03.4 — Storage de embeddings

**Arquivos:**

- `apps/main/src/persistence/VectorRepository.ts`

**O que fazer:**

```typescript
export interface VectorRepository {
  upsert(turnId: TurnId, embedding: Float32Array): Promise<void>;
  upsertBatch(items: ReadonlyArray<{ turnId: TurnId; embedding: Float32Array }>): Promise<void>;
  delete(turnId: TurnId): Promise<void>;
  search(
    queryVector: Float32Array,
    k: number,
  ): Promise<ReadonlyArray<{ turnId: TurnId; distance: number }>>;
}

export class SqliteVecRepository implements VectorRepository {
  constructor(private readonly db: Database.Database) {}

  async upsertBatch(
    items: ReadonlyArray<{ turnId: TurnId; embedding: Float32Array }>,
  ): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO vec_turns (turn_id, embedding) VALUES (?, ?)`,
    );
    const tx = this.db.transaction(() => {
      for (const { turnId, embedding } of items) {
        stmt.run(turnId, Buffer.from(embedding.buffer));
      }
    });
    tx();
  }

  async search(
    queryVector: Float32Array,
    k: number,
  ): Promise<ReadonlyArray<{ turnId: TurnId; distance: number }>> {
    const rows = this.db
      .prepare(`SELECT turn_id, distance FROM vec_turns WHERE embedding MATCH ? AND k = ?`)
      .all(Buffer.from(queryVector.buffer), k) as Array<{ turn_id: string; distance: number }>;
    return rows.map((r) => ({ turnId: TurnId.from(r.turn_id), distance: r.distance }));
  }
}
```

**Critério de aceite:**

- Upsert de 1000 vetores em <500ms
- Search retorna k vizinhos mais próximos
- Cobertura ≥80%

---

### Task 03.5 — `Pipeline` orquestrador

**Arquivos:**

- `apps/indexer/src/Pipeline.ts`
- `apps/indexer/src/SessionIdGenerator.ts`
- `apps/indexer/src/security/redactSecrets.ts`

**O que fazer:**
Orquestra: parse → normalize → redact → chunk → embed → persist:

```typescript
export interface PipelineDeps {
  readonly registry: SourceRegistry;
  readonly chunker: TurnChunker;
  readonly embedder: Embedder;
  readonly sessionWriter: SessionWriter;
  readonly sessionReader: SessionReader;
  readonly vectorRepo: VectorRepository | null; // null se semantic desabilitado
  readonly logger: Logger;
}

export class Pipeline {
  constructor(private readonly deps: PipelineDeps) {}

  async indexFile(filePath: string): Promise<void> {
    const source = this.deps.registry.findFor(filePath);
    if (!source) return;

    const stats = await fs.stat(filePath);
    const fileMtime = stats.mtimeMs;

    for await (const raw of source.parse(filePath)) {
      const sessionId = SessionIdGenerator.generate(raw.tool, raw.sourceId);

      // skip se já indexado e arquivo não mudou
      const existing = await this.deps.sessionReader.findById(sessionId);
      if (existing && existing.fileMtime >= fileMtime) continue;

      const session = this.normalize(raw, sessionId, fileMtime);
      const turns = this.normalizeTurns(raw, sessionId);

      await this.deps.sessionWriter.upsert(session, turns);

      if (this.deps.embedder.enabled && this.deps.vectorRepo) {
        await this.embedAndStore(turns);
      }
    }
  }

  private normalize(raw: RawSession, sessionId: SessionId, fileMtime: number): Session {
    return {
      id: sessionId,
      tool: raw.tool,
      sourceId: raw.sourceId,
      projectPath: raw.projectPath,
      projectName: raw.projectName,
      gitBranch: raw.gitBranch,
      startedAt: raw.startedAt,
      lastActivityAt: raw.lastActivityAt,
      turnCount: raw.turns.length,
      model: raw.model,
      tokenUsage: raw.tokenUsage,
      filePath: raw.filePath,
      fileMtime,
      indexedAt: new Date(),
    };
  }

  private normalizeTurns(raw: RawSession, sessionId: SessionId): ReadonlyArray<Turn> {
    return raw.turns.map((rt) => ({
      id: TurnId.from(`${sessionId}:${rt.index}`),
      sessionId,
      index: rt.index,
      role: rt.role,
      contentText: redactSecrets(rt.contentText),
      toolCalls: rt.toolCalls.map((tc) => ({
        name: tc.name,
        input: tc.input,
        result: tc.result ? redactSecrets(tc.result) : null,
      })),
      filesTouched: rt.filesTouched,
      timestamp: rt.timestamp,
    }));
  }

  private async embedAndStore(turns: ReadonlyArray<Turn>): Promise<void> {
    const chunks = turns.flatMap((t) => this.deps.chunker.chunk(t));
    const BATCH_SIZE = 32;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await this.deps.embedder.embedBatch(batch.map((c) => c.text));
      await this.deps.vectorRepo!.upsertBatch(
        batch.map((c, idx) => ({ turnId: c.turnId, embedding: embeddings[idx] })),
      );
    }
  }
}
```

**`SessionIdGenerator`:**

```typescript
export class SessionIdGenerator {
  static generate(tool: Tool, sourceId: string): SessionId {
    const hash = createHash('sha256').update(`${tool}:${sourceId}`).digest('hex').slice(0, 32);
    return SessionId.from(hash);
  }
}
```

**`redactSecrets`** (de novo, agora com testes property-based):

```typescript
const PATTERNS: ReadonlyArray<RegExp> = [
  /sk-[A-Za-z0-9]{32,}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g,
];

export function redactSecrets(text: string): string {
  return PATTERNS.reduce((acc, p) => acc.replace(p, '[REDACTED]'), text);
}
```

**Critério de aceite:**

- Re-indexar arquivo sem mudança = noop (não escreve no DB)
- Re-indexar arquivo modificado = upsert
- Secrets nunca aparecem no DB
- Cobertura ≥85%

---

### Task 03.6 — `FsWatcher`

**Arquivo:** `apps/indexer/src/Watcher.ts`

**O que fazer:**

```typescript
import chokidar from 'chokidar';
import EventEmitter from 'node:events';

export interface WatcherEvents {
  fileChanged: [filePath: string];
  ready: [];
  error: [error: Error];
}

export class FsWatcher extends EventEmitter<WatcherEvents> {
  private watcher: chokidar.FSWatcher | null = null;

  constructor(
    private readonly paths: ReadonlyArray<string>,
    private readonly opts: { debounceMs: number } = { debounceMs: 500 },
  ) {
    super();
  }

  start(): void {
    this.watcher = chokidar.watch([...this.paths], {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: this.opts.debounceMs, pollInterval: 100 },
      ignored: /(^|[\/\\])\../, // dotfiles que não precisamos
    });

    this.watcher
      .on('add', (p) => this.emit('fileChanged', p))
      .on('change', (p) => this.emit('fileChanged', p))
      .on('ready', () => this.emit('ready'))
      .on('error', (e) => this.emit('error', e as Error));
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }
}
```

**Critério de aceite:**

- Detecta criação/modificação em <1s no Mac
- Debounce evita spam em arquivos sendo escritos (JSONL append)
- `stop` libera recursos completamente

---

### Task 03.7 — `IndexerWorker` (Worker Thread)

**Arquivos:**

- `apps/indexer/src/worker.ts` (entry point do worker)
- `apps/indexer/src/WorkerProtocol.ts` (mensagens main ↔ worker)
- `apps/main/src/services/IndexerService.ts` (controla o worker do main)

**O que fazer:**
Protocolo simples de mensagens:

```typescript
// WorkerProtocol.ts
export type MainToWorker = { type: 'start' } | { type: 'stop' } | { type: 'fullReindex' };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'sessionIndexed'; sessionId: string }
  | { type: 'progress'; total: number; done: number }
  | { type: 'error'; message: string };
```

Worker monta deps e roda:

```typescript
// worker.ts
import { parentPort } from 'node:worker_threads';
import { createDatabase } from '../../main/src/persistence/createDatabase.js';
// ... wire up registry + chunker + embedder + repo + pipeline
// ouvir MainToWorker, executar, emitir WorkerToMain
```

`IndexerService` no main:

```typescript
export class IndexerService {
  private worker: Worker | null = null;

  start(): void {
    this.worker = new Worker(new URL('../../indexer/dist/worker.js', import.meta.url));
    this.worker.on('message', (msg: WorkerToMain) => this.handleWorkerMessage(msg));
    this.worker.postMessage({ type: 'start' } satisfies MainToWorker);
  }

  fullReindex(): void {
    this.worker?.postMessage({ type: 'fullReindex' });
  }
  async stop(): Promise<void> {
    await this.worker?.terminate();
  }
}
```

**Critério de aceite:**

- Worker roda isolado, crash não derruba app principal
- Mensagens tipadas via `satisfies`
- `stop` termina em <2s

---

## Testes obrigatórios deste sprint

- `TurnChunker` property-based (100 casos)
- `Pipeline.indexFile` integration test com SQLite in-memory + fixtures
- `redactSecrets` cobre todos os patterns + casos negativos (não redactar strings comuns)
- `Watcher` integration test com fs temporário

## Definition of Done (Sprint 03)

- [ ] Pipeline indexa 5.000 sessões fixtures em <2 min (M2)
- [ ] Re-indexação incremental (1 arquivo) em <300ms
- [ ] RAM durante indexação <800MB
- [ ] Embedder funciona com modelo baixado no `~/.cache/huggingface/`
- [ ] Worker thread isola crash do main
- [ ] `docs/indexing.md` documenta fluxo e perf

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 03 do projeto Codex Spotlight.

Leia .claude/sprints/sprint-03-indexer-pipeline.md e execute as 7 tasks em ordem.

Regras críticas:
1. Tudo no Pipeline DEVE ser injetado via construtor (DIP). Nenhum `new` dentro de métodos exceto types primitivos.
2. Worker thread NÃO compartilha SQLite handle com main — abre seu próprio. SQLite WAL permite leitura concorrente.
3. Embedder é opcional: app inteiro deve funcionar com NoopEmbedder se Transformers.js falhar
4. Para o benchmark de 5000 sessões, use packages/test-fixtures + script gerador
5. NÃO esquecer: redactSecrets ANTES de persistir, sempre

Comece pela Task 03.1.
```
