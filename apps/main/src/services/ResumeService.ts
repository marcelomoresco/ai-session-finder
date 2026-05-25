import type { SessionId } from '@asf/domain';
import type { SessionReader } from '../persistence/SessionReader';
import type { ResumeCommand } from './ResumeCommand';

const PROJECT_HINT = 'Run in terminal at the project directory';

/** Builds the command to resume a session in the tool that created it. */
export class ResumeService {
  constructor(private readonly reader: SessionReader) {}

  async buildCommand(sessionId: SessionId): Promise<ResumeCommand | null> {
    const session = await this.reader.findById(sessionId);
    if (!session) {
      return null;
    }

    switch (session.tool) {
      case 'claude-code':
        return {
          command: `claude --resume ${session.sourceId}`,
          workingDirectory: session.projectPath,
          hint: PROJECT_HINT,
        };
      case 'codex-cli':
        return {
          command: `codex resume ${session.sourceId}`,
          workingDirectory: session.projectPath,
          hint: PROJECT_HINT,
        };
      case 'cursor':
        return {
          command: session.projectPath ? `cursor "${session.projectPath}"` : 'cursor',
          workingDirectory: null,
          hint: 'Opens Cursor at the project; chat history is available in the sidebar',
        };
    }
  }
}
