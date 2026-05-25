import { describe, it, expect } from 'vitest';
import { TurnId, type Session, type Tool, type Turn } from '@asf/domain';
import type { Embedder } from './embedding/Embedder';
import type { Logger } from './Logger';
import type { RawSession, RawTurn } from './sources/RawSession';
import type { SessionSource } from './sources/SessionSource';
import type {
  SessionReaderPort,
  SessionWriterPort,
  VectorRecord,
  VectorWriterPort,
} from './ports';
import { SourceRegistry } from './sources/SourceRegistry';
import { TurnChunker } from './chunking/TurnChunker';
import { NoopEmbedder } from './embedding/NoopEmbedder';
import { SessionIdGenerator } from './SessionIdGenerator';
import { Pipeline } from './Pipeline';

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');
const SESSION_ID = SessionIdGenerator.generate('claude-code', 'source-1');

function makeRawTurn(over: Partial<RawTurn> = {}): RawTurn {
  return {
    index: 0,
    role: 'assistant',
    contentText: 'hello world',
    toolCalls: [],
    filesTouched: [],
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  };
}

function makeRawSession(over: Partial<RawSession> = {}): RawSession {
  return {
    tool: 'claude-code',
    sourceId: 'source-1',
    projectPath: '/Users/dev/project',
    projectName: 'project',
    gitBranch: 'main',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastActivityAt: new Date('2026-01-01T00:05:00.000Z'),
    model: 'claude',
    tokenUsage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
    filePath: '/logs/session.jsonl',
    fileMtime: 1000,
    turns: [makeRawTurn()],
    ...over,
  };
}

