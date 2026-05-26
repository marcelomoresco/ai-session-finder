import { useState, type KeyboardEvent, type ReactNode } from 'react';
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
  // Open focused on Claude sessions; users can toggle other tools via the FilterBar.
  const [filters, setFilters] = useState<SearchFilters>({ tools: ['claude-code'] });
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
      className="asf-launcher mx-auto w-full max-w-2xl overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#1c1c20] shadow-xl shadow-black/40"
    >
      <div className="flex items-center gap-3 px-4">
        <SearchGlyph />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search across all your AI coding sessions…"
          className="w-full bg-transparent py-4 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
        {isRefining && (
          <span className="shrink-0 animate-pulse font-mono text-[11px] text-zinc-500">
            refining…
          </span>
        )}
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      <ResultList results={results} isLoading={isLoading} query={query} onSelect={onOpen} />
      <footer className="flex items-center justify-between border-t border-white/10 px-4 py-2 font-mono text-[11px] text-zinc-500">
        <span>{results.length > 0 ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'local · private · zero telemetry'}</span>
        <span className="flex items-center gap-2">
          <Kbd>↑↓</Kbd>
          <span>navigate</span>
          <Kbd>↵</Kbd>
          <span>open</span>
          <Kbd>esc</Kbd>
          <span>close</span>
        </span>
      </footer>
    </Command>
  );
}

function SearchGlyph() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-zinc-500"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Kbd({ children }: { readonly children: ReactNode }) {
  return (
    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] leading-none text-zinc-400">
      {children}
    </kbd>
  );
}
