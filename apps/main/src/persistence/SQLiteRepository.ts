/* eslint-disable @typescript-eslint/require-await --
   This repository is an async adapter over the synchronous better-sqlite3 driver:
   the interface contract is Promise-based while the implementation is intentionally
   synchronous, so methods correctly have no `await`. */
import type Database from 'better-sqlite3';
import {
  SessionId,
  TurnId,
  type Session,
  type SearchQuery,
  type SearchResult,
  type Tool,
  type Turn,
} from '@asf/domain';
import type { SessionListFilter, SessionReader } from './SessionReader';
import type { SessionWriter } from './SessionWriter';
import type { SearchableRepository } from './SearchableRepository';
import {
  COUNT_SESSIONS,
  DELETE_SESSION,
  DELETE_TURNS_BY_SESSION,
  INSERT_FILE_TOUCHED,
  INSERT_TURN,
  SELECT_SESSION_BY_ID,
  SELECT_SESSION_BY_TOOL_SOURCE,
  UPSERT_SESSION,
  buildListSessionsQuery,
  buildSearchQuery,
} from './queries';

interface SessionRow {
  readonly id: string;
  readonly tool: string;
  readonly source_id: string;
  readonly project_path: string | null;
  readonly project_name: string | null;
  readonly git_branch: string | null;
  readonly started_at: number;
  readonly last_activity_at: number;
  readonly turn_count: number;
  readonly model: string | null;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read: number;
  readonly cache_creation: number;
  readonly file_path: string;
  readonly file_mtime: number;
  readonly indexed_at: number;
}

interface SearchRow {
  readonly session_id: string;
  readonly turn_id: string;
  readonly snippet: string;
  readonly project_name: string | null;
  readonly tool: string;
  readonly last_activity_at: number;
  readonly score: number;
}

type Row = Record<string, string | number | null>;

/**
 * SQLite-backed repository. Branded domain ids and Date objects are mapped to
 * raw columns (and back) here at the persistence boundary, so brands never leak
 * into the database and raw rows never leak into the domain.
 */
export class SQLiteRepository implements SessionReader, SessionWriter, SearchableRepository {
  constructor(private readonly db: Database.Database) {}

  // ---- SessionReader ----

  async findById(id: SessionId): Promise<Session | null> {
    const row = this.db.prepare(SELECT_SESSION_BY_ID).get(id) as SessionRow | undefined;
    return row ? this.mapRowToSession(row) : null;
  }

  async findByToolAndSourceId(tool: Tool, sourceId: string): Promise<Session | null> {
    const row = this.db.prepare(SELECT_SESSION_BY_TOOL_SOURCE).get(tool, sourceId) as
      | SessionRow
      | undefined;
    return row ? this.mapRowToSession(row) : null;
  }

  async list(filter: SessionListFilter): Promise<ReadonlyArray<Session>> {
    const { sql, params } = buildListSessionsQuery(filter);
    const rows = this.db.prepare(sql).all(params) as SessionRow[];
    return rows.map((row) => this.mapRowToSession(row));
  }

  async countAll(): Promise<number> {
    const row = this.db.prepare(COUNT_SESSIONS).get() as { count: number };
    return row.count;
  }

  // ---- SessionWriter ----

  async upsert(session: Session, turns: ReadonlyArray<Turn>): Promise<void> {
    const apply = this.db.transaction(() => {
      this.db.prepare(UPSERT_SESSION).run(this.mapSessionToRow(session));
      this.db.prepare(DELETE_TURNS_BY_SESSION).run(session.id);

      const insertTurn = this.db.prepare(INSERT_TURN);
      const insertFile = this.db.prepare(INSERT_FILE_TOUCHED);
      for (const turn of turns) {
        insertTurn.run(this.mapTurnToRow(turn));
        for (const file of turn.filesTouched) {
          insertFile.run(session.id, turn.id, file.path, file.operation);
        }
      }
    });
    apply();
  }

  async delete(id: SessionId): Promise<void> {
    this.db.prepare(DELETE_SESSION).run(id);
  }

  async pruneOrphans(): Promise<number> {
    // Filled in once the indexer can detect deleted source files (later sprint).
    return 0;
  }

  // ---- SearchableRepository ----

  async search(query: SearchQuery): Promise<ReadonlyArray<SearchResult>> {
    const fts = this.toFtsQuery(query.text);
    if (fts.length === 0) {
      return [];
    }
    const { sql, params } = buildSearchQuery(fts, query.filters, query.limit);
    const rows = this.db.prepare(sql).all(params) as SearchRow[];
    return rows.map((row) => this.mapRowToResult(row));
  }

  // ---- Mapping at the domain boundary ----

  private mapRowToSession(row: SessionRow): Session {
    return {
      id: SessionId.from(row.id),
      tool: row.tool as Tool,
      sourceId: row.source_id,
      projectPath: row.project_path,
      projectName: row.project_name,
      gitBranch: row.git_branch,
      startedAt: new Date(row.started_at),
      lastActivityAt: new Date(row.last_activity_at),
      turnCount: row.turn_count,
      model: row.model,
      tokenUsage: {
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheReadTokens: row.cache_read,
        cacheCreationTokens: row.cache_creation,
      },
      filePath: row.file_path,
      fileMtime: row.file_mtime,
      indexedAt: new Date(row.indexed_at),
    };
  }

  private mapSessionToRow(session: Session): Row {
    return {
      id: session.id,
      tool: session.tool,
      source_id: session.sourceId,
      project_path: session.projectPath,
      project_name: session.projectName,
      git_branch: session.gitBranch,
      started_at: session.startedAt.getTime(),
      last_activity_at: session.lastActivityAt.getTime(),
      turn_count: session.turnCount,
      model: session.model,
      input_tokens: session.tokenUsage.inputTokens,
      output_tokens: session.tokenUsage.outputTokens,
      cache_read: session.tokenUsage.cacheReadTokens,
      cache_creation: session.tokenUsage.cacheCreationTokens,
      file_path: session.filePath,
      file_mtime: session.fileMtime,
      indexed_at: session.indexedAt.getTime(),
    };
  }

  private mapTurnToRow(turn: Turn): Row {
    return {
      id: turn.id,
      session_id: turn.sessionId,
      turn_index: turn.index,
      role: turn.role,
      content_text: turn.contentText,
      tool_calls: turn.toolCalls.length > 0 ? JSON.stringify(turn.toolCalls) : null,
      timestamp: turn.timestamp.getTime(),
    };
  }

  private mapRowToResult(row: SearchRow): SearchResult {
    return {
      sessionId: SessionId.from(row.session_id),
      turnId: TurnId.from(row.turn_id),
      snippet: row.snippet,
      projectName: row.project_name,
      tool: row.tool as Tool,
      lastActivityAt: new Date(row.last_activity_at),
      score: row.score,
    };
  }

  private toFtsQuery(text: string): string {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => `"${token.replace(/"/g, '""')}"`)
      .join(' AND ');
  }
}
