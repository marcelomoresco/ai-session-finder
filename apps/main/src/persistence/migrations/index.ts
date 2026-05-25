import type { Migration } from './Migrator';
import initialSql from './001_initial.sql?raw';
import vectorSql from './002_vector_search.sql?raw';

/** Core migrations applied on every connection. */
export const migrations: ReadonlyArray<Migration> = [
  { version: 1, name: '001_initial', sql: initialSql },
];

/**
 * Vector-search migration. Applied only when the sqlite-vec extension loads,
 * because it creates a `vec0` virtual table that needs the module registered.
 * Kept separate from `migrations` so createDatabase can compose it conditionally
 * (and so it applies later if extension support appears on a subsequent open).
 */
export const vectorMigration: Migration = {
  version: 2,
  name: '002_vector_search',
  sql: vectorSql,
};
