import * as sqliteVec from 'sqlite-vec';
import type Database from 'better-sqlite3';

/**
 * Loads the sqlite-vec extension into a connection, registering the `vec0`
 * virtual-table module and the `vec_*` SQL functions (e.g. `vec_version()`).
 *
 * Must run on every connection that touches `vec_turns`, not just at migration
 * time: the module is per-connection. Throws if the platform has no compatible
 * prebuilt binary — callers degrade gracefully (see createDatabase).
 */
export function loadSqliteVec(db: Database.Database): void {
  sqliteVec.load(db);
}
