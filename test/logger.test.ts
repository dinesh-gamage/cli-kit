import { describe, it, expect, beforeEach } from 'vitest';
import { createLogger } from '../src/logger.js';
import { colorSupport } from '../src/ansi.js';
import { createMockWriteStream } from './helpers.js';

describe('logger', () => {
  beforeEach(() => {
    colorSupport.enabled = false;
  });

  describe('level filtering matrix', () => {
    const cases: Array<{ level: 'debug' | 'info' | 'warn' | 'error' | 'silent'; expectCounts: Record<string, number> }> = [
      { level: 'debug', expectCounts: { debug: 1, info: 1, warn: 1, error: 1 } },
      { level: 'info', expectCounts: { debug: 0, info: 1, warn: 1, error: 1 } },
      { level: 'warn', expectCounts: { debug: 0, info: 0, warn: 1, error: 1 } },
      { level: 'error', expectCounts: { debug: 0, info: 0, warn: 0, error: 1 } },
      { level: 'silent', expectCounts: { debug: 0, info: 0, warn: 0, error: 0 } },
    ];

    for (const { level, expectCounts } of cases) {
      it(`level=${level}`, () => {
        const stream = createMockWriteStream(false);
        const errStream = createMockWriteStream(false);
        const logger = createLogger({ level, stream, errStream });

        logger.debug('debug-msg');
        logger.info('info-msg');
        logger.warn('warn-msg');
        logger.error('error-msg');

        expect(stream.calls.filter((l) => l.includes('debug-msg')).length).toBe(expectCounts.debug);
        expect(stream.calls.filter((l) => l.includes('info-msg')).length).toBe(expectCounts.info);
        expect(errStream.calls.filter((l) => l.includes('warn-msg')).length).toBe(expectCounts.warn);
        expect(errStream.calls.filter((l) => l.includes('error-msg')).length).toBe(expectCounts.error);
        expect(stream.calls.length).toBe(expectCounts.debug + expectCounts.info);
        expect(errStream.calls.length).toBe(expectCounts.warn + expectCounts.error);
      });
    }
  });

  it('success writes at info level with a checkmark-style prefix, to the main stream', () => {
    const stream = createMockWriteStream(false);
    const errStream = createMockWriteStream(false);
    const logger = createLogger({ level: 'info', stream, errStream });

    logger.success('all good');
    expect(stream.data).toContain('all good');
    expect(errStream.data).toBe('');

    const silentLogger = createLogger({ level: 'warn', stream, errStream });
    stream.calls.length = 0;
    silentLogger.success('should not print');
    expect(stream.data).toBe('');
  });

  it('warn and error go to errStream, not stream', () => {
    const stream = createMockWriteStream(false);
    const errStream = createMockWriteStream(false);
    const logger = createLogger({ level: 'debug', stream, errStream });

    logger.warn('careful');
    logger.error('boom');

    expect(stream.data).not.toContain('careful');
    expect(stream.data).not.toContain('boom');
    expect(errStream.data).toContain('careful');
    expect(errStream.data).toContain('boom');
  });

  it('child() nests prefixes as parent:child', () => {
    const stream = createMockWriteStream(false);
    const logger = createLogger({ level: 'info', stream, prefix: 'app' });
    const child = logger.child('db');

    child.info('connected');
    expect(stream.data).toContain('[app:db]');

    const grandchild = child.child('pool');
    stream.calls.length = 0;
    grandchild.info('ready');
    expect(stream.data).toContain('[app:db:pool]');
  });

  it('timestamps render as HH:MM:SS when enabled', () => {
    const stream = createMockWriteStream(false);
    const logger = createLogger({ level: 'info', stream, timestamps: true });

    logger.info('hello');
    expect(stream.data).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('debug output is only dim-styled (and only appears) at debug level', () => {
    colorSupport.enabled = true;
    const stream = createMockWriteStream(true);
    const debugLogger = createLogger({ level: 'debug', stream });

    debugLogger.debug('trace me');
    expect(stream.data).toContain('\x1b[2m'); // dim open code
    expect(stream.data).toContain('trace me');

    const infoStream = createMockWriteStream(false);
    const infoLogger = createLogger({ level: 'info', stream: infoStream });
    infoLogger.debug('hidden');
    expect(infoStream.data).toBe('');

    colorSupport.enabled = false;
  });
});
