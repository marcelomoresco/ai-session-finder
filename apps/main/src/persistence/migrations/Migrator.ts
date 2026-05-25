import type Database from 'better-sqlite3';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * Applies pending SQL migrations, tracked in a `schema_migrations` table.
 * Each migration runs in its own transaction, so a failure rolls that
 * migration back and leaves the database consistent.
 */
export class Migrator {
  constructor(
    private readonly db: Database.Database,
    private readonly migrations: ReadonlyArray<Migration>,
  ) {}

  run(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);

    const appliedRows = this.db.prepare('SELECT version FROM schema_migrations').all() as Array<{
      version: number;
    }>;
    const applied = new Set(appliedRows.map((row) => row.version));

    const pending = this.migrations
      .filter((migration) => !applied.has(migration.version))
      .sort((a, b) => a.version - b.version);

    const insert = this.db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
    );

    for (const migration of pending) {
      const apply = this.db.transaction(() => {
        this.db.exec(migration.sql);
        insert.run(migration.version, migration.name, Date.now());
      });
      apply();
    }
  }
}
