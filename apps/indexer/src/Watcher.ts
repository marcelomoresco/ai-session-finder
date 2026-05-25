import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'node:events';

export interface WatcherEvents {
  /** A watched session file was created or changed. */
  fileChanged: [filePath: string];
  /** The initial scan finished; the watcher is now live. */
  ready: [];
  error: [error: Error];
}

export interface WatcherOptions {
  /** awaitWriteFinish stability window — coalesces rapid JSONL appends. */
  readonly debounceMs: number;
  /** Poll instead of native fs events — deterministic under heavy load (tests). */
  readonly usePolling?: boolean;
}

const DEFAULT_OPTIONS: WatcherOptions = { debounceMs: 500 };

/**
 * Watches source directories and emits a debounced `fileChanged` per add/change.
 *
 * Note: it deliberately does NOT ignore dotfiles — Claude and Codex sessions
 * live under `~/.claude` and `~/.codex`, so a dotfile filter would hide them.
 * Non-session files are harmless: the Pipeline's registry simply ignores paths
 * no source claims.
 */
export class FsWatcher extends EventEmitter<WatcherEvents> {
  private watcher: FSWatcher | null = null;

  constructor(
    private readonly paths: ReadonlyArray<string>,
    private readonly opts: WatcherOptions = DEFAULT_OPTIONS,
  ) {
    super();
  }

  start(): void {
    if (this.watcher) {
      return;
    }
    this.watcher = watch([...this.paths], {
      persistent: true,
      ignoreInitial: false,
      usePolling: this.opts.usePolling ?? false,
      interval: 100,
      awaitWriteFinish: { stabilityThreshold: this.opts.debounceMs, pollInterval: 100 },
    });

    this.watcher
      .on('add', (path) => this.emit('fileChanged', path))
      .on('change', (path) => this.emit('fileChanged', path))
      .on('ready', () => this.emit('ready'))
      .on('error', (err) => this.emit('error', err instanceof Error ? err : new Error(String(err))));
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }
}
