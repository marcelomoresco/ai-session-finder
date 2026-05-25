import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger as PinoBase } from 'pino';
import { PinoLogger, SilentLogger, createProductionLogger } from './Logger';

describe('SilentLogger', () => {
  it('never throws on any level and returns a logger from child', () => {
    const logger = new SilentLogger();
    expect(() => {
      logger.debug({ a: 1 });
      logger.info({ a: 1 }, 'msg');
      logger.warn({ a: 1 });
      logger.error({ a: 1 }, 'boom');
    }).not.toThrow();
    const child = logger.child({ scope: 'x' });
    expect(() => child.info({ a: 1 })).not.toThrow();
  });
});

describe('PinoLogger', () => {
  function fakePino() {
    const base = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    base.child.mockReturnValue(base);
    return base;
  }

  it('delegates every level to the wrapped pino instance', () => {
    const base = fakePino();
    const logger = new PinoLogger(base as unknown as PinoBase);

    logger.debug({ ms: 5 }, 'search.done');
    logger.info({ n: 1 });
    logger.warn({ w: 1 }, 'warned');
    logger.error({ e: 1 }, 'failed');

    expect(base.debug).toHaveBeenCalledWith({ ms: 5 }, 'search.done');
    expect(base.info).toHaveBeenCalledWith({ n: 1 }, undefined);
    expect(base.warn).toHaveBeenCalledWith({ w: 1 }, 'warned');
    expect(base.error).toHaveBeenCalledWith({ e: 1 }, 'failed');
  });

  it('child wraps pino.child and returns a Logger', () => {
    const base = fakePino();
    const logger = new PinoLogger(base as unknown as PinoBase);

    const child = logger.child({ scope: 'search' });

    expect(base.child).toHaveBeenCalledWith({ scope: 'search' });
    child.info({ x: 1 });
    expect(base.info).toHaveBeenCalledWith({ x: 1 }, undefined);
  });
});

describe('createProductionLogger', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asf-log-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the log directory and returns a working Logger', () => {
    const logger = createProductionLogger(dir);
    expect(existsSync(dir)).toBe(true);
    expect(() => logger.info({ boot: true }, 'started')).not.toThrow();
  });
});
