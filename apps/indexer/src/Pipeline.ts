import { TurnId, type Session, type SessionId, type Turn } from '@asf/domain';
import type { Embedder } from './embedding/Embedder';
import type { Logger } from './Logger';
import type { RawSession } from './sources/RawSession';
import type { SourceRegistry } from './sources/SourceRegistry';
import type { TurnChunker } from './chunking/TurnChunker';
import type { SessionReaderPort, SessionWriterPort, VectorWriterPort } from './ports';
import { SessionIdGenerator } from './SessionIdGenerator';
import { redactSecrets } from './security/redactSecrets';

/** Everything the Pipeline needs, injected via the constructor (DIP). */
export interface PipelineDeps {
  readonly registry: SourceRegistry;
  readonly chunker: TurnChunker;
  readonly embedder: Embedder;
  readonly sessionWriter: SessionWriterPort;
  readonly sessionReader: SessionReaderPort;
  /** Null when semantic search is disabled (no sqlite-vec). */
  readonly vectorRepo: VectorWriterPort | null;
  readonly logger: Logger;
  /** Injected clock so `indexedAt` is deterministic in tests (no `new Date()` in methods). */
  readonly clock: () => Date;
}

const EMBED_BATCH_SIZE = 32;

/**
 * Orchestrates indexing of a single file: parse → normalize → redact → persist,
 * then (optionally) chunk → embed → store vectors. All collaborators are
 * injected; the Pipeline owns no I/O of its own.
 */
export class Pipeline {
  constructor(private readonly deps: PipelineDeps) {}

  /** Returns the ids of sessions actually (re)indexed this call (skips excluded). */
  async indexFile(filePath: string): Promise<ReadonlyArray<SessionId>> {
    const source = this.deps.registry.findFor(filePath);
    if (!source) {
      return [];
    }

    const indexed: SessionId[] = [];
    for await (const raw of source.parse(filePath)) {
      const sessionId = SessionIdGenerator.generate(raw.tool, raw.sourceId);

      // Incremental skip: the source file hasn't advanced past what we stored.
      const existing = await this.deps.sessionReader.findById(sessionId);
      if (existing && existing.fileMtime >= raw.fileMtime) {
        this.deps.logger.debug('skip unchanged session', { sessionId, filePath });
        continue;
      }

      const session = this.normalize(raw, sessionId);
      const turns = this.normalizeTurns(raw, sessionId);

      await this.deps.sessionWriter.upsert(session, turns);
      indexed.push(sessionId);
      this.deps.logger.info('indexed session', { sessionId, turns: turns.length });

      if (this.deps.embedder.enabled && this.deps.vectorRepo) {
        await this.embedAndStore(turns, this.deps.vectorRepo);
      }
    }

    return indexed;
  }

  private normalize(raw: RawSession, sessionId: SessionId): Session {
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
      fileMtime: raw.fileMtime,
      indexedAt: this.deps.clock(),
    };
  }

  /**
   * Maps raw turns to domain turns, redacting secrets from every field that gets
   * persisted: content text, tool-call results, and tool-call inputs (serialized
   * to JSON in storage, so a secret there would otherwise reach the DB).
   */
  private normalizeTurns(raw: RawSession, sessionId: SessionId): ReadonlyArray<Turn> {
    return raw.turns.map((rt) => ({
      id: TurnId.from(`${sessionId}:${rt.index}`),
      sessionId,
      index: rt.index,
      role: rt.role,
      contentText: redactSecrets(rt.contentText),
      toolCalls: rt.toolCalls.map((tc) => ({
        name: tc.name,
        input: redactInput(tc.input),
        result: tc.result === null ? null : redactSecrets(tc.result),
      })),
      filesTouched: rt.filesTouched,
      timestamp: rt.timestamp,
    }));
  }

  /**
   * Embeds turn chunks in batches and stores the vectors. Isolated in try/catch
   * so an embedder failure (model unavailable mid-run) never loses the session
   * that was already persisted — semantic search just stays empty for it.
   */
  private async embedAndStore(
    turns: ReadonlyArray<Turn>,
    vectorRepo: VectorWriterPort,
  ): Promise<void> {
    const chunks = turns.flatMap((turn) => this.deps.chunker.chunk(turn));
    if (chunks.length === 0) {
      return;
    }

    try {
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const embeddings = await this.deps.embedder.embedBatch(batch.map((c) => c.text));
        const records = batch.flatMap((chunk, j) => {
          const embedding = embeddings[j];
          return embedding ? [{ turnId: chunk.turnId, embedding }] : [];
        });
        await vectorRepo.upsertBatch(records);
      }
    } catch (error) {
      this.deps.logger.warn('embedding failed; session indexed without vectors', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Redacts secrets nested in a tool-call input via a JSON round-trip. */
function redactInput(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return JSON.parse(redactSecrets(JSON.stringify(input))) as Record<string, unknown>;
}
