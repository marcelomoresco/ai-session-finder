import type { SearchFilters } from '@asf/domain';
import type { SessionListFilter } from './SessionReader';

export const SELECT_SESSION_BY_ID = 'SELECT * FROM sessions WHERE id = ?';

export const SELECT_SESSION_BY_TOOL_SOURCE =
  'SELECT * FROM sessions WHERE tool = ? AND source_id = ?';

export const COUNT_SESSIONS = 'SELECT COUNT(*) AS count FROM sessions';

export const DELETE_SESSION = 'DELETE FROM sessions WHERE id = ?';

export const DELETE_TURNS_BY_SESSION = 'DELETE FROM turns WHERE session_id = ?';

export const SELECT_LAST_INDEXED_AT = 'SELECT MAX(indexed_at) AS lastSync FROM sessions';

export const DELETE_ALL_SESSIONS = 'DELETE FROM sessions';
export const DELETE_ALL_TURNS = 'DELETE FROM turns';
export const DELETE_ALL_FILES_TOUCHED = 'DELETE FROM files_touched';

export const UPSERT_SESSION = `
  INSERT INTO sessions (
    id, tool, source_id, project_path, project_name, git_branch,
    started_at, last_activity_at, turn_count, model,
    input_tokens, output_tokens, cache_read, cache_creation,
    file_path, file_mtime, indexed_at
  ) VALUES (
    @id, @tool, @source_id, @project_path, @project_name, @git_branch,
    @started_at, @last_activity_at, @turn_count, @model,
    @input_tokens, @output_tokens, @cache_read, @cache_creation,
    @file_path, @file_mtime, @indexed_at
  )
  ON CONFLICT(id) DO UPDATE SET
    project_path = excluded.project_path,
    project_name = excluded.project_name,
    git_branch = excluded.git_branch,
    last_activity_at = excluded.last_activity_at,
    turn_count = excluded.turn_count,
    model = excluded.model,
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    cache_read = excluded.cache_read,
    cache_creation = excluded.cache_creation,
    file_path = excluded.file_path,
    file_mtime = excluded.file_mtime,
    indexed_at = excluded.indexed_at
`;

export const INSERT_TURN = `
  INSERT INTO turns (id, session_id, turn_index, role, content_text, tool_calls, timestamp)
  VALUES (@id, @session_id, @turn_index, @role, @content_text, @tool_calls, @timestamp)
`;

export const INSERT_FILE_TOUCHED = `
  INSERT INTO files_touched (session_id, turn_id, file_path, operation)
  VALUES (?, ?, ?, ?)
`;

export const SELECT_TURNS_BY_SESSION = `
  SELECT id, session_id, turn_index, role, content_text, tool_calls, timestamp
  FROM turns WHERE session_id = ? ORDER BY turn_index
`;

export const SELECT_FILES_BY_TURN = `
  SELECT file_path, operation FROM files_touched WHERE turn_id = ?
`;

// ---- vec_turns (semantic search; requires the sqlite-vec extension) ----
// vec0 does not support INSERT OR REPLACE / UPSERT, so the repository upserts by
// DELETE-then-INSERT inside a transaction.

export const INSERT_VEC_TURN = `INSERT INTO vec_turns (turn_id, embedding) VALUES (?, ?)`;

export const DELETE_VEC_TURN = `DELETE FROM vec_turns WHERE turn_id = ?`;

export const DELETE_ALL_VEC_TURNS = `DELETE FROM vec_turns`;

export const SEARCH_VEC_TURNS = `
  SELECT turn_id, distance
  FROM vec_turns
  WHERE embedding MATCH ? AND k = ?
  ORDER BY distance
`;

export interface BuiltQuery {
  readonly sql: string;
  readonly params: Record<string, string | number>;
}

