import type { SearchFilters, SearchQuery, SearchResult } from '@asf/domain';

export interface SearchableRepository {
  search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>>;
  /** Lists sessions matching `filters` (no text match), one row each, newest first. */
  browse(filters: SearchFilters, limit: number): Promise<ReadonlyArray<SearchResult>>;
}
