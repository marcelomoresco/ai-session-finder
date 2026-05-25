import type { SearchFilters, SearchQuery, SearchResult } from '@asf/domain';
import type { Embedder } from '@asf/indexer';
import type { SearchableRepository } from '../persistence/SearchableRepository';
import type { VectorRepository } from '../persistence/VectorRepository';
import type { Logger } from '../observability/Logger';
import type { QueryParser } from './QueryParser';
import { RankFusion } from './RankFusion';

export interface SearchServiceDeps {
  readonly repo: SearchableRepository;
  /** Null when semantic search is unavailable; forces quick mode. */
  readonly vectorRepo: VectorRepository | null;
  readonly embedder: Embedder;
  readonly logger: Logger;
  readonly parser: QueryParser;
}

const CANDIDATE_LIMIT = 50;

/**
 * Application search. `quick` runs keyword (FTS) only; `smart` additionally runs
 * vector search and fuses the two rankings (RRF). Inline operators in the query
 * text (`tool:`, `project:`, `>`/`<` dates) override the structured filters.
 *
 * Everything is injected (DIP); the service constructs nothing and logs only
 * metadata — never turn content.
 */
export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  async search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>> {
    const start = performance.now();
    const enhanced = this.enhance(query);

    if (query.mode === 'quick' || !this.deps.embedder.enabled || !this.deps.vectorRepo) {
      const results = await this.deps.repo.search(enhanced);
      this.logElapsed('quick', start, results.length);
      return results;
    }

    return this.smartSearch(enhanced, this.deps.vectorRepo, start);
  }

  /** Merges parsed operators over the structured filters (operators win). */
  private enhance(query: SearchQuery): SearchQuery {
    const parsed = this.deps.parser.parse(query.text);
    const tools = parsed.tools.length > 0 ? parsed.tools : query.filters.tools;
    const projectPath = parsed.projectPath ?? query.filters.projectPath;
    const after = parsed.after ?? query.filters.after;
    const before = parsed.before ?? query.filters.before;

    // Build with conditional spreads so absent keys are omitted entirely
    // (exactOptionalPropertyTypes forbids `key: undefined`).
    const filters: SearchFilters = {
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(projectPath != null ? { projectPath } : {}),
      ...(after != null ? { after } : {}),
      ...(before != null ? { before } : {}),
    };

    return { ...query, text: parsed.text || query.text, filters };
  }

  private async smartSearch(
    query: SearchQuery,
    vectorRepo: VectorRepository,
    start: number,
  ): Promise<ReadonlyArray<SearchResult>> {
    const [ftsResults, queryVector] = await Promise.all([
      this.deps.repo.search({ ...query, limit: CANDIDATE_LIMIT }),
      this.deps.embedder.embed(query.text),
    ]);
    const vecMatches = await vectorRepo.search(queryVector, CANDIDATE_LIMIT);

    const fused = RankFusion.fuse([
      ftsResults.map((r, i) => ({ id: r.turnId, rank: i })),
      vecMatches.map((v, i) => ({ id: v.turnId, rank: i })),
    ]).slice(0, query.limit);

    // Hydrate fused ids with FTS metadata; drop vector-only ids we can't display.
    const byId = new Map<string, SearchResult>(
      ftsResults.map((r): [string, SearchResult] => [r.turnId, r]),
    );
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
