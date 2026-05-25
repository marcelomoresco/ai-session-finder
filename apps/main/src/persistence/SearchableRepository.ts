import type { SearchQuery, SearchResult } from '@asf/domain';

export interface SearchableRepository {
  search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>>;
}
