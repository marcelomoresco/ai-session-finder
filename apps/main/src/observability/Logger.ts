import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import pino, { type Logger as PinoBase } from 'pino';

/**
 * Structured, leveled logger used across the main process. Pino-style
 * `(obj, msg?)` signature so structured metadata is the first argument.
 *
 * Always injected, never imported by services directly — the adapter shape lets
 * tests use SilentLogger and lets Pino be swapped without touching callers.
 *
 * PRIVACY: never log turn content (`contentText`) or other PII — metadata only.
 */
export interface Logger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

/** Adapts a Pino logger to the {@link Logger} interface. */
export class PinoLogger implements Logger {
  constructor(private readonly base: PinoBase) {}

  debug(obj: object, msg?: string): void {
    this.base.debug(obj, msg);
  }
  info(obj: object, msg?: string): void {
    this.base.info(obj, msg);
  }
  warn(obj: object, msg?: string): void {
    this.base.warn(obj, msg);
  }
  error(obj: object, msg?: string): void {
    this.base.error(obj, msg);
  }
  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.base.child(bindings));
  }
}

/** Discards everything. Default for tests so suites produce no log output. */
export class SilentLogger implements Logger {
  debug(_obj: object, _msg?: string): void {}
  info(_obj: object, _msg?: string): void {}
  warn(_obj: object, _msg?: string): void {}
  error(_obj: object, _msg?: string): void {}
  child(_bindings: Record<string, unknown>): Logger {
    return this;
  }
}

/**
 * Production logger writing to `~/Library/Logs/ai-session-finder/main.log`.
 * `logDir` is injectable so it can be redirected (e.g. in tests).
 */
export function createProductionLogger(
  logDir: string = join(homedir(), 'Library', 'Logs', 'ai-session-finder'),
): Logger {
  mkdirSync(logDir, { recursive: true });
  return new PinoLogger(pino({ level: 'info' }, pino.destination(join(logDir, 'main.log'))));
}
