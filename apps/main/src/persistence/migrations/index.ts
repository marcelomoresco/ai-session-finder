import type { Migration } from './Migrator';
import initialSql from './001_initial.sql?raw';

export const migrations: ReadonlyArray<Migration> = [
  { version: 1, name: '001_initial', sql: initialSql },
];
