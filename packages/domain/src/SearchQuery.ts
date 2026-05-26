import type { Tool } from './Tool';
import type { SessionId } from './Session';
import type { TurnId } from './Turn';

export interface SearchFilters {
  readonly tools?: ReadonlyArray<Tool>;
  readonly projectPath?: string;
  readonly after?: Date;
  readonly before?: Date;
}

export type SearchMode = 'quick' | 'smart';

export interface SearchQuery {
  readonly text: string;
  readonly mode: SearchMode;
  readonly filters: SearchFilters;
  readonly limit: number;
}

export interface SearchResult {
  readonly sessionId: SessionId;
  readonly turnId: TurnId;
  readonly snippet: string;
  readonly projectName: string | null;
  readonly tool: Tool;
  readonly lastActivityAt: Date;
  readonly score: number;
  /** Total session tokens (input + output). Populated by the repository queries. */
  readonly tokens?: number;
}
