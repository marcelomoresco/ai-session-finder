import { execFile } from 'node:child_process';
import type { CommandRunner } from './LaunchService';

/** Runs a command via child_process.execFile (args are not shell-interpreted). */
export class NodeCommandRunner implements CommandRunner {
  run(command: string, args: ReadonlyArray<string>): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(command, [...args], (error) => {
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve();
        }
      });
    });
  }
}
