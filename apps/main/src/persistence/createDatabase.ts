import { join } from 'node:path';
import Database from 'better-sqlite3';
import { Migrator } from './migrations/Migrator';
import { migrations, vectorMigration } from './migrations/index';
import { loadSqliteVec } from './extensions/loadSqliteVec';

export const DATABASE_FILENAME = 'ai-session-finder.db';

export interface DatabaseHandle {
  readonly db: Database.Database;
  /** True when sqlite-vec loaded and `vec_turns` is available for semantic search. */
  readonly semanticSearch: boolean;
  close(): void;
}

/**
 * Loads the sqlite-vec extension into a connection. Injectable so tests can
 * simulate an unsupported platform and so the default can be swapped at the
 * boundary without reaching into this module's internals.
 */
export type SqliteVecLoader = (db: Database.Database) => void;

/**
 * Opens (or creates) the application database under `userDataDir`, applies
 * pending migrations, and returns a handle. The caller injects the directory
 * (in the Electron main process: `app.getPath('userData')`) so this module
 * stays free of Electron and remains unit-testable.
 *
 * Connection PRAGMAs are set here, not in migrations: PRAGMA journal_mode
 * cannot run inside the transaction that wraps a migration.
 */
export function createDatabase(
  userDataDir: string,
  loadVec: SqliteVecLoader = loadSqliteVec,
): DatabaseHandle {
  const db = new Database(join(userDataDir, DATABASE_FILENAME));
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Load sqlite-vec BEFORE the Migrator so 002 can create the vec0 virtual
  // table, and on every open so vec_turns stays queryable (the module is
  // per-connection). A load failure (e.g. an Intel Mac without a compatible
  // prebuilt binary) degrades gracefully: skip 002 and disable semantic
  // search instead of crashing the app.
  let semanticSearch = false;
  try {
    loadVec(db);
    semanticSearch = true;
  } catch {
    semanticSearch = false;
  }

  const pending = semanticSearch ? [...migrations, vectorMigration] : migrations;
  new Migrator(db, pending).run();

  return {
    db,
    semanticSearch,
    close: () => {
      if (db.open) {
        db.close();
      }
    },
  };
}
