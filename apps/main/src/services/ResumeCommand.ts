/** A shell command (and context) for resuming a session in its original tool. */
export interface ResumeCommand {
  readonly command: string;
  readonly workingDirectory: string | null;
  readonly hint: string;
}
