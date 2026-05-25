import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, createInMemoryDatabase, DATABASE_FILENAME } from './createDatabase';

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
    const first = createDatabase(dir);
    const firstCount = (
      first.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get() as { c: number }
    ).c;
    first.close();

    const handle = createDatabase(dir);
    const secondCount = (
      handle.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get() as { c: number }
    ).c;
    // Re-opening must not re-apply migrations, regardless of how many exist
    // (002 is conditional on the sqlite-vec extension being available).
    expect(secondCount).toBe(firstCount);
    expect(secondCount).toBeGreaterThanOrEqual(1);
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

describe('createDatabase — semantic search (sqlite-vec)', () => {
  it('loads sqlite-vec, applies migration 002, and flags semanticSearch enabled', () => {
    const handle = createDatabase(dir);

    expect(handle.semanticSearch).toBe(true);

    const version = handle.db.prepare('SELECT vec_version() AS v').get() as { v: string };
    expect(version.v.length).toBeGreaterThan(0);

    const table = handle.db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'vec_turns'")
      .get();
    expect(table).toEqual({ name: 'vec_turns' });

    handle.close();
  });

  it('falls back (no 002, no crash, semanticSearch disabled) when the extension fails to load', () => {
    const handle = createDatabase(dir, () => {
      throw new Error('sqlite-vec unsupported on this platform');
    });

    expect(handle.semanticSearch).toBe(false);

    const table = handle.db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'vec_turns'")
      .get();
    expect(table).toBeUndefined();

    // The vec0 functions must be absent when the extension never loaded.
    expect(() => handle.db.prepare('SELECT vec_version() AS v').get()).toThrow();

    handle.close();
  });
});

describe('createInMemoryDatabase', () => {
  it('opens an in-memory database with the schema and touches no file', () => {
    const handle = createInMemoryDatabase();
    const table = handle.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
      .get();
    expect(table).toEqual({ name: 'sessions' });
    expect(typeof handle.semanticSearch).toBe('boolean');
    handle.close();
  });
});
