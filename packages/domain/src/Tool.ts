export const TOOLS = ['claude-code', 'codex-cli', 'cursor'] as const;

export type Tool = (typeof TOOLS)[number];

export function isTool(value: unknown): value is Tool {
  return typeof value === 'string' && (TOOLS as readonly string[]).includes(value);
}
