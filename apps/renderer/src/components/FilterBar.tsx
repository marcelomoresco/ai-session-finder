import type { SearchFilters } from '../lib/types';

const TOOLS = [
  { id: 'claude-code', label: 'Claude' },
  { id: 'codex-cli', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
] as const;

type Tool = (typeof TOOLS)[number]['id'];

export interface FilterBarProps {
  readonly filters: SearchFilters;
  readonly onChange: (filters: SearchFilters) => void;
}

/** Quick tool toggles + reset. Project/date filters are available via query
 *  operators (`project:`, `>`/`<` dates). */
export function FilterBar({ filters, onChange }: FilterBarProps) {
  const selected = filters.tools ?? [];

  // Single-select: clicking a tool switches to just that provider; clicking the
  // already-selected one clears the filter (shows all tools).
  const selectTool = (tool: Tool): void => {
    const isOnlyThis = selected.length === 1 && selected[0] === tool;
    onChange({ ...filters, tools: isOnlyThis ? undefined : [tool] });
  };

  const activeCount =
    (selected.length > 0 ? 1 : 0) +
    (filters.projectPath ? 1 : 0) +
    (filters.after ? 1 : 0) +
    (filters.before ? 1 : 0);

  return (
    <div
      role="group"
      aria-label="Search filters"
      className="flex items-center gap-2 border-b border-white/10 px-3 py-2"
    >
      {TOOLS.map(({ id, label }) => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => selectTool(id)}
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide ring-1 ring-inset transition-colors ${
              on
                ? 'bg-white/15 text-zinc-100 ring-white/20'
                : 'text-zinc-500 ring-white/10 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        );
      })}
      {activeCount > 0 && (
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[11px] text-zinc-500">{activeCount} active</span>
          <button
            type="button"
            onClick={() => onChange({})}
            className="font-mono text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
