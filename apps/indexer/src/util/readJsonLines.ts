import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface JsonLineError {
  readonly line: number;
  readonly raw: string;
  readonly error: Error;
}

/**
 * Streams a JSONL file line by line, parsing each non-empty line. Broken lines
 * are reported through `onError` (when provided) and skipped, so a single
 * corrupt line never aborts the whole file. The file is read as a stream, not
 * loaded fully into memory.
 */
export async function* readJsonLines<T>(
  filePath: string,
  onError?: (err: JsonLineError) => void,
): AsyncGenerator<T> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  for await (const raw of rl) {
    lineNumber += 1;
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      const value = JSON.parse(trimmed) as T;
      yield value;
    } catch (error) {
      onError?.({ line: lineNumber, raw, error: error as Error });
    }
  }
}
