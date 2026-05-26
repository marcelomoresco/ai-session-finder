import { describe, it, expect } from 'vitest';
import {
  SessionId,
  TurnId,
  type SearchFilters,
  type SearchQuery,
  type SearchResult,
} from '@asf/domain';
import type { Embedder } from '@asf/indexer';
import type { SearchableRepository } from '../persistence/SearchableRepository';
import type { VectorRepository, VectorSearchHit } from '../persistence/VectorRepository';
import { SilentLogger, type Logger } from '../observability/Logger';
import { QueryParser } from './QueryParser';
import { ACTIVE_WINDOW_MS, SearchService } from './SearchService';

function result(turnId: string): SearchResult {
  return {
    sessionId: SessionId.from(`s-${turnId}`),
    turnId: TurnId.from(turnId),
    snippet: 'snippet',
    projectName: 'project',
    tool: 'claude-code',
    lastActivityAt: new Date(0),
    score: 1,
  };
}

class FakeRepo implements SearchableRepository {
  readonly calls: SearchQuery[] = [];
  readonly browseCalls: Array<{ filters: SearchFilters; limit: number }> = [];
  constructor(private readonly results: ReadonlyArray<SearchResult> = []) {}
  search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>> {
    this.calls.push(query);
    return Promise.resolve(this.results);
  }
  browse(filters: SearchFilters, limit: number): Promise<ReadonlyArray<SearchResult>> {
    this.browseCalls.push({ filters, limit });
    return Promise.resolve(this.results);
  }
}

class FakeVectorRepo implements VectorRepository {
  searchCalls = 0;
  constructor(private readonly hits: ReadonlyArray<VectorSearchHit> = []) {}
  upsert(): Promise<void> {
    return Promise.resolve();
  }
  upsertBatch(): Promise<void> {
    return Promise.resolve();
  }
  delete(): Promise<void> {
    return Promise.resolve();
  }
  clearAll(): Promise<void> {
    return Promise.resolve();
  }
  search(): Promise<ReadonlyArray<VectorSearchHit>> {
    this.searchCalls += 1;
    return Promise.resolve(this.hits);
  }
}

class FakeEmbedder implements Embedder {
  embedCalls = 0;
  readonly dimension = 4;
  constructor(readonly enabled: boolean) {}
  embed(): Promise<Float32Array> {
    this.embedCalls += 1;
    return Promise.resolve(Float32Array.from([1, 2, 3, 4]));
  }
  embedBatch(): Promise<ReadonlyArray<Float32Array>> {
    return Promise.resolve([]);
  }
}

class SpyLogger extends SilentLogger {
  readonly debugCalls: Array<{ obj: object; msg: string | undefined }> = [];
  override debug(obj: object, msg?: string): void {
    this.debugCalls.push({ obj, msg });
  }
}

const hit = (turnId: string, distance: number): VectorSearchHit => ({
  turnId: TurnId.from(turnId),
  distance,
});

function buildQuery(over: Partial<SearchQuery> = {}): SearchQuery {
  return { text: 'hello', mode: 'quick', filters: {}, limit: 30, ...over };
}

interface Deps {
  repo?: FakeRepo;
  vectorRepo?: VectorRepository | null;
  embedder?: Embedder;
  logger?: Logger;
}

function makeService(deps: Deps = {}) {
  const repo = deps.repo ?? new FakeRepo();
  const service = new SearchService({
    repo,
    vectorRepo: deps.vectorRepo === undefined ? null : deps.vectorRepo,
    embedder: deps.embedder ?? new FakeEmbedder(false),
    logger: deps.logger ?? new SilentLogger(),
    parser: new QueryParser(),
  });
  return { service, repo };
}

describe('SearchService', () => {
  it('quick mode hits FTS only — no embedder, no vector repo', async () => {
    const embedder = new FakeEmbedder(true);
    const vectorRepo = new FakeVectorRepo();
    const { service, repo } = makeService({
      embedder,
      vectorRepo,
      repo: new FakeRepo([result('t1')]),
    });

    const results = await service.search(buildQuery({ mode: 'quick' }));

    expect(results).toHaveLength(1);
    expect(repo.calls).toHaveLength(1);
    expect(embedder.embedCalls).toBe(0);
    expect(vectorRepo.searchCalls).toBe(0);
  });

  it('smart mode fuses FTS + vector results', async () => {
    const embedder = new FakeEmbedder(true);
    const vectorRepo = new FakeVectorRepo([hit('t3', 0.1), hit('t1', 0.2)]);
    const repo = new FakeRepo([result('t1'), result('t2'), result('t3')]);
    const { service } = makeService({ embedder, vectorRepo, repo });

    const results = await service.search(buildQuery({ mode: 'smart' }));

    expect(embedder.embedCalls).toBe(1);
    expect(vectorRepo.searchCalls).toBe(1);
    // t1 and t3 appear in both lists → fused above t2; hydrated from FTS metadata.
    expect(results.map((r) => r.turnId)).toEqual(['t1', 't3', 't2']);
  });

  it('falls back to quick when the embedder is disabled', async () => {
    const embedder = new FakeEmbedder(false);
    const vectorRepo = new FakeVectorRepo();
    const { service } = makeService({ embedder, vectorRepo });

    await service.search(buildQuery({ mode: 'smart' }));

    expect(embedder.embedCalls).toBe(0);
    expect(vectorRepo.searchCalls).toBe(0);
  });

  it('falls back to quick when there is no vector repo', async () => {
    const embedder = new FakeEmbedder(true);
    const { service } = makeService({ embedder, vectorRepo: null });

    await service.search(buildQuery({ mode: 'smart' }));

    expect(embedder.embedCalls).toBe(0);
  });

  it('applies inline operators to the repository query', async () => {
    const repo = new FakeRepo([]);
    const { service } = makeService({ repo });

    await service.search(buildQuery({ text: 'tool:cursor project:/foo >2026-01-01 <2026-12-31 bar' }));

    const sent = repo.calls[0]!;
    expect(sent.text).toBe('bar');
    expect(sent.filters.tools).toEqual(['cursor']);
    expect(sent.filters.projectPath).toBe('/foo');
    expect(sent.filters.after).toEqual(new Date('2026-01-01'));
    expect(sent.filters.before).toEqual(new Date('2026-12-31'));
  });

  it('browseActive applies the active window and delegates to repo.browse', async () => {
    const repo = new FakeRepo([result('t1')]);
    const { service } = makeService({ repo });
    const before = Date.now();

    const results = await service.browseActive({ tools: ['claude-code'] }, 20);

    expect(results.map((r) => r.turnId)).toEqual(['t1']);
    expect(repo.browseCalls).toHaveLength(1);
    const call = repo.browseCalls[0]!;
    expect(call.filters.tools).toEqual(['claude-code']);
    expect(call.limit).toBe(20);
    const after = call.filters.after?.getTime() ?? 0;
    expect(after).toBeGreaterThanOrEqual(before - ACTIVE_WINDOW_MS);
    expect(after).toBeLessThanOrEqual(Date.now() - ACTIVE_WINDOW_MS);
  });

  it('logs only metadata (no turn content) when done', async () => {
    const logger = new SpyLogger();
    const { service } = makeService({ logger, repo: new FakeRepo([result('t1')]) });

    await service.search(buildQuery());

    expect(logger.debugCalls).toHaveLength(1);
    const { obj, msg } = logger.debugCalls[0]!;
    expect(msg).toBe('search.done');
    expect(Object.keys(obj).sort()).toEqual(['count', 'mode', 'ms']);
  });
});
