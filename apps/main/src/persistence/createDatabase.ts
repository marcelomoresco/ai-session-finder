import { join } from 'node:path';
import Database from 'better-sqlite3';
import { Migrator } from './migrations/Migrator';
import { migrations } from './migrations/index';

export const DATABASE_FILENAME = 'ai-session-finder.db';

export interface DatabaseHandle {
  readonly db: Database.Database;
  close(): void;
}

/**
 * Opens (or creates) the application database under `userDataDir`, applies
 * pending migrations, and returns a handle. The caller injects the directory
 * (in the Electron main process: `app.getPath('userData')`) so this module
 * stays free of Electron and remains unit-testable.
 *
 * Connection PRAGMAs are set here, not in migrations: PRAGMA journal_mode
 * cannot run inside the transaction that wraps a migration.
 */
export function createDatabase(userDataDir: string): DatabaseHandle {
  const db = new Database(join(userDataDir, DATABASE_FILENAME));
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  new Migrator(db, migrations).run();

  return {
    db,
    close: () => {
      if (db.open) {
        db.close();
      }
    },
  };
}
