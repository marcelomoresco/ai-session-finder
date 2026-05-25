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
 * Shared setup for an opened connection: connection PRAGMAs (set here, not in
 * migrations — `journal_mode` can't run inside a migration's transaction),
 * best-effort sqlite-vec load, then migrations. A load failure degrades
 * gracefully: skip migration 002 and disable semantic search.
 */
function bootstrap(db: Database.Database, loadVec: SqliteVecLoader): DatabaseHandle {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

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

/**
 * Opens (or creates) the application database under `userDataDir`. The caller
 * injects the directory (Electron main: `app.getPath('userData')`) so this
 * module stays free of Electron and unit-testable.
 */
export function createDatabase(
  userDataDir: string,
  loadVec: SqliteVecLoader = loadSqliteVec,
): DatabaseHandle {
  return bootstrap(new Database(join(userDataDir, DATABASE_FILENAME)), loadVec);
}

/**
 * In-memory database — same schema and sqlite-vec behaviour as the file-backed
 * one, but touches no filesystem. For integration tests.
 */
export function createInMemoryDatabase(loadVec: SqliteVecLoader = loadSqliteVec): DatabaseHandle {
  return bootstrap(new Database(':memory:'), loadVec);
}
