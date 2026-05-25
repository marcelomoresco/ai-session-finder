import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, DATABASE_FILENAME } from './createDatabase';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'asf-db-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createDatabase', () => {
  it('creates the database file and applies migrations', () => {
    const handle = createDatabase(dir);
    expect(existsSync(join(dir, DATABASE_FILENAME))).toBe(true);
    const table = handle.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
      .get();
    expect(table).toEqual({ name: 'sessions' });
    handle.close();
  });

  it('enables foreign keys on the connection', () => {
    const handle = createDatabase(dir);
    expect(handle.db.pragma('foreign_keys', { simple: true })).toBe(1);
    handle.close();
  });

  it('does not crash or re-apply migrations when the database already exists', () => {
    createDatabase(dir).close();
    const handle = createDatabase(dir);
    const count = handle.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get() as {
      c: number;
    };
    expect(count.c).toBe(1);
    handle.close();
  });

  it('has an idempotent close', () => {
    const handle = createDatabase(dir);
    handle.close();
    expect(() => {
      handle.close();
    }).not.toThrow();
  });
});
