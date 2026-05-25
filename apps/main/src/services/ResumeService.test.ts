import { describe, it, expect } from 'vitest';
import { SessionId, type Session, type Tool } from '@asf/domain';
import type { SessionListFilter, SessionReader } from '../persistence/SessionReader';
import { ResumeService } from './ResumeService';

function makeSession(tool: Tool, projectPath: string | null): Session {
  return {
    id: SessionId.from('s1'),
    tool,
    sourceId: 'abc123',
    projectPath,
    projectName: projectPath ? 'repo' : null,
    gitBranch: null,
    startedAt: new Date(0),
    lastActivityAt: new Date(0),
    turnCount: 0,
    model: null,
    tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    filePath: '/s.jsonl',
    fileMtime: 0,
    indexedAt: new Date(0),
  };
}

class FakeReader implements SessionReader {
  constructor(private readonly session: Session | null) {}
  findById(): Promise<Session | null> {
    return Promise.resolve(this.session);
  }
  findByToolAndSourceId(): Promise<Session | null> {
    return Promise.resolve(this.session);
  }
  list(_filter: SessionListFilter): Promise<ReadonlyArray<Session>> {
    return Promise.resolve([]);
  }
  countAll(): Promise<number> {
    return Promise.resolve(0);
  }
}

const serviceFor = (session: Session | null) => new ResumeService(new FakeReader(session));

describe('ResumeService.buildCommand', () => {
  it('returns null for a missing session', async () => {
    expect(await serviceFor(null).buildCommand(SessionId.from('nope'))).toBeNull();
  });

  it('builds a claude-code resume command with the project cwd', async () => {
    const cmd = await serviceFor(makeSession('claude-code', '/repo')).buildCommand(
      SessionId.from('s1'),
    );
    expect(cmd?.command).toBe('claude --resume abc123');
    expect(cmd?.workingDirectory).toBe('/repo');
    expect(cmd?.hint.length).toBeGreaterThan(0);
  });

  it('builds a codex-cli resume command with the project cwd', async () => {
    const cmd = await serviceFor(makeSession('codex-cli', '/repo')).buildCommand(
      SessionId.from('s1'),
    );
    expect(cmd?.command).toBe('codex resume abc123');
    expect(cmd?.workingDirectory).toBe('/repo');
  });

  it('opens cursor at the project path when present', async () => {
    const cmd = await serviceFor(makeSession('cursor', '/repo')).buildCommand(SessionId.from('s1'));
    expect(cmd?.command).toBe('cursor "/repo"');
    expect(cmd?.workingDirectory).toBeNull();
  });

  it('falls back to bare cursor when there is no project path', async () => {
    const cmd = await serviceFor(makeSession('cursor', null)).buildCommand(SessionId.from('s1'));
    expect(cmd?.command).toBe('cursor');
    expect(cmd?.workingDirectory).toBeNull();
  });

  it('returns a command with no cwd for a claude-code session lacking a project path', async () => {
    const cmd = await serviceFor(makeSession('claude-code', null)).buildCommand(
      SessionId.from('s1'),
    );
    expect(cmd?.command).toBe('claude --resume abc123');
    expect(cmd?.workingDirectory).toBeNull();
  });
});
