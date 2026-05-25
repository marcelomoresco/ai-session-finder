import type { SearchResult } from '../lib/types';

type Tool = SearchResult['tool'];

// Per-tool accent — the launcher's one memorable signature.
const TOOL_META: Record<Tool, { readonly label: string; readonly className: string }> = {
  'claude-code': { label: 'Claude', className: 'bg-amber-500/15 text-amber-300 ring-amber-500/25' },
  'codex-cli': { label: 'Codex', className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25' },
  cursor: { label: 'Cursor', className: 'bg-violet-500/15 text-violet-300 ring-violet-500/25' },
};

export function ToolBadge({ tool }: { tool: Tool }) {
  const meta = TOOL_META[tool];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
