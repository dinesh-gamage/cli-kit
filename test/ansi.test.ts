import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { c, colorSupport, strip, visibleWidth } from '../src/ansi.js';

describe('strip', () => {
  it('removes ANSI style sequences', () => {
    expect(strip('\x1b[31mred\x1b[39m')).toBe('red');
    expect(strip('\x1b[1m\x1b[4mbold-underline\x1b[24m\x1b[22m')).toBe('bold-underline');
  });

  it('leaves plain text unchanged', () => {
    expect(strip('plain text')).toBe('plain text');
  });
});

describe('visibleWidth', () => {
  it('measures plain ASCII', () => {
    expect(visibleWidth('hello')).toBe(5);
    expect(visibleWidth('')).toBe(0);
  });

  it('ignores ANSI codes in styled text', () => {
    expect(visibleWidth('\x1b[31mhello\x1b[39m')).toBe(5);
  });

  it('counts CJK characters as double-width', () => {
    expect(visibleWidth('日本語')).toBe(6);
  });

  it('counts emoji as double-width', () => {
    expect(visibleWidth('🚀')).toBe(2);
  });

  it('ignores combining marks', () => {
    // 'e' + combining acute accent (U+0301)
    expect(visibleWidth('é')).toBe(1);
  });
});

describe('c style chain', () => {
  const originalEnabled = colorSupport.enabled;

  beforeEach(() => {
    colorSupport.enabled = true;
  });

  afterEach(() => {
    colorSupport.enabled = originalEnabled;
  });

  it('produces expected codes when enabled', () => {
    expect(c.red('hi')).toBe('\x1b[31mhi\x1b[39m');
    expect(c.bold('hi')).toBe('\x1b[1mhi\x1b[22m');
  });

  it('chains multiple styles', () => {
    expect(c.red.bold('hi')).toBe('\x1b[31m\x1b[1mhi\x1b[22m\x1b[39m');
  });

  it('passes through unchanged when disabled', () => {
    colorSupport.enabled = false;
    expect(c.red('hi')).toBe('hi');
    expect(c.red.bold('hi')).toBe('hi');
  });

  it('wraps nested styles without disturbing the inner sequence', () => {
    const result = c.red(`a ${c.bold('b')} c`);
    expect(result).toBe('\x1b[31ma \x1b[1mb\x1b[22m c\x1b[39m');
    // Outer red open/close still bookend the whole string.
    expect(result.startsWith('\x1b[31m')).toBe(true);
    expect(result.endsWith('\x1b[39m')).toBe(true);
  });

  it('supports rgb/hex/ansi256', () => {
    expect(c.rgb(1, 2, 3)('x')).toBe('\x1b[38;2;1;2;3mx\x1b[39m');
    expect(c.hex('#ff0000')('x')).toBe('\x1b[38;2;255;0;0mx\x1b[39m');
    expect(c.ansi256(200)('x')).toBe('\x1b[38;5;200mx\x1b[39m');
  });
});
