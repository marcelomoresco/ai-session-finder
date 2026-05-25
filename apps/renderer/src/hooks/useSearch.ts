import { trpc } from '../lib/trpc';
import type { SearchFilters, SearchResult } from '../lib/types';
import { useDebouncedValue } from './useDebouncedValue';

const QUICK_DELAY_MS = 150;
const SMART_DELAY_MS = 350;
const LIMIT = 30;

export interface UseSearchOptions {
  readonly query: string;
  readonly filters?: SearchFilters;
}

export interface UseSearchResult {
  readonly results: ReadonlyArray<SearchResult>;
  readonly isLoading: boolean;
  readonly isRefining: boolean;
}

/**
 * Two-stage search: a fast keyword pass (debounced 150ms) shows results quickly,
 * a slower semantic pass (350ms) refines them. The UI never blocks on semantic.
 */
export function useSearch({ query, filters }: UseSearchOptions): UseSearchResult {
  const quickQuery = useDebouncedValue(query, QUICK_DELAY_MS);
  const smartQuery = useDebouncedValue(query, SMART_DELAY_MS);
  const appliedFilters = filters ?? {};

  const quick = trpc.search.query.useQuery(
    { text: quickQuery, mode: 'quick', filters: appliedFilters, limit: LIMIT },
    { enabled: quickQuery.length > 0 },
  );

  const smart = trpc.search.query.useQuery(
    { text: smartQuery, mode: 'smart', filters: appliedFilters, limit: LIMIT },
    { enabled: smartQuery.length > 2 },
  );

  return {
    results: smart.data ?? quick.data ?? [],
    isLoading: quick.isLoading,
    isRefining: smart.isFetching && smart.data === undefined,
  };
}
