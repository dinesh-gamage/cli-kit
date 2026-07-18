// Tiny mock WriteStream/ReadStream helpers for tests. Not a *.test.ts file itself.

import { Writable, Readable } from 'node:stream';

export interface MockWriteStream extends NodeJS.WriteStream {
  /** All written chunks concatenated. */
  data: string;
  /** Individual write() calls, in order. */
  calls: string[];
}

export function createMockWriteStream(isTTY: boolean, columns = 80): MockWriteStream {
  const calls: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      calls.push(chunk.toString());
      cb();
    },
  }) as unknown as MockWriteStream;

  Object.defineProperty(stream, 'isTTY', { value: isTTY, writable: true, configurable: true });
  Object.defineProperty(stream, 'columns', { value: columns, writable: true, configurable: true });
  Object.defineProperty(stream, 'calls', { value: calls, writable: false, configurable: true });
  Object.defineProperty(stream, 'data', {
    get() {
      return calls.join('');
    },
    configurable: true,
  });

  return stream;
}

export interface MockReadStream extends NodeJS.ReadStream {
  isRaw: boolean;
}

/** Minimal non-TTY readable stream stand-in (enough for isTTY checks). */
export function createMockReadStream(isTTY: boolean): MockReadStream {
  const stream = new Readable({
    read() {
      /* no-op */
    },
  }) as unknown as MockReadStream;

  Object.defineProperty(stream, 'isTTY', { value: isTTY, writable: true, configurable: true });
  stream.isRaw = false;
  stream.setRawMode = ((mode: boolean) => {
    stream.isRaw = mode;
    return stream;
  }) as unknown as MockReadStream['setRawMode'];

  return stream;
}
