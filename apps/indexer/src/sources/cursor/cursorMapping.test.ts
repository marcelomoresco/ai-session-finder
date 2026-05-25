import { describe, it, expect } from 'vitest';
import { composerToRawSession } from './cursorMapping';
import type { CursorComposerSession } from './CursorBubble';

const ctx = { filePath: '/ws/hash/state.vscdb', fileMtime: 42, projectPath: '/Users/x/proj' };

function session(partial: Partial<CursorComposerSession>): CursorComposerSession {
  return { composerId: 'comp-1', meta: {}, bubbles: [], ...partial };
}

describe('composerToRawSession', () => {
  it('maps composerId to sourceId and tags tool cursor', () => {
    const raw = composerToRawSession(session({ composerId: 'abc' }), ctx);
    expect(raw.tool).toBe('cursor');
    expect(raw.sourceId).toBe('abc');
    expect(raw.filePath).toBe('/ws/hash/state.vscdb');
    expect(raw.fileMtime).toBe(42);
  });

  it('derives projectName from projectPath, null when path is null', () => {
    expect(composerToRawSession(session({}), ctx).projectName).toBe('proj');
    const noPath = composerToRawSession(session({}), { ...ctx, projectPath: null });
    expect(noPath.projectPath).toBeNull();
    expect(noPath.projectName).toBeNull();
  });

  it('builds turns from bubbles in order, role from role string and text from text', () => {
    const raw = composerToRawSession(
      session({
        bubbles: [
          { createdAt: 1000, role: 'user', text: 'hello' },
          { createdAt: 2000, role: 'assistant', text: 'hi there' },
        ],
      }),
      ctx,
    );
    expect(raw.turns).toHaveLength(2);
    expect(raw.turns[0]).toMatchObject({ index: 0, role: 'user', contentText: 'hello' });
    expect(raw.turns[1]).toMatchObject({ index: 1, role: 'assistant', contentText: 'hi there' });
  });

  it('falls back to numeric type for role (1=user, 2=assistant)', () => {
    const raw = composerToRawSession(
      session({ bubbles: [{ createdAt: 1, type: 1 }, { createdAt: 2, type: 2 }] }),
      ctx,
    );
    expect(raw.turns[0]?.role).toBe('user');
    expect(raw.turns[1]?.role).toBe('assistant');
  });

  it('defaults role to assistant when neither role nor type present', () => {
    const raw = composerToRawSession(session({ bubbles: [{ createdAt: 1 }] }), ctx);
    expect(raw.turns[0]?.role).toBe('assistant');
  });

  it('uses richText when text is absent, empty string when both absent', () => {
    const raw = composerToRawSession(
      session({ bubbles: [{ createdAt: 1, richText: 'rich' }, { createdAt: 2 }] }),
      ctx,
    );
    expect(raw.turns[0]?.contentText).toBe('rich');
    expect(raw.turns[1]?.contentText).toBe('');
  });

  it('derives startedAt/lastActivityAt from earliest/latest bubble createdAt', () => {
    const raw = composerToRawSession(
      session({ bubbles: [{ createdAt: 3000 }, { createdAt: 1000 }, { createdAt: 2000 }] }),
      ctx,
    );
    expect(raw.startedAt.getTime()).toBe(1000);
    expect(raw.lastActivityAt.getTime()).toBe(3000);
  });

  it('falls back to meta timestamps when no bubbles have createdAt', () => {
    const raw = composerToRawSession(
      session({ meta: { createdAt: 5000, lastUpdatedAt: 9000 }, bubbles: [] }),
      ctx,
    );
    expect(raw.startedAt.getTime()).toBe(5000);
    expect(raw.lastActivityAt.getTime()).toBe(9000);
  });

  it('falls back to epoch when no timestamps anywhere', () => {
    const raw = composerToRawSession(session({}), ctx);
    expect(raw.startedAt.getTime()).toBe(0);
    expect(raw.lastActivityAt.getTime()).toBe(0);
  });

  it('takes model from meta and zeroes token usage (not exposed by Cursor)', () => {
    const raw = composerToRawSession(session({ meta: { model: 'claude-x' } }), ctx);
    expect(raw.model).toBe('claude-x');
    expect(raw.tokenUsage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
  });

  it('leaves model null and gitBranch null when meta lacks them', () => {
    const raw = composerToRawSession(session({}), ctx);
    expect(raw.model).toBeNull();
    expect(raw.gitBranch).toBeNull();
  });
});
