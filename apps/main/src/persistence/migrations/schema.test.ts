import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { Migrator } from './Migrator';
import { migrations } from './index';

function objectNames(db: Database.Database): Set<string> {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

describe('001_initial schema', () => {
  it('creates the expected tables, indexes, and triggers', () => {
    const db = new Database(':memory:');
    new Migrator(db, migrations).run();

    const names = objectNames(db);
    for (const table of ['sessions', 'turns', 'files_touched', 'turns_fts']) {
      expect(names.has(table)).toBe(true);
    }
    for (const index of ['idx_sessions_project', 'idx_sessions_activity', 'idx_turns_session']) {
      expect(names.has(index)).toBe(true);
    }
    for (const trigger of ['turns_ai', 'turns_ad', 'turns_au']) {
      expect(names.has(trigger)).toBe(true);
    }
    db.close();
  });

  it('is idempotent across repeated runs', () => {
    const db = new Database(':memory:');
    const migrator = new Migrator(db, migrations);
    migrator.run();
    migrator.run();
    const count = db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get() as { c: number };
    expect(count.c).toBe(1);
    db.close();
  });

  it('enforces the tool CHECK constraint', () => {
    const db = new Database(':memory:');
    new Migrator(db, migrations).run();
    const insert = db.prepare(
      `INSERT INTO sessions (id, tool, source_id, started_at, last_activity_at, turn_count, file_path, file_mtime, indexed_at)
       VALUES ('s1', ?, 'src', 0, 0, 0, '/p', 0, 0)`,
    );
    expect(() => insert.run('not-a-tool')).toThrow();
    expect(() => insert.run('claude-code')).not.toThrow();
    db.close();
  });

  it('feeds the FTS index from turns via triggers', () => {
    const db = new Database(':memory:');
    new Migrator(db, migrations).run();
    db.prepare(
      `INSERT INTO sessions (id, tool, source_id, started_at, last_activity_at, turn_count, file_path, file_mtime, indexed_at)
       VALUES ('s1', 'claude-code', 'src', 0, 0, 1, '/p', 0, 0)`,
    ).run();
    db.prepare(
      `INSERT INTO turns (id, session_id, turn_index, role, content_text, timestamp)
       VALUES ('t1', 's1', 0, 'user', 'fix the race condition in the scheduler', 0)`,
    ).run();

    const hit = db
      .prepare("SELECT rowid FROM turns_fts WHERE turns_fts MATCH 'race'")
      .all() as Array<{ rowid: number }>;
    expect(hit).toHaveLength(1);
    db.close();
  });
});
