import { describe, it, expect } from 'vitest';
import { SessionId, type Session, type Tool } from '@asf/domain';
import {
  parseProcesses,
  findCwdFromLsof,
  resolveApp,
  buildFocusCommand,
  MacWindowLocator,
} from './MacWindowLocator';

function session(tool: Tool, projectPath: string | null): Session {
  return {
    id: SessionId.from('s1'),
    tool,
    sourceId: 'abc',
    projectPath,
    projectName: null,
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

describe('parseProcesses', () => {
  it('parses pid, ppid, tty and a comm that may contain spaces/paths', () => {
    const out = [
      '16580 16560 ttys005 claude',
      ' 1239     1 ??       /Applications/Claude.app/Contents/MacOS/Claude',
      '95943 95900 ttys018 /opt/homebrew/bin/claude',
    ].join('\n');
    expect(parseProcesses(out)).toEqual([
      { pid: 16580, ppid: 16560, tty: 'ttys005', comm: 'claude' },
      { pid: 1239, ppid: 1, tty: '??', comm: '/Applications/Claude.app/Contents/MacOS/Claude' },
      { pid: 95943, ppid: 95900, tty: 'ttys018', comm: '/opt/homebrew/bin/claude' },
    ]);
  });
});

describe('findCwdFromLsof', () => {
  it('extracts the cwd path from lsof -Fn output', () => {
    expect(findCwdFromLsof('p16580\nfcwd\nn/Users/me/repo\n')).toBe('/Users/me/repo');
  });
  it('returns null when there is no name line', () => {
    expect(findCwdFromLsof('p16580\nfcwd\n')).toBeNull();
  });
});

describe('resolveApp', () => {
  function chain(comms: ReadonlyArray<string>) {
    const rows = comms.map((comm, i) => ({
      pid: 100 + i,
      ppid: i === 0 ? 1 : 100 + i - 1,
      tty: 'ttys001',
      comm,
    }));
    const byPid = new Map(rows.map((r) => [r.pid, r]));
    return { byPid, startPid: rows[rows.length - 1]!.pid };
  }

  it('detects VS Code from the .app path of an ancestor', () => {
    const { byPid, startPid } = chain([
      '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
      'login',
      'claude',
    ]);
    expect(resolveApp(byPid, startPid)).toEqual({ kind: 'vscode' });
  });

  it('detects Cursor', () => {
    const { byPid, startPid } = chain(['/Applications/Cursor.app/Contents/MacOS/Cursor', 'claude']);
    expect(resolveApp(byPid, startPid)).toEqual({ kind: 'cursor' });
  });

  it('detects Terminal.app', () => {
    const { byPid, startPid } = chain([
      '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal',
      'login',
      'claude',
    ]);
    expect(resolveApp(byPid, startPid)).toEqual({ kind: 'terminal' });
  });

  it('detects iTerm2', () => {
    const { byPid, startPid } = chain(['/Applications/iTerm.app/Contents/MacOS/iTerm2', 'claude']);
    expect(resolveApp(byPid, startPid)).toEqual({ kind: 'iterm' });
  });

  it('returns null for an unknown terminal', () => {
    const { byPid, startPid } = chain(['/usr/bin/login', 'claude']);
    expect(resolveApp(byPid, startPid)).toBeNull();
  });
});

describe('buildFocusCommand', () => {
  it('opens the VS Code workspace window for the project', () => {
    expect(buildFocusCommand({ kind: 'vscode' }, 'ttys005', '/repo')).toEqual({
      command: 'open',
      args: ['-a', 'Visual Studio Code', '/repo'],
    });
  });

  it('builds a Terminal AppleScript that selects the tab by tty', () => {
    const cmd = buildFocusCommand({ kind: 'terminal' }, 'ttys005', '/repo');
    expect(cmd?.command).toBe('osascript');
    expect(cmd?.args[1]).toContain('/dev/ttys005');
    expect(cmd?.args[1]).toContain('Terminal');
  });

  it('activates an unscriptable-but-known app by name', () => {
    expect(buildFocusCommand({ kind: 'app', name: 'Ghostty' }, 'ttys005', '/repo')).toEqual({
      command: 'open',
      args: ['-a', 'Ghostty'],
    });
  });
});

describe('MacWindowLocator.focusRunning', () => {
  it('focuses the VS Code window of a running claude session in the project', async () => {
    const calls: Array<{ cmd: string; args: ReadonlyArray<string> }> = [];
    const exec = (cmd: string, args: ReadonlyArray<string>): Promise<string> => {
      calls.push({ cmd, args });
      if (cmd === 'ps')
        return Promise.resolve(
          '500 400 ttys005 claude\n400 1 ?? /Applications/Visual Studio Code.app/Contents/MacOS/Electron',
        );
      if (cmd === 'lsof') return Promise.resolve('p500\nfcwd\nn/repo\n');
      return Promise.resolve('');
    };
    const ok = await new MacWindowLocator(exec).focusRunning(session('claude-code', '/repo'));
    expect(ok).toBe(true);
    expect(
      calls.some((c) => c.cmd === 'open' && c.args.includes('Visual Studio Code') && c.args.includes('/repo')),
    ).toBe(true);
  });

  it('returns false when no running claude matches the project dir', async () => {
    const exec = (cmd: string): Promise<string> =>
      Promise.resolve(cmd === 'ps' ? '500 400 ttys005 claude' : 'p500\nfcwd\nn/other\n');
    expect(await new MacWindowLocator(exec).focusRunning(session('claude-code', '/repo'))).toBe(false);
  });

  it('does not inspect processes for non-claude tools', async () => {
    let called = false;
    const exec = (): Promise<string> => {
      called = true;
      return Promise.resolve('');
    };
    expect(await new MacWindowLocator(exec).focusRunning(session('cursor', '/repo'))).toBe(false);
    expect(called).toBe(false);
  });

  it('falls back (returns false) when the running terminal is unknown', async () => {
    const exec = (cmd: string): Promise<string> =>
      Promise.resolve(cmd === 'ps' ? '500 400 ttys005 claude\n400 1 ?? /usr/bin/login' : 'p500\nfcwd\nn/repo\n');
    expect(await new MacWindowLocator(exec).focusRunning(session('claude-code', '/repo'))).toBe(false);
  });
});
