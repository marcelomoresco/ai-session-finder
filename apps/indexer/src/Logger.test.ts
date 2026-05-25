import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConsoleLogger, NoopLogger } from './Logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConsoleLogger', () => {
  it('forwards each level to the matching console method', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const logger = new ConsoleLogger();
    logger.info('i');
    logger.info('i2', { a: 1 });
    logger.warn('w');
    logger.warn('w2', { b: 2 });
    logger.error('e', { code: 1 });
    logger.error('e2');
    logger.debug('d');
    logger.debug('d2', { c: 3 });

    expect(info).toHaveBeenCalledWith('i');
    expect(info).toHaveBeenCalledWith('i2', { a: 1 });
    expect(warn).toHaveBeenCalledWith('w');
    expect(warn).toHaveBeenCalledWith('w2', { b: 2 });
    expect(error).toHaveBeenCalledWith('e', { code: 1 });
    expect(error).toHaveBeenCalledWith('e2');
    expect(debug).toHaveBeenCalledWith('d');
    expect(debug).toHaveBeenCalledWith('d2', { c: 3 });
  });
});

describe('NoopLogger', () => {
  it('never throws and writes nothing', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = new NoopLogger();
    expect(() => {
      logger.info('x');
      logger.warn('x');
      logger.error('x');
      logger.debug('x');
    }).not.toThrow();
    expect(info).not.toHaveBeenCalled();
  });
});
