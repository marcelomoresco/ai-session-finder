-- Initial schema. Connection PRAGMAs (journal_mode/synchronous/foreign_keys)
-- are set on the connection in createDatabase.ts, not here: PRAGMA journal_mode
-- cannot run inside the transaction that wraps a migration.

CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  tool              TEXT NOT NULL CHECK (tool IN ('claude-code','codex-cli','cursor')),
  source_id         TEXT NOT NULL,
  project_path      TEXT,
  project_name      TEXT,
  git_branch        TEXT,
  started_at        INTEGER NOT NULL,
  last_activity_at  INTEGER NOT NULL,
  turn_count        INTEGER NOT NULL,
  model             TEXT,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_read        INTEGER NOT NULL DEFAULT 0,
  cache_creation    INTEGER NOT NULL DEFAULT 0,
  file_path         TEXT NOT NULL,
  file_mtime        INTEGER NOT NULL,
  indexed_at        INTEGER NOT NULL,
  UNIQUE (tool, source_id)
);

CREATE INDEX idx_sessions_project ON sessions(project_path);
CREATE INDEX idx_sessions_activity ON sessions(last_activity_at DESC);
CREATE INDEX idx_sessions_tool ON sessions(tool);

CREATE TABLE turns (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index    INTEGER NOT NULL,
  role          TEXT NOT NULL,
  content_text  TEXT NOT NULL,
  tool_calls    TEXT,
  timestamp     INTEGER NOT NULL,
  UNIQUE (session_id, turn_index)
);

CREATE INDEX idx_turns_session ON turns(session_id, turn_index);

CREATE TABLE files_touched (
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_id     TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('read','write','edit')),
  PRIMARY KEY (turn_id, file_path)
);

CREATE INDEX idx_files_path ON files_touched(file_path);

CREATE VIRTUAL TABLE turns_fts USING fts5(
  content_text,
  content='turns',
  content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 2'
);

CREATE TRIGGER turns_ai AFTER INSERT ON turns BEGIN
  INSERT INTO turns_fts(rowid, content_text) VALUES (new.rowid, new.content_text);
END;
CREATE TRIGGER turns_ad AFTER DELETE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content_text) VALUES('delete', old.rowid, old.content_text);
END;
CREATE TRIGGER turns_au AFTER UPDATE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content_text) VALUES('delete', old.rowid, old.content_text);
  INSERT INTO turns_fts(rowid, content_text) VALUES (new.rowid, new.content_text);
END;
