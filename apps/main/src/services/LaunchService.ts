import type { Session, SessionId } from '@asf/domain';
import type { SessionReader } from '../persistence/SessionReader';
import type { Logger } from '../observability/Logger';
import type { PreferredApp } from './Settings';

/** Runs an external command (no shell). The real impl uses child_process.execFile. */
export interface CommandRunner {
  run(command: string, args: ReadonlyArray<string>): Promise<void>;
}

/**
 * Focuses the window where a session is already running (its terminal tab or
 * editor window) instead of launching a new one. Platform-specific; left absent
 * on non-macOS so launch always falls back to resume.
 */
export interface WindowLocator {
  /** Brings the running session's window to the front. False if not running or not focusable. */
  focusRunning(session: Session): Promise<boolean>;
}

/** Wraps a value in single quotes for safe use inside a shell command string. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Escapes a string for embedding inside an AppleScript double-quoted literal. */
function appleScriptEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Actually resumes a session in its original tool on macOS:
 * - claude-code / codex-cli: opens Terminal and runs the resume command in the
 *   project directory.
 * - cursor: opens the project in Cursor.
 *
 * Inputs (project path, source id) are shell-quoted and AppleScript-escaped, so
 * paths with spaces/quotes can't break out of the command.
 */
export class LaunchService {
  constructor(
    private readonly reader: SessionReader,
    private readonly runner: CommandRunner,
    private readonly logger: Logger,
    private readonly locator?: WindowLocator,
  ) {}

  async launch(sessionId: SessionId, preferredApp: PreferredApp = 'terminal'): Promise<boolean> {
    const session = await this.reader.findById(sessionId);
    if (!session) {
      return false;
    }

    // Prefer focusing the window where the session is already running; only
    // launch a fresh terminal/app when it isn't (avoids spawning duplicates).
    if (this.locator && (await this.locator.focusRunning(session))) {
      this.logger.info({ sessionId, tool: session.tool }, 'launch.focused');
      return true;
    }

    if (session.tool === 'cursor') {
      const args = session.projectPath ? ['-a', 'Cursor', session.projectPath] : ['-a', 'Cursor'];
      await this.runner.run('open', args);
    } else {
      // Editors just open the project folder; terminals run the resume command.
      const editorApps: Partial<Record<PreferredApp, string>> = {
        vscode: 'Visual Studio Code',
        intellij: 'IntelliJ IDEA',
        cursor: 'Cursor',
      };
      const editorApp = editorApps[preferredApp];
      if (editorApp) {
        const args = session.projectPath ? ['-a', editorApp, session.projectPath] : ['-a', editorApp];
        await this.runner.run('open', args);
      } else {
        const resume =
          session.tool === 'claude-code'
            ? `claude --resume ${shellQuote(session.sourceId)}`
            : `codex resume ${shellQuote(session.sourceId)}`;
        const cd = session.projectPath ? `cd ${shellQuote(session.projectPath)} && ` : '';
        const command = appleScriptEscape(cd + resume);
        const script =
          preferredApp === 'iterm'
            ? `tell application "iTerm"\n  activate\n  create window with default profile\n  tell current session of current window\n    write text "${command}"\n  end tell\nend tell`
            : `tell application "Terminal"\n  do script "${command}"\n  activate\nend tell`;
        await this.runner.run('osascript', ['-e', script]);
      }
    }

    // Metadata only — never log session content.
    this.logger.info({ sessionId, tool: session.tool }, 'launch.run');
    return true;
  }
}
