import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonLines, type JsonLineError } from './readJsonLines';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'asf-jsonl-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name: string, content: string): string {
  const filePath = join(dir, name);
  writeFileSync(filePath, content);
  return filePath;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) {
    out.push(item);
  }
  return out;
}

describe('readJsonLines', () => {
  it('yields one parsed object per valid line', async () => {
    const file = write('a.jsonl', '{"n":1}\n{"n":2}\n{"n":3}\n');
    expect(await collect<{ n: number }>(readJsonLines(file))).toEqual([
      { n: 1 },
      { n: 2 },
      { n: 3 },
    ]);
  });

  it('skips empty and whitespace-only lines', async () => {
    const file = write('b.jsonl', '{"n":1}\n\n   \n{"n":2}\n');
    expect(await collect<{ n: number }>(readJsonLines(file))).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('parses a final line without a trailing newline', async () => {
    const file = write('c.jsonl', '{"n":1}\n{"n":2}');
    expect(await collect<{ n: number }>(readJsonLines(file))).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('reports broken lines via onError and keeps going', async () => {
    const file = write('d.jsonl', '{"n":1}\n{bad json}\n{"n":2}\n');
    const errors: JsonLineError[] = [];
    const rows = await collect<{ n: number }>(readJsonLines(file, (e) => errors.push(e)));
    expect(rows).toEqual([{ n: 1 }, { n: 2 }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.line).toBe(2);
    expect(errors[0]?.raw).toBe('{bad json}');
    expect(errors[0]?.error).toBeInstanceOf(Error);
  });

  it('tolerates broken lines with no onError handler', async () => {
    const file = write('e.jsonl', '{"n":1}\n{bad}\n{"n":2}\n');
    expect(await collect<{ n: number }>(readJsonLines(file))).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('throws when the file does not exist', async () => {
    await expect(collect(readJsonLines(join(dir, 'missing.jsonl')))).rejects.toThrow();
  });
});
