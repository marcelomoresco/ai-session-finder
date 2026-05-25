import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { Migrator } from './Migrator';

interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

function appliedVersions(db: Database.Database): number[] {
  const rows = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  return rows.map((row) => row.version);
}

describe('Migrator', () => {
  it('applies pending migrations and records them', () => {
    const db = new Database(':memory:');
    const migrations: Migration[] = [
      { version: 1, name: 'create_foo', sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' },
    ];

    new Migrator(db, migrations).run();

    expect(appliedVersions(db)).toEqual([1]);
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='foo'")
      .get();
    expect(table).toEqual({ name: 'foo' });
    db.close();
  });

  it('records an applied_at timestamp', () => {
    const db = new Database(':memory:');
    new Migrator(db, [{ version: 1, name: 'm', sql: 'CREATE TABLE t (id INTEGER);' }]).run();
    const row = db.prepare('SELECT applied_at FROM schema_migrations WHERE version = 1').get() as {
      applied_at: number;
    };
    expect(row.applied_at).toBeGreaterThan(0);
    db.close();
  });

  it('is idempotent across repeated runs', () => {
    const db = new Database(':memory:');
    const migrations: Migration[] = [
      { version: 1, name: 'create_foo', sql: 'CREATE TABLE foo (id INTEGER);' },
    ];
    const migrator = new Migrator(db, migrations);

    migrator.run();
    migrator.run();

    const count = db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get() as { c: number };
    expect(count.c).toBe(1);
    db.close();
  });

  it('applies migrations in ascending version order', () => {
    const db = new Database(':memory:');
    const migrations: Migration[] = [
      { version: 2, name: 'b', sql: 'CREATE TABLE b (id INTEGER);' },
      { version: 1, name: 'a', sql: 'CREATE TABLE a (id INTEGER);' },
    ];

    new Migrator(db, migrations).run();

    expect(appliedVersions(db)).toEqual([1, 2]);
    db.close();
  });

  it('rolls back a failing migration atomically, leaving the DB consistent', () => {
    const db = new Database(':memory:');
    const migrations: Migration[] = [
      { version: 1, name: 'good', sql: 'CREATE TABLE good (id INTEGER);' },
      {
        version: 2,
        name: 'bad',
        sql: 'CREATE TABLE temp_bad (id INTEGER); CREATE TABLE good (id INTEGER);',
      },
    ];

    expect(() => new Migrator(db, migrations).run()).toThrow();

    // v1 committed; v2 fully rolled back.
    expect(appliedVersions(db)).toEqual([1]);
    const tempBad = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='temp_bad'")
      .get();
    expect(tempBad).toBeUndefined();
    db.close();
  });
});