/** Appends the shared structured-filter clauses (tool / project / date) for the `s` alias. */
function appendSessionFilters(
  filters: SearchFilters,
  clauses: string[],
  params: Record<string, string | number>,
): void {
  if (filters.tools && filters.tools.length > 0) {
    const placeholders = filters.tools.map((tool, i) => {
      params[`tool${i}`] = tool;
      return `@tool${i}`;
    });
    clauses.push(`s.tool IN (${placeholders.join(', ')})`);
  }
  if (filters.projectPath !== undefined) {
    clauses.push('s.project_path = @projectPath');
    params['projectPath'] = filters.projectPath;
  }
  if (filters.after !== undefined) {
    clauses.push('s.last_activity_at >= @after');
    params['after'] = filters.after.getTime();
  }
  if (filters.before !== undefined) {
    clauses.push('s.last_activity_at <= @before');
    params['before'] = filters.before.getTime();
  }
}

export function buildListSessionsQuery(filter: SessionListFilter): BuiltQuery {
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};

  if (filter.tools && filter.tools.length > 0) {
    const placeholders = filter.tools.map((tool, i) => {
      params[`tool${i}`] = tool;
      return `@tool${i}`;
    });
    clauses.push(`tool IN (${placeholders.join(', ')})`);
  }
  if (filter.projectPath !== undefined) {
    clauses.push('project_path = @projectPath');
    params['projectPath'] = filter.projectPath;
  }

  params['limit'] = filter.limit ?? 100;
  params['offset'] = filter.offset ?? 0;

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return {
    sql: `SELECT * FROM sessions ${where} ORDER BY last_activity_at DESC LIMIT @limit OFFSET @offset`,
    params,
  };
}

export function buildSearchQuery(fts: string, filters: SearchFilters, limit: number): BuiltQuery {
  const clauses: string[] = ['turns_fts MATCH @fts'];
  const params: Record<string, string | number> = { fts, limit };

  appendSessionFilters(filters, clauses, params);

  return {
    sql: `
      SELECT
        s.id AS session_id,
        t.id AS turn_id,
        snippet(turns_fts, 0, '[', ']', '…', 12) AS snippet,
        s.project_name AS project_name,
        s.tool AS tool,
        s.last_activity_at AS last_activity_at,
        bm25(turns_fts) AS score
      FROM turns_fts
      JOIN turns t ON t.rowid = turns_fts.rowid
      JOIN sessions s ON s.id = t.session_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY score
      LIMIT @limit
    `,
    params,
  };
}

/**
 * Browses sessions (no full-text match) as one search-result row each, using the
 * session's latest turn for `turn_id`/snippet, newest activity first. The caller
 * supplies the recency window via `filters.after`.
 */
export function buildBrowseActiveQuery(filters: SearchFilters, limit: number): BuiltQuery {
  const clauses: string[] = [];
  const params: Record<string, string | number> = { limit };

  if (filters.tools && filters.tools.length > 0) {
    const placeholders = filters.tools.map((tool, i) => {
      params[`tool${i}`] = tool;
      return `@tool${i}`;
    });
    clauses.push(`s.tool IN (${placeholders.join(', ')})`);
  }
  if (filters.projectPath !== undefined) {
    clauses.push('s.project_path = @projectPath');
    params['projectPath'] = filters.projectPath;
  }
  if (filters.after !== undefined) {
    clauses.push('s.last_activity_at >= @after');
    params['after'] = filters.after.getTime();
  }
  if (filters.before !== undefined) {
    clauses.push('s.last_activity_at <= @before');
    params['before'] = filters.before.getTime();
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return {
    sql: `
      SELECT
        s.id AS session_id,
        t.id AS turn_id,
        substr(t.content_text, 1, 100) AS snippet,
        s.project_name AS project_name,
        s.tool AS tool,
        s.last_activity_at AS last_activity_at,
        0 AS score
      FROM sessions s
      JOIN turns t ON t.id = (
        SELECT id FROM turns WHERE session_id = s.id ORDER BY turn_index DESC LIMIT 1
      )
      ${where}
      ORDER BY s.last_activity_at DESC
      LIMIT @limit
    `,
    params,
  };
}
