import { execFile } from 'node:child_process';
import type { Session } from '@asf/domain';
import type { Logger } from '../observability/Logger';
import type { WindowLocator } from './LaunchService';

/** Runs a command and resolves its stdout. Errors resolve to '' (best-effort). */
export type Exec = (command: string, args: ReadonlyArray<string>) => Promise<string>;

export interface ProcRow {
  readonly pid: number;
  readonly ppid: number;
  readonly tty: string;
  readonly comm: string;
}

export type KnownApp =
  | { readonly kind: 'vscode' }
  | { readonly kind: 'cursor' }
  | { readonly kind: 'terminal' }
  | { readonly kind: 'iterm' }
  | { readonly kind: 'app'; readonly name: string };

/** Parses `ps -axo pid=,ppid=,tty=,comm=` output (comm may contain spaces/paths). */
export function parseProcesses(stdout: string): ProcRow[] {
  const rows: ProcRow[] = [];
  for (const line of stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/.exec(line);
    if (m) {
      rows.push({ pid: Number(m[1]), ppid: Number(m[2]), tty: m[3]!, comm: m[4]! });
    }
  }
  return rows;
}

/** Extracts the cwd path from `lsof -Fn` field output (the `n<path>` line). */
export function findCwdFromLsof(stdout: string): string | null {
  for (const line of stdout.split('\n')) {
    if (line.startsWith('n')) {
      return line.slice(1);
    }
  }
  return null;
}

function matchApp(comm: string): KnownApp | null {
  if (/\/iTerm\.app\//i.test(comm)) return { kind: 'iterm' };
  if (/\/Terminal\.app\//i.test(comm)) return { kind: 'terminal' };
  if (/\/Visual Studio Code(?: - Insiders)?\.app\//i.test(comm)) return { kind: 'vscode' };
  if (/\/Cursor\.app\//i.test(comm)) return { kind: 'cursor' };
  if (/\/Ghostty\.app\//i.test(comm)) return { kind: 'app', name: 'Ghostty' };
  if (/\/kitty\.app\//i.test(comm)) return { kind: 'app', name: 'kitty' };
  if (/\/WezTerm\.app\//i.test(comm)) return { kind: 'app', name: 'WezTerm' };
  if (/\/Warp\.app\//i.test(comm)) return { kind: 'app', name: 'Warp' };
  return null;
}

/** Walks the ppid chain from `startPid` and returns the first recognizable terminal/editor app. */
export function resolveApp(byPid: ReadonlyMap<number, ProcRow>, startPid: number): KnownApp | null {
  let pid = startPid;
  for (let hops = 0; hops < 30; hops++) {
    const row = byPid.get(pid);
    if (!row) return null;
    const app = matchApp(row.comm);
    if (app) return app;
    if (row.ppid <= 1 || row.ppid === pid) return null;
    pid = row.ppid;
  }
  return null;
}

function terminalScript(tty: string): string {
  return [
    'tell application "Terminal"',
    '  activate',
    '  repeat with w in windows',
    '    repeat with t in tabs of w',
    `      if tty of t is "/dev/${tty}" then`,
    '        set selected of t to true',
    '        set frontmost of w to true',
    '      end if',
    '    end repeat',
    '  end repeat',
    'end tell',
  ].join('\n');
}

function itermScript(tty: string): string {
  return [
    'tell application "iTerm"',
    '  activate',
    '  repeat with w in windows',
    '    repeat with t in tabs of w',
    '      repeat with s in sessions of t',
    `        if tty of s is "/dev/${tty}" then`,
    '          select w',
    '          select t',
    '        end if',
    '      end repeat',
    '    end repeat',
    '  end repeat',
    'end tell',
  ].join('\n');
}

export interface FocusCommand {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

/** Builds the OS command that brings the running session's window to the front. */
export function buildFocusCommand(app: KnownApp, tty: string, projectPath: string): FocusCommand | null {
  switch (app.kind) {
    case 'vscode':
      return { command: 'open', args: ['-a', 'Visual Studio Code', projectPath] };
    case 'cursor':
      return { command: 'open', args: ['-a', 'Cursor', projectPath] };
    case 'terminal':
      return { command: 'osascript', args: ['-e', terminalScript(tty)] };
    case 'iterm':
      return { command: 'osascript', args: ['-e', itermScript(tty)] };
    case 'app':
      return { command: 'open', args: ['-a', app.name] };
  }
}

function isClaudeCli(row: ProcRow): boolean {
  return /(^|\/)claude$/.test(row.comm) && /^ttys/.test(row.tty);
}

/**
 * Finds a live `claude` CLI whose working directory matches the session's project,
 * resolves the terminal/editor it runs in, and brings that window to the front.
 * Claude doesn't keep the session `.jsonl` open, so the match is by project cwd —
 * ambiguous if two sessions share a project (focuses one of them). Unknown
 * terminals return false so the caller falls back to a fresh resume.
 */
export class MacWindowLocator implements WindowLocator {
  constructor(
    private readonly exec: Exec,
    private readonly logger?: Logger,
  ) {}

  async focusRunning(session: Session): Promise<boolean> {
    if (session.tool !== 'claude-code' || !session.projectPath) {
      return false;
    }
    const projectPath = session.projectPath;
    try {
      const rows = parseProcesses(await this.exec('ps', ['-axo', 'pid=,ppid=,tty=,comm=']));
      const byPid = new Map<number, ProcRow>(rows.map((r) => [r.pid, r]));

      for (const proc of rows.filter(isClaudeCli)) {
        const cwd = findCwdFromLsof(
          await this.exec('lsof', ['-a', '-p', String(proc.pid), '-d', 'cwd', '-Fn']),
        );
        if (cwd !== projectPath) continue;

        const app = resolveApp(byPid, proc.pid);
        if (!app) continue;

        const cmd = buildFocusCommand(app, proc.tty, projectPath);
        if (!cmd) continue;

        await this.exec(cmd.command, cmd.args);
        this.logger?.info({ tool: session.tool, app: app.kind }, 'window.focused');
        return true;
      }
      return false;
    } catch (error) {
      this.logger?.info({ err: String(error) }, 'window.focus.failed');
      return false;
    }
  }
}

/** Real locator backed by `ps`/`lsof`/`osascript`/`open`. */
export function createMacWindowLocator(logger?: Logger): MacWindowLocator {
  const exec: Exec = (command, args) =>
    new Promise((resolve) => {
      execFile(command, [...args], { timeout: 5000, maxBuffer: 8_000_000 }, (_err, stdout) => {
        resolve(stdout ?? '');
      });
    });
  return new MacWindowLocator(exec, logger);
}
