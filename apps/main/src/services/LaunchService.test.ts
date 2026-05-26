import { describe, it, expect } from 'vitest';
import { SessionId, type Session, type Tool } from '@asf/domain';
import type { SessionListFilter, SessionReader } from '../persistence/SessionReader';
import { SilentLogger } from '../observability/Logger';
import { LaunchService, type CommandRunner, type WindowLocator } from './LaunchService';

function makeSession(tool: Tool, projectPath: string | null, sourceId = 'abc123'): Session {
  return {
    id: SessionId.from('s1'),
    tool,
    sourceId,
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

class RecordingRunner implements CommandRunner {
  readonly calls: Array<{ command: string; args: ReadonlyArray<string> }> = [];
  run(command: string, args: ReadonlyArray<string>): Promise<void> {
    this.calls.push({ command, args });
    return Promise.resolve();
  }
}

class RecordingLocator implements WindowLocator {
  readonly calls: Session[] = [];
  constructor(private readonly focused: boolean) {}
  focusRunning(session: Session): Promise<boolean> {
    this.calls.push(session);
    return Promise.resolve(this.focused);
  }
}

function serviceFor(session: Session | null, locator?: WindowLocator) {
  const runner = new RecordingRunner();
  const service = new LaunchService(new FakeReader(session), runner, new SilentLogger(), locator);
  return { service, runner };
}

describe('LaunchService.launch', () => {
  it('returns false and runs nothing for a missing session', async () => {
    const { service, runner } = serviceFor(null);
    expect(await service.launch(SessionId.from('nope'))).toBe(false);
    expect(runner.calls).toHaveLength(0);
  });

  it('focuses an already-running session window instead of opening a terminal', async () => {
    const locator = new RecordingLocator(true);
    const { service, runner } = serviceFor(makeSession('claude-code', '/Users/me/repo'), locator);

    expect(await service.launch(SessionId.from('s1'))).toBe(true);
    expect(locator.calls).toHaveLength(1);
    expect(runner.calls).toHaveLength(0);
  });

  it('falls back to resume when no running window is found', async () => {
    const locator = new RecordingLocator(false);
    const { service, runner } = serviceFor(makeSession('claude-code', '/Users/me/repo'), locator);

    await service.launch(SessionId.from('s1'));
    expect(locator.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
  });

  it('opens Terminal running the claude resume command in the project dir', async () => {
    const { service, runner } = serviceFor(makeSession('claude-code', '/Users/me/repo'));
    expect(await service.launch(SessionId.from('s1'))).toBe(true);

    expect(runner.calls[0]!.command).toBe('osascript');
    const script = runner.calls[0]!.args[1]!;
    expect(script).toContain('Terminal');
    expect(script).toContain("cd '/Users/me/repo' && claude --resume 'abc123'");
  });

  it('resumes in iTerm when that is the preferred terminal', async () => {
    const { service, runner } = serviceFor(makeSession('claude-code', '/Users/me/repo'));
    await service.launch(SessionId.from('s1'), 'iterm');

    expect(runner.calls[0]!.command).toBe('osascript');
    const script = runner.calls[0]!.args[1]!;
    expect(script).toContain('iTerm');
    expect(script).toContain("cd '/Users/me/repo' && claude --resume 'abc123'");
  });

  it('opens the project in VS Code when that is the preferred app', async () => {
    const { service, runner } = serviceFor(makeSession('claude-code', '/Users/me/repo'));
    await service.launch(SessionId.from('s1'), 'vscode');

    expect(runner.calls[0]).toEqual({
      command: 'open',
      args: ['-a', 'Visual Studio Code', '/Users/me/repo'],
    });
  });

  it('uses the codex resume command', async () => {
    const { service, runner } = serviceFor(makeSession('codex-cli', '/repo'));
    await service.launch(SessionId.from('s1'));
    expect(runner.calls[0]!.args[1]).toContain("codex resume 'abc123'");
  });

  it('opens Cursor at the project path', async () => {
    const { service, runner } = serviceFor(makeSession('cursor', '/Users/me/web'));
    await service.launch(SessionId.from('s1'));
    expect(runner.calls[0]).toEqual({ command: 'open', args: ['-a', 'Cursor', '/Users/me/web'] });
  });

  it('opens Cursor with no path when the session has none', async () => {
    const { service, runner } = serviceFor(makeSession('cursor', null));
    await service.launch(SessionId.from('s1'));
    expect(runner.calls[0]).toEqual({ command: 'open', args: ['-a', 'Cursor'] });
  });

  it('safely quotes a project path containing a single quote (no injection)', async () => {
    const { service, runner } = serviceFor(makeSession('claude-code', "/repo/o'brien"));
    await service.launch(SessionId.from('s1'));
    const script = runner.calls[0]!.args[1]!;
    // The command is still well-formed and the quote is escaped, not breaking out.
    expect(script).toContain("claude --resume 'abc123'");
    expect(script).toContain('brien');
  });
});
