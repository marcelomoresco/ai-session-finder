/**
 * Claude Code encodes the working directory in the folder name by replacing `/`
 * with `-`. The mapping is ambiguous (an original `-` is indistinguishable from
 * a separator), so this is only a fallback — prefer the `cwd` from the first
 * JSONL event. `-Users-marcelo-foo` → `/Users/marcelo/foo`.
 */
export function decodeCwdFromDir(dirName: string): string {
  return '/' + dirName.replace(/^-/, '').replaceAll('-', '/');
}
