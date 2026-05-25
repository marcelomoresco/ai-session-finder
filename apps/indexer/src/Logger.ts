/* eslint-disable no-console --
   ConsoleLogger is the single sanctioned place that writes to the console; all
   other code logs through the injected Logger abstraction. */

/** Structured leveled logger. Injected into the Pipeline so output can be
 *  redirected (worker → main) or silenced in tests. */
export interface Logger {
  info(message: string, meta?: Readonly<Record<string, unknown>>): void;
  warn(message: string, meta?: Readonly<Record<string, unknown>>): void;
  error(message: string, meta?: Readonly<Record<string, unknown>>): void;
  debug(message: string, meta?: Readonly<Record<string, unknown>>): void;
}

/** Writes to the console, forwarding optional structured metadata. */
export class ConsoleLogger implements Logger {
  info(message: string, meta?: Readonly<Record<string, unknown>>): void {
    if (meta) console.info(message, meta);
    else console.info(message);
  }
  warn(message: string, meta?: Readonly<Record<string, unknown>>): void {
    if (meta) console.warn(message, meta);
    else console.warn(message);
  }
  error(message: string, meta?: Readonly<Record<string, unknown>>): void {
    if (meta) console.error(message, meta);
    else console.error(message);
  }
  debug(message: string, meta?: Readonly<Record<string, unknown>>): void {
    if (meta) console.debug(message, meta);
    else console.debug(message);
  }
}

/** Discards everything. Default for unit tests. */
export class NoopLogger implements Logger {
  info(_message: string, _meta?: Readonly<Record<string, unknown>>): void {}
  warn(_message: string, _meta?: Readonly<Record<string, unknown>>): void {}
  error(_message: string, _meta?: Readonly<Record<string, unknown>>): void {}
  debug(_message: string, _meta?: Readonly<Record<string, unknown>>): void {}
}
