import { useState, type KeyboardEvent } from 'react';
import { Command } from 'cmdk';
import { useSearch } from '../hooks/useSearch';
import type { SearchFilters, SearchResult } from '../lib/types';
import { FilterBar } from './FilterBar';
import { ResultList } from './ResultList';

export interface LauncherProps {
  readonly onOpen: (result: SearchResult) => void;
}

/** Spotlight-style command palette over the indexed sessions. */
export function Launcher({ onOpen }: LauncherProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const { results, isLoading, isRefining } = useSearch({ query, filters });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && query.length > 0) {
      event.preventDefault();
      setQuery('');
    }
  };

  return (
    <Command
      label="Search sessions"
      shouldFilter={false}
      onKeyDown={handleKeyDown}
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-black/50 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4">
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search across all your AI coding sessions…"
          className="w-full bg-transparent py-4 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
        {isRefining && (
          <span className="shrink-0 animate-pulse font-mono text-[11px] text-zinc-500">
            refining…
          </span>
        )}
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      <ResultList results={results} isLoading={isLoading} onSelect={onOpen} />
    </Command>
  );
}
