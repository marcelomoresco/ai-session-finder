import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCursorFixture } from './createFixture';

interface Row {
  readonly key: string;
  readonly value: Buffer;
}

describe('createCursorFixture', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asf-cursorfx-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a cursorDiskKV table with one composerData row per composer', () => {
    const out = join(dir, 'state.vscdb');
    createCursorFixture(out, { composerCount: 2, bubblesPerComposer: 3 });

    const db = new Database(out, { readonly: true });
    const composers = db
      .prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'")
      .all() as Row[];
    const bubbles = db
      .prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
      .all() as Row[];

    expect(composers).toHaveLength(2);
    expect(bubbles).toHaveLength(6);
    const meta = JSON.parse(composers[0]!.value.toString('utf8')) as Record<string, unknown>;
    expect(typeof meta.composerId).toBe('string');
    db.close();
  });

  it('stores bubble values as JSON with a numeric createdAt under the composer key', () => {
    const out = join(dir, 'state.vscdb');
    createCursorFixture(out, { composerCount: 1, bubblesPerComposer: 2 });

    const db = new Database(out, { readonly: true });
    const row = db
      .prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:comp-0:%' LIMIT 1")
      .get() as Row | undefined;
    expect(row).toBeDefined();
    const bubble = JSON.parse(row!.value.toString('utf8')) as Record<string, unknown>;
    expect(typeof bubble.createdAt).toBe('number');
    db.close();
  });
});
