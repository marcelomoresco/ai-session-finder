import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Command } from 'cmdk';
import { useSearch } from '../hooks/useSearch';
import type { SearchFilters, SearchResult } from '../lib/types';
import { FilterBar } from './FilterBar';
import { ResultList } from './ResultList';

export interface LauncherProps {
  readonly onOpen: (result: SearchResult) => void;
  readonly onSettings: () => void;
}

/** Spotlight-style command palette over the indexed sessions. */
export function Launcher({ onOpen, onSettings }: LauncherProps) {
  const [query, setQuery] = useState('');
  // Open focused on Claude sessions; users can toggle other tools via the FilterBar.
  const [filters, setFilters] = useState<SearchFilters>({ tools: ['claude-code'] });
  const { results, isLoading, isRefining } = useSearch({ query, filters });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    // First Escape clears a non-empty query; a second (or Escape on an empty
    // query) hides the launcher window.
    if (query.length > 0) {
      setQuery('');
    } else {
      window.asf?.hideLauncher();
    }
  };

  return (
    <Command
      label="Search sessions"
      shouldFilter={false}
      onKeyDown={handleKeyDown}
      className="asf-launcher mx-auto w-full max-w-2xl overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#1c1c20] shadow-xl shadow-black/40 [-webkit-app-region:drag]"
    >
      <div className="flex items-center gap-3 px-4">
        <SearchGlyph />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search across all your AI coding sessions…"
          className="min-w-0 flex-1 bg-transparent py-4 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none [-webkit-app-region:no-drag]"
        />
        {isRefining && (
          <span className="shrink-0 animate-pulse font-mono text-[11px] text-zinc-500">
            refining…
          </span>
        )}
        <button
          type="button"
          aria-label="Open settings"
          onClick={onSettings}
          className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200 [-webkit-app-region:no-drag]"
        >
          <GearGlyph />
        </button>
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

function GearGlyph() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
