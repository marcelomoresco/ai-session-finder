import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCursorFixture } from '@asf/test-fixtures';
import { CursorVscdbReader } from './CursorVscdbReader';
import type { CursorComposerSession } from './CursorBubble';

async function collect(iterable: AsyncIterable<CursorComposerSession>): Promise<CursorComposerSession[]> {
  const out: CursorComposerSession[] = [];
  for await (const session of iterable) {
    out.push(session);
  }
  return out;
}

/** Builds a raw cursorDiskKV db from explicit rows (for edge cases). */
function buildDb(file: string, rows: ReadonlyArray<readonly [string, string]>): void {
  const db = new Database(file);
  db.exec('CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)');
  const insert = db.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)');
  for (const [key, value] of rows) {
    insert.run(key, Buffer.from(value, 'utf8'));
  }
  db.close();
}

describe('CursorVscdbReader', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asf-cursor-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads each composer with its id stripped and bubbles parsed', async () => {
    const file = join(dir, 'state.vscdb');
    createCursorFixture(file, { composerCount: 2, bubblesPerComposer: 3 });

    const sessions = await collect(new CursorVscdbReader(file).readSessions());
    expect(sessions.map((s) => s.composerId).sort()).toEqual(['comp-0', 'comp-1']);

    const first = sessions.find((s) => s.composerId === 'comp-0');
    expect(first?.bubbles).toHaveLength(3);
    expect(first?.meta.composerId).toBe('comp-0');
    expect(first?.bubbles[0]?.text).toBe('message 0-0');
  });

  it('sorts bubbles by createdAt ascending regardless of insertion order', async () => {
    const file = join(dir, 'state.vscdb');
    buildDb(file, [
      ['composerData:c', JSON.stringify({ composerId: 'c' })],
      ['bubbleId:c:b2', JSON.stringify({ createdAt: 3000, text: 'third' })],
      ['bubbleId:c:b0', JSON.stringify({ createdAt: 1000, text: 'first' })],
      ['bubbleId:c:b1', JSON.stringify({ createdAt: 2000, text: 'second' })],
    ]);

    const [session] = await collect(new CursorVscdbReader(file).readSessions());
    expect(session?.bubbles.map((b) => b.text)).toEqual(['first', 'second', 'third']);
  });

  it('skips composers whose metadata is not valid JSON', async () => {
    const file = join(dir, 'state.vscdb');
    buildDb(file, [
      ['composerData:bad', 'not-json{'],
      ['composerData:good', JSON.stringify({ composerId: 'good' })],
    ]);

    const sessions = await collect(new CursorVscdbReader(file).readSessions());
    expect(sessions.map((s) => s.composerId)).toEqual(['good']);
  });

  it('drops malformed bubbles but keeps the valid ones', async () => {
    const file = join(dir, 'state.vscdb');
    buildDb(file, [
      ['composerData:c', JSON.stringify({ composerId: 'c' })],
      ['bubbleId:c:ok', JSON.stringify({ createdAt: 1, text: 'ok' })],
      ['bubbleId:c:bad', 'broken'],
    ]);

    const [session] = await collect(new CursorVscdbReader(file).readSessions());
    expect(session?.bubbles).toHaveLength(1);
    expect(session?.bubbles[0]?.text).toBe('ok');
  });

  it('throws for a vscdb file that does not exist', async () => {
    const reader = new CursorVscdbReader(join(dir, 'missing.vscdb'));
    await expect(collect(reader.readSessions())).rejects.toThrow();
  });
});
