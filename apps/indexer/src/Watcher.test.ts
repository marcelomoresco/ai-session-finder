import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { FsWatcher } from './Watcher';

let dir: string;
let watcher: FsWatcher | null;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'asf-watch-'));
  watcher = null;
});

afterEach(async () => {
  await watcher?.stop();
  rmSync(dir, { recursive: true, force: true });
});

const nextFileChanged = (w: FsWatcher): Promise<string> =>
  new Promise((resolve) => {
    w.once('fileChanged', (filePath) => resolve(filePath));
  });

describe('FsWatcher', () => {
  it('emits ready once the initial scan completes', async () => {
    watcher = new FsWatcher([dir], { debounceMs: 50 });
    const ready = once(watcher, 'ready');
    watcher.start();
    await expect(ready).resolves.toBeDefined();
  });

  it('emits fileChanged when a new file is created', async () => {
    watcher = new FsWatcher([dir], { debounceMs: 50 });
    watcher.start();
    await once(watcher, 'ready');

    const changed = nextFileChanged(watcher);
    const file = join(dir, 'session.jsonl');
    writeFileSync(file, 'hello');

    expect(await changed).toBe(file);
  });

  it('emits fileChanged when an existing watched file is modified', async () => {
    const file = join(dir, 'session.jsonl');
    writeFileSync(file, 'one line\n');
    watcher = new FsWatcher([dir], { debounceMs: 50 });
    watcher.start();
    await once(watcher, 'ready');

    const changed = nextFileChanged(watcher);
    writeFileSync(file, 'one line\nappended\n');

    expect(await changed).toBe(file);
  });

  it('stop() releases the watcher so no further events fire', async () => {
    watcher = new FsWatcher([dir], { debounceMs: 50 });
    watcher.start();
    await once(watcher, 'ready');
    await watcher.stop();

    let fired = false;
    watcher.on('fileChanged', () => {
      fired = true;
    });
    writeFileSync(join(dir, 'after.jsonl'), 'x');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fired).toBe(false);
  });
}, 15_000);
