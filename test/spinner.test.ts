import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSpinner } from '../src/spinner.js';
import { colorSupport } from '../src/ansi.js';
import { createMockWriteStream } from './helpers.js';

describe('spinner (non-TTY)', () => {
  beforeEach(() => {
    colorSupport.enabled = false;
  });

  it('prints the start line once and nothing on update', () => {
    const stream = createMockWriteStream(false);
    const spinner = createSpinner({ text: 'working', stream });

    spinner.start();
    expect(stream.calls).toEqual(['... working\n']);

    spinner.update('still working');
    expect(stream.calls).toEqual(['... working\n']);
  });

  it('succeed prints a green-check style line with no cursor codes', () => {
    const stream = createMockWriteStream(false);
    const spinner = createSpinner({ text: 'working', stream });

    spinner.start();
    spinner.succeed('done');

    expect(stream.data).toContain('done');
    expect(stream.data).not.toContain('\r');
    expect(stream.data).not.toContain('\x1b[2K');
  });

  it('fail/warn/info also avoid cursor codes', () => {
    for (const method of ['fail', 'warn', 'info'] as const) {
      const stream = createMockWriteStream(false);
      const spinner = createSpinner({ text: 'x', stream });
      spinner.start();
      spinner[method]('result');
      expect(stream.data).not.toContain('\r');
      expect(stream.data).not.toContain('\x1b[2K');
    }
  });
});

describe('spinner (TTY)', () => {
  beforeEach(() => {
    colorSupport.enabled = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a frame with \\r on start and advances frames over time', () => {
    const stream = createMockWriteStream(true);
    const spinner = createSpinner({ text: 'loading', stream, intervalMs: 80 });

    spinner.start();
    expect(stream.data).toContain('\r');
    expect(stream.data).toContain('loading');

    const callsAfterStart = stream.calls.length;
    vi.advanceTimersByTime(80);
    expect(stream.calls.length).toBeGreaterThan(callsAfterStart);

    spinner.stop();
  });

  it('update() changes the rendered text', () => {
    const stream = createMockWriteStream(true);
    const spinner = createSpinner({ text: 'loading', stream });

    spinner.start();
    spinner.update('almost done');
    expect(stream.data).toContain('almost done');

    spinner.stop();
  });

  it('succeed clears the line and prints a final status, and stops the timer', () => {
    const stream = createMockWriteStream(true);
    const spinner = createSpinner({ text: 'loading', stream });

    spinner.start();
    spinner.succeed('all done');

    expect(stream.data).toContain('\x1b[2K');
    expect(stream.data).toContain('all done');
    expect(spinner.isSpinning).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop() clears the line with no lingering timer', () => {
    const stream = createMockWriteStream(true);
    const spinner = createSpinner({ text: 'loading', stream });

    spinner.start();
    spinner.stop();

    expect(vi.getTimerCount()).toBe(0);
    expect(spinner.isSpinning).toBe(false);
  });

  it('log() emits a permanent line and re-renders the spinner', () => {
    const stream = createMockWriteStream(true);
    const spinner = createSpinner({ text: 'loading', stream });

    spinner.start();
    const before = stream.calls.length;
    spinner.log('a permanent note');

    const written = stream.calls.slice(before).join('');
    expect(written).toContain('a permanent note\n');
    // Spinner frame should be re-rendered after the permanent line.
    expect(written).toContain('loading');

    spinner.stop();
  });
});
