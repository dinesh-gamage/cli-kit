import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgressBar } from '../src/progress.js';
import { colorSupport } from '../src/ansi.js';
import { createMockWriteStream } from './helpers.js';

describe('progress bar (TTY)', () => {
  beforeEach(() => {
    colorSupport.enabled = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders format tokens correctly at 0%, 50%, and 100%', () => {
    const stream = createMockWriteStream(true);
    const bar = createProgressBar({ total: 10, stream, width: 10 });

    // 0%
    bar.update(0);
    expect(stream.data).toContain('0%');
    expect(stream.data).toContain('0/10');

    vi.advanceTimersByTime(100);
    stream.calls.length = 0;

    // 50%
    bar.update(5);
    expect(stream.data).toContain('50%');
    expect(stream.data).toContain('5/10');

    vi.advanceTimersByTime(100);
    stream.calls.length = 0;

    // 100% (auto-stops, always paints regardless of throttle)
    bar.update(10);
    expect(stream.data).toContain('100%');
    expect(stream.data).toContain('10/10');
    expect(stream.data.endsWith('\n')).toBe(true);
  });

  it('shows eta as — before enough samples exist', () => {
    const stream = createMockWriteStream(true);
    const bar = createProgressBar({ total: 10, stream, width: 10 });

    bar.update(1);
    expect(stream.data).toContain('eta —');
  });

  it('computes an eta once multiple samples are available', () => {
    const stream = createMockWriteStream(true);
    const bar = createProgressBar({ total: 100, stream, width: 10 });

    bar.update(1);
    vi.advanceTimersByTime(1000);
    stream.calls.length = 0;
    bar.update(11); // 10 items in ~1s => rate ~10/s => eta for 89 remaining ~ 8-9s

    expect(stream.data).toMatch(/eta \d+s/);
  });

  it('auto-stops and writes a trailing newline when reaching total', () => {
    const stream = createMockWriteStream(true);
    const bar = createProgressBar({ total: 3, stream, width: 5 });

    bar.tick();
    vi.advanceTimersByTime(100);
    bar.tick();
    vi.advanceTimersByTime(100);
    bar.tick(); // reaches total

    expect(bar.current).toBe(3);
    expect(stream.data.at(-1)).toBe('\n');
  });

  it('stop(finalText) clears the bar and prints a final line', () => {
    const stream = createMockWriteStream(true);
    const bar = createProgressBar({ total: 10, stream, width: 5 });

    bar.update(3);
    stream.calls.length = 0;
    bar.stop('cancelled');

    expect(stream.data).toContain('\x1b[2K');
    expect(stream.data).toContain('cancelled\n');
  });
});

describe('progress bar (non-TTY)', () => {
  beforeEach(() => {
    colorSupport.enabled = false;
  });

  it('prints exactly the 0/25/50/75/100 milestone lines when ticking 1-by-1 over a total of 8', () => {
    const stream = createMockWriteStream(false);
    const bar = createProgressBar({ total: 8, stream, label: 'work' });

    // constructor already emits the 0% start line
    for (let i = 0; i < 8; i++) {
      bar.tick();
    }

    const lines = stream.data.split('\n').filter(Boolean);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain('0%');
    expect(lines[0]).toContain('(0/8)');
    expect(lines[1]).toContain('25%');
    expect(lines[1]).toContain('(2/8)');
    expect(lines[2]).toContain('50%');
    expect(lines[2]).toContain('(4/8)');
    expect(lines[3]).toContain('75%');
    expect(lines[3]).toContain('(6/8)');
    expect(lines[4]).toContain('100%');
    expect(lines[4]).toContain('(8/8)');
    for (const line of lines) {
      expect(line).toContain('work');
    }
  });

  it('does not print cursor/clear codes in non-TTY mode', () => {
    const stream = createMockWriteStream(false);
    const bar = createProgressBar({ total: 4, stream });
    bar.tick();
    bar.tick(2);
    bar.tick();
    expect(stream.data).not.toContain('\r');
    expect(stream.data).not.toContain('\x1b[2K');
  });
});
