import type { SessionId } from '@asf/domain';
import type { SessionReader } from '../persistence/SessionReader';
import type { Logger } from '../observability/Logger';

/** Runs an external command (no shell). The real impl uses child_process.execFile. */
export interface CommandRunner {
  run(command: string, args: ReadonlyArray<string>): Promise<void>;
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
  ) {}

  async launch(sessionId: SessionId): Promise<boolean> {
    const session = await this.reader.findById(sessionId);
    if (!session) {
      return false;
    }

    if (session.tool === 'cursor') {
      const args = session.projectPath ? ['-a', 'Cursor', session.projectPath] : ['-a', 'Cursor'];
      await this.runner.run('open', args);
    } else {
      const resume =
        session.tool === 'claude-code'
          ? `claude --resume ${shellQuote(session.sourceId)}`
          : `codex resume ${shellQuote(session.sourceId)}`;
      const cd = session.projectPath ? `cd ${shellQuote(session.projectPath)} && ` : '';
      const script = `tell application "Terminal"\n  do script "${appleScriptEscape(cd + resume)}"\n  activate\nend tell`;
      await this.runner.run('osascript', ['-e', script]);
    }

    // Metadata only — never log session content.
    this.logger.info({ sessionId, tool: session.tool }, 'launch.run');
    return true;
  }
}
