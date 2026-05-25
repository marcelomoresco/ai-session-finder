import { copyFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { z } from 'zod';
import {
  CursorBubbleSchema,
  CursorComposerMetaSchema,
  type CursorBubble,
  type CursorComposerSession,
} from './CursorBubble';

interface KvRow {
  readonly key: string;
  readonly value: Buffer;
}

interface OpenedDb {
  readonly db: Database.Database;
  /** Removes the temp copy, if `openSafely` had to make one. */
  readonly cleanup: () => void;
}

const COMPOSER_PREFIX = 'composerData:';

/**
 * Reads Cursor sessions out of a `state.vscdb` SQLite file. Each composer is one
 * session; its bubbles are the messages. Malformed rows are skipped rather than
 * throwing. If the live DB is locked (Cursor running), falls back to reading a
 * temp copy.
 */
export class CursorVscdbReader {
  constructor(private readonly filePath: string) {}

  // better-sqlite3 is synchronous, so there is nothing to await here; this
  // generator is async-shaped only to fit the streaming SessionSource contract
  // shared with the async file-based sources (and to keep try/finally cleanup).
  // eslint-disable-next-line @typescript-eslint/require-await
  async *readSessions(): AsyncGenerator<CursorComposerSession> {
    const { db, cleanup } = this.openSafely();
    try {
      const composerRows = db
        .prepare(`SELECT key, value FROM cursorDiskKV WHERE key LIKE '${COMPOSER_PREFIX}%'`)
        .all() as KvRow[];
      const bubbleStmt = db.prepare('SELECT key, value FROM cursorDiskKV WHERE key LIKE ?');

      for (const composerRow of composerRows) {
        const meta = parseRow(CursorComposerMetaSchema, composerRow.value);
        if (meta === null) {
          continue; // skip malformed composer metadata
        }
        const composerId = composerRow.key.slice(COMPOSER_PREFIX.length);

        const bubbleRows = bubbleStmt.all(`bubbleId:${composerId}:%`) as KvRow[];
        const bubbles = bubbleRows
          .map((row) => parseRow(CursorBubbleSchema, row.value))
          .filter((bubble): bubble is CursorBubble => bubble !== null)
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

        yield { composerId, meta, bubbles };
      }
    } finally {
      db.close();
      cleanup();
    }
  }

  /** Opens read-only; on failure (e.g. lock) copies to a temp file and opens that. */
  private openSafely(): OpenedDb {
    try {
      const db = new Database(this.filePath, { readonly: true, fileMustExist: true });
      return { db, cleanup: () => {} };
    } catch {
      const tmpPath = join(tmpdir(), `cursor-${randomUUID()}.vscdb`);
      copyFileSync(this.filePath, tmpPath);
      const db = new Database(tmpPath, { readonly: true });
      return {
        db,
        cleanup: () => {
          try {
            unlinkSync(tmpPath);
          } catch {
            // best-effort temp cleanup
          }
        },
      };
    }
  }
}

/** Parses a BLOB value as JSON and validates it; returns null on any failure. */
function parseRow<S extends z.ZodType>(schema: S, value: Buffer): z.infer<S> | null {
  let json: unknown;
  try {
    json = JSON.parse(value.toString('utf8'));
  } catch {
    return null;
  }
  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}
