import { describe, it, expect, beforeEach } from 'vitest';
import { colorSupport, strip, visibleWidth, c } from '../src/ansi.js';
import { wrap, truncate, pad, indent, heading, box } from '../src/text.js';

beforeEach(() => {
  colorSupport.enabled = false;
});

describe('wrap', () => {
  it('word-wraps plain text', () => {
    expect(wrap('the quick brown fox', 10)).toBe('the quick\nbrown fox');
  });

  it('hard-breaks a word longer than width', () => {
    expect(wrap('supercalifragilistic', 6)).toBe('superc\nalifra\ngilist\nic');
  });

  it('preserves existing newlines', () => {
    expect(wrap('line one\nline two is long enough to wrap', 12)).toBe(
      'line one\nline two is\nlong enough\nto wrap'
    );
  });

  it('preserves blank lines', () => {
    expect(wrap('a\n\nb', 10)).toBe('a\n\nb');
  });

  it('wraps ANSI-styled text by visible width, not raw length', () => {
    colorSupport.enabled = true;
    const styled = c.red('hello') + ' ' + c.blue('world') + ' ' + 'foo';
    const result = wrap(styled, 11);
    const lines = result.split('\n');
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(11);
    }
    expect(strip(result).replace(/\n/g, ' ')).toBe('hello world foo');
  });

  it('passes through short text unchanged', () => {
    expect(wrap('hi', 20)).toBe('hi');
  });
});

describe('truncate', () => {
  it('passes shorter text through unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('passes text at exact width through unchanged', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends default ellipsis', () => {
    const result = truncate('hello world', 8);
    expect(visibleWidth(result)).toBeLessThanOrEqual(8);
    expect(result.endsWith('…')).toBe(true);
  });

  it('truncates with a custom ellipsis', () => {
    const result = truncate('hello world', 7, '...');
    expect(result).toBe('hell...');
  });

  it('truncates ANSI-styled text, ending with a reset and correct visible width', () => {
    colorSupport.enabled = true;
    const styled = c.red('hello world this is long');
    const result = truncate(styled, 10);
    expect(result.endsWith('\x1b[0m')).toBe(true);
    expect(visibleWidth(result)).toBeLessThanOrEqual(10);
  });

  it('handles width smaller than ellipsis', () => {
    const result = truncate('hello world', 1);
    expect(visibleWidth(result)).toBeLessThanOrEqual(1);
  });

  it('returns empty string for zero/negative width', () => {
    expect(truncate('hello', 0)).toBe('');
  });
});

describe('pad', () => {
  it('pads left-aligned (default) by appending fill on the right', () => {
    expect(pad('hi', 5)).toBe('hi   ');
  });

  it('pads right-aligned by prepending fill on the left', () => {
    expect(pad('hi', 5, 'right')).toBe('   hi');
  });

  it('pads center-aligned, splitting fill evenly', () => {
    expect(pad('hi', 6, 'center')).toBe('  hi  ');
    expect(pad('hi', 5, 'center')).toBe(' hi  ');
  });

  it('pads using visible width for ANSI-styled text', () => {
    colorSupport.enabled = true;
    const styled = c.red('hi');
    const result = pad(styled, 5);
    expect(visibleWidth(result)).toBe(5);
    expect(result.startsWith(styled)).toBe(true);
  });

  it('pads using visible width for wide characters', () => {
    expect(pad('日', 5)).toBe('日   ');
    expect(visibleWidth(pad('日', 5))).toBe(5);
  });

  it('returns text unchanged when already at or above width', () => {
    expect(pad('hello', 3)).toBe('hello');
  });

  it('supports a custom fill character', () => {
    expect(pad('hi', 5, 'left', '.')).toBe('hi...');
  });
});

describe('indent', () => {
  it('indents every line', () => {
    expect(indent('a\nb\nc', 2)).toBe('  a\n  b\n  c');
  });

  it('treats negative spaces as zero', () => {
    expect(indent('a', -3)).toBe('a');
  });
});

describe('heading', () => {
  it('underlines matching the text visible width', () => {
    colorSupport.enabled = true;
    const result = heading('Title');
    const [line1, line2] = result.split('\n');
    expect(strip(line1!)).toBe('Title');
    expect(visibleWidth(line2!)).toBe(5);
  });

  it('respects an explicit width override', () => {
    colorSupport.enabled = true;
    const result = heading('Hi', { width: 10 });
    const [, line2] = result.split('\n');
    expect(visibleWidth(line2!)).toBe(10);
  });
});

describe('box', () => {
  it('draws a plain box around single-line text (default padding 1)', () => {
    const result = box('hi');
    expect(result).toBe('╭────╮\n│    │\n│ hi │\n│    │\n╰────╯');
  });

  it('draws a box around multi-line content with equal-width borders', () => {
    const result = box('short\nlonger line');
    const lines = result.split('\n');
    const widths = new Set(lines.map((l) => visibleWidth(l)));
    expect(widths.size).toBe(1);
  });

  it('embeds a title in the top border', () => {
    const result = box('hi', { title: 'Info' });
    const lines = result.split('\n');
    expect(lines[0]).toContain('Info');
    expect(lines[0]!.startsWith('╭')).toBe(true);
    expect(lines[0]!.endsWith('╮')).toBe(true);
  });

  it('respects a custom padding', () => {
    const withPad0 = box('hi', { padding: 0 });
    const withPad2 = box('hi', { padding: 2 });
    expect(withPad0.split('\n').length).toBe(3);
    expect(withPad2.split('\n').length).toBe(7);
  });
});
