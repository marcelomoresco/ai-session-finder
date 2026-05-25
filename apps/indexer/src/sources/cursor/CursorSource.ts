import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tool } from '@asf/domain';
import type { RawSession } from '../RawSession';
import type { SessionSource } from '../SessionSource';
import { CursorVscdbReader } from './CursorVscdbReader';
import { composerToRawSession } from './cursorMapping';

const CURSOR_VSCDB = /\/Cursor\/User\/workspaceStorage\/[^/]+\/state\.vscdb$/;

export class CursorSource implements SessionSource {
  readonly tool: Tool = 'cursor';

  watchPaths(): ReadonlyArray<string> {
    return [
      join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage'),
    ];
  }

  matches(filePath: string): boolean {
    return CURSOR_VSCDB.test(filePath);
  }

  async *parse(filePath: string): AsyncIterable<RawSession> {
    const reader = new CursorVscdbReader(filePath);
    const ctx = {
      filePath,
      fileMtime: fileMtime(filePath),
      // workspace.json sits beside state.vscdb, inside the watched tree.
      projectPath: readProjectPath(dirname(filePath)),
    };

    for await (const session of reader.readSessions()) {
      yield composerToRawSession(session, ctx);
    }
  }
}

/**
 * Reads the project path Cursor records in `workspace.json` (`{ "folder": "file://..." }`).
 * Best-effort: the field is not spec-confirmed, so unknown shapes yield null.
 */
export function parseWorkspaceFolder(jsonText: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const folder = (parsed as Record<string, unknown>).folder;
  if (typeof folder !== 'string') {
    return null;
  }
  if (folder.startsWith('file://')) {
    try {
      return fileURLToPath(folder);
    } catch {
      return null;
    }
  }
  return folder;
}

function readProjectPath(dir: string): string | null {
  const workspaceFile = join(dir, 'workspace.json');
  if (!existsSync(workspaceFile)) {
    return null;
  }
  try {
    return parseWorkspaceFolder(readFileSync(workspaceFile, 'utf8'));
  } catch {
    return null;
  }
}

function fileMtime(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}