class FakeSource implements SessionSource {
  readonly tool: Tool = 'claude-code';
  constructor(
    private readonly sessions: ReadonlyArray<RawSession>,
    private readonly owns = true,
  ) {}
  watchPaths(): ReadonlyArray<string> {
    return [];
  }
  matches(): boolean {
    return this.owns;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async *parse(): AsyncIterable<RawSession> {
    yield* this.sessions;
  }
}

class FakeWriter implements SessionWriterPort {
  readonly upserts: Array<{ session: Session; turns: ReadonlyArray<Turn> }> = [];
  upsert(session: Session, turns: ReadonlyArray<Turn>): Promise<void> {
    this.upserts.push({ session, turns });
    return Promise.resolve();
  }
}

class FakeReader implements SessionReaderPort {
  constructor(private readonly existing: Session | null = null) {}
  findById(): Promise<Session | null> {
    return Promise.resolve(this.existing);
  }
}

class FakeVectorRepo implements VectorWriterPort {
  readonly upserts: VectorRecord[] = [];
  upsertBatch(items: ReadonlyArray<VectorRecord>): Promise<void> {
    this.upserts.push(...items);
    return Promise.resolve();
  }
}

class CountingEmbedder implements Embedder {
  readonly enabled = true;
  readonly dimension = 4;
  readonly batches: string[][] = [];
  embed(): Promise<Float32Array> {
    return Promise.resolve(Float32Array.from([0, 0, 0, 0]));
  }
  embedBatch(texts: ReadonlyArray<string>): Promise<ReadonlyArray<Float32Array>> {
    this.batches.push([...texts]);
    return Promise.resolve(texts.map(() => Float32Array.from([1, 2, 3, 4])));
  }
}

class ThrowingEmbedder implements Embedder {
  readonly enabled = true;
  readonly dimension = 4;
  embed(): Promise<Float32Array> {
    return Promise.reject(new Error('model exploded'));
  }
  embedBatch(): Promise<ReadonlyArray<Float32Array>> {
    return Promise.reject(new Error('model exploded'));
  }
}

class FakeLogger implements Logger {
  readonly warns: string[] = [];
  info(): void {}
  warn(message: string): void {
    this.warns.push(message);
  }
  error(): void {}
  debug(): void {}
}

interface BuildOptions {
  readonly sessions?: ReadonlyArray<RawSession>;
  readonly owns?: boolean;
  readonly reader?: SessionReaderPort;
  readonly embedder?: Embedder;
  readonly vectorRepo?: VectorWriterPort | null;
  readonly logger?: Logger;
}

function build(opts: BuildOptions = {}) {
  const writer = new FakeWriter();
  const source = new FakeSource(opts.sessions ?? [makeRawSession()], opts.owns ?? true);
  const pipeline = new Pipeline({
    registry: new SourceRegistry([source]),
    chunker: new TurnChunker({ maxTokens: 8, overlapTokens: 2 }),
    embedder: opts.embedder ?? new NoopEmbedder(),
    sessionWriter: writer,
    sessionReader: opts.reader ?? new FakeReader(null),
    vectorRepo: opts.vectorRepo ?? null,
    logger: opts.logger ?? new FakeLogger(),
    clock: () => FIXED_NOW,
  });
  return { pipeline, writer };
}

function existingSession(fileMtime: number): Session {
  return {
    id: SESSION_ID,
    tool: 'claude-code',
    sourceId: 'source-1',
    projectPath: null,
    projectName: null,
    gitBranch: null,
    startedAt: new Date(0),
    lastActivityAt: new Date(0),
    turnCount: 1,
    model: null,
    tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    filePath: '/logs/session.jsonl',
    fileMtime,
    indexedAt: new Date(0),
  };
}

describe('Pipeline.indexFile', () => {
  it('does nothing when no source owns the file', async () => {
    const { pipeline, writer } = build({ owns: false });
    expect(await pipeline.indexFile('/unknown/file.txt')).toEqual([]);
    expect(writer.upserts).toHaveLength(0);
  });

  it('normalizes and persists a new session with a derived id and turn count', async () => {
    const { pipeline, writer } = build();
    const indexed = await pipeline.indexFile('/logs/session.jsonl');

    expect(indexed).toEqual([SESSION_ID]);
    expect(writer.upserts).toHaveLength(1);
    const { session, turns } = writer.upserts[0]!;
    expect(session.id).toBe(SESSION_ID);
    expect(session.turnCount).toBe(1);
    expect(session.indexedAt).toEqual(FIXED_NOW);
    expect(session.fileMtime).toBe(1000);
    expect(turns[0]!.id).toBe(`${SESSION_ID}:0`);
    expect(turns[0]!.sessionId).toBe(SESSION_ID);
  });

  it('redacts secrets in content, tool-call results, AND tool-call inputs before persisting', async () => {
    const raw = makeRawSession({
      turns: [
        makeRawTurn({
          contentText: 'my key is sk-abcdefghijklmnopqrstuvwxyz0123456789',
          toolCalls: [
            {
              name: 'bash',
              input: { cmd: 'export TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789' },
              result: 'leaked AKIAABCD1234EFGH5678',
            },
          ],
        }),
      ],
    });
    const { pipeline, writer } = build({ sessions: [raw] });
    await pipeline.indexFile('/logs/session.jsonl');

    const turn = writer.upserts[0]!.turns[0]!;
    const serialized = JSON.stringify(turn);
    expect(serialized).not.toContain('sk-abcdefghijklmnopqrstuvwxyz0123456789');
    expect(serialized).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123456789');
    expect(serialized).not.toContain('AKIAABCD1234EFGH5678');
    expect(turn.contentText).toContain('[REDACTED_API_KEY]');
    expect(turn.toolCalls[0]!.result).toContain('[REDACTED_AWS_KEY]');
    expect(JSON.stringify(turn.toolCalls[0]!.input)).toContain('[REDACTED_TOKEN]');
  });

  it('skips re-indexing when the stored file mtime is newer or equal', async () => {
    const { pipeline, writer } = build({ reader: new FakeReader(existingSession(1000)) });
    expect(await pipeline.indexFile('/logs/session.jsonl')).toEqual([]);
    expect(writer.upserts).toHaveLength(0);
  });

  it('re-indexes when the source file is newer than the stored copy', async () => {
    const { pipeline, writer } = build({ reader: new FakeReader(existingSession(500)) });
    await pipeline.indexFile('/logs/session.jsonl');
    expect(writer.upserts).toHaveLength(1);
  });

  it('does not embed when the embedder is disabled (NoopEmbedder)', async () => {
    const vectorRepo = new FakeVectorRepo();
    const { pipeline } = build({ embedder: new NoopEmbedder(), vectorRepo });
    await pipeline.indexFile('/logs/session.jsonl');
    expect(vectorRepo.upserts).toHaveLength(0);
  });

  it('does not embed when there is no vector repository', async () => {
    const embedder = new CountingEmbedder();
    const { pipeline } = build({ embedder, vectorRepo: null });
    await pipeline.indexFile('/logs/session.jsonl');
    expect(embedder.batches).toHaveLength(0);
  });

  it('embeds chunks and stores one vector per chunk when enabled', async () => {
    const embedder = new CountingEmbedder();
    const vectorRepo = new FakeVectorRepo();
    const longText = 'x'.repeat(200);
    const raw = makeRawSession({ turns: [makeRawTurn({ contentText: longText })] });
    const { pipeline } = build({ sessions: [raw], embedder, vectorRepo });

    await pipeline.indexFile('/logs/session.jsonl');

    const countTurn: Turn = {
      id: TurnId.from(`${SESSION_ID}:0`),
      sessionId: SESSION_ID,
      index: 0,
      role: 'assistant',
      contentText: longText,
      toolCalls: [],
      filesTouched: [],
      timestamp: new Date(0),
    };
    const expectedChunks = new TurnChunker({ maxTokens: 8, overlapTokens: 2 }).chunk(countTurn)
      .length;
    expect(expectedChunks).toBeGreaterThan(1);
    expect(vectorRepo.upserts).toHaveLength(expectedChunks);
    expect(vectorRepo.upserts.every((u) => u.embedding.length === 4)).toBe(true);
  });

  it('keeps the persisted session when embedding fails (resilient, logs a warning)', async () => {
    const logger = new FakeLogger();
    const { pipeline, writer } = build({
      embedder: new ThrowingEmbedder(),
      vectorRepo: new FakeVectorRepo(),
      logger,
    });

    expect(await pipeline.indexFile('/logs/session.jsonl')).toEqual([SESSION_ID]);
    expect(writer.upserts).toHaveLength(1);
    expect(logger.warns.length).toBeGreaterThan(0);
  });
});
