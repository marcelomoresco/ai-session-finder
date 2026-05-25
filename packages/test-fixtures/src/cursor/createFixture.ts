import Database from 'better-sqlite3';

export interface CursorFixtureOptions {
  readonly composerCount: number;
  readonly bubblesPerComposer: number;
}

/**
 * Generates a synthetic Cursor `state.vscdb` for tests: a `cursorDiskKV` table
 * with `composerData:<composerId>` and `bubbleId:<composerId>:<bubbleId>` rows.
 *
 * The JSON payloads mirror the (best-effort, unconfirmed) shape in
 * `CursorBubble` — `createdAt` is the only spec-confirmed field; `type`/`text`/
 * meta fields are educated guesses. Keep this generator and `CursorBubble` in
 * sync, and re-tune both once a real anonymized .vscdb is available (Rule 2/5).
 */
export function createCursorFixture(outPath: string, opts: CursorFixtureOptions): void {
  const db = new Database(outPath);
  try {
    db.exec('CREATE TABLE IF NOT EXISTS cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)');
    const insert = db.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)');
    const base = Date.UTC(2026, 4, 22, 10, 0, 0); // 2026-05-22T10:00:00.000Z

    const writeAll = db.transaction((): void => {
      for (let c = 0; c < opts.composerCount; c += 1) {
        const composerId = `comp-${c}`;
        const createdAt = base + c * 60_000;
        const meta = {
          composerId,
          name: `Session ${c}`,
          createdAt,
          lastUpdatedAt: createdAt + opts.bubblesPerComposer * 1000,
          model: 'test-model',
        };
        insert.run(`composerData:${composerId}`, Buffer.from(JSON.stringify(meta), 'utf8'));

        for (let b = 0; b < opts.bubblesPerComposer; b += 1) {
          const bubble = {
            createdAt: createdAt + b * 1000,
            type: b % 2 === 0 ? 1 : 2,
            text: `message ${c}-${b}`,
          };
          insert.run(
            `bubbleId:${composerId}:bub-${b}`,
            Buffer.from(JSON.stringify(bubble), 'utf8'),
          );
        }
      }
    });
    writeAll();
  } finally {
    db.close();
  }
}
