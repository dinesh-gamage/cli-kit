import { describe, it, expect, beforeEach } from 'vitest';
import { colorSupport, visibleWidth, c } from '../src/ansi.js';
import { renderTable } from '../src/table.js';

beforeEach(() => {
  colorSupport.enabled = false;
});

const people = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
];

describe('renderTable borders', () => {
  it('renders a single (box-drawing) border table', () => {
    expect(renderTable(people)).toBe(
      [
        '┌───────┬─────┐',
        '│ name  │ age │',
        '├───────┼─────┤',
        '│ Alice │  30 │',
        '│ Bob   │  25 │',
        '└───────┴─────┘',
      ].join('\n')
    );
  });

  it('renders a compact border (header underline, two-space gaps)', () => {
    expect(renderTable(people, { border: 'compact' })).toBe(
      ['name   age', '─────  ───', 'Alice   30', 'Bob     25'].join('\n')
    );
  });

  it('renders no border (plain single-space gaps)', () => {
    expect(renderTable(people, { border: 'none' })).toBe(
      ['name  age', 'Alice  30', 'Bob    25'].join('\n')
    );
  });
});

describe('renderTable alignment', () => {
  it('right-aligns a column when every value is numeric', () => {
    const result = renderTable(people);
    const rows = result.split('\n');
    // "age" column values are right-aligned against the header width.
    expect(rows[3]).toContain(' 30 │');
    expect(rows[4]).toContain(' 25 │');
  });

  it('left-aligns a column with mixed/non-numeric values', () => {
    const result = renderTable(people);
    const rows = result.split('\n');
    expect(rows[3]).toContain('Alice ');
  });

  it('honors an explicit align override', () => {
    const withLonger = [...people, { name: 'Christopher', age: 40 }];
    const result = renderTable(withLonger, {
      columns: [
        { key: 'name', align: 'right' },
        { key: 'age' },
      ],
    });
    const lines = result.split('\n');
    expect(lines[3]).toBe('│       Alice │  30 │');
  });
});

describe('renderTable index column', () => {
  it('prepends a dim 1-based index column', () => {
    const result = renderTable(people, { index: true });
    const lines = result.split('\n');
    expect(lines[0]).toBe('┌───┬───────┬─────┐');
    expect(lines[1]).toBe('│ # │ name  │ age │');
    expect(lines[3]).toBe('│ 1 │ Alice │  30 │');
    expect(lines[4]).toBe('│ 2 │ Bob   │  25 │');
  });
});

describe('renderTable null/undefined handling', () => {
  it('renders null and undefined as a dim em dash', () => {
    const result = renderTable([{ a: 1, b: null }, { a: 2, b: undefined }]);
    const lines = result.split('\n');
    expect(lines[3]).toBe('│ 1 │ — │');
    expect(lines[4]).toBe('│ 2 │ — │');
  });
});

describe('renderTable empty rows', () => {
  it('renders "(no rows)" with no columns given', () => {
    expect(renderTable([])).toBe('(no rows)');
  });

  it('renders the header plus a dim "(no rows)" line when columns are given', () => {
    const result = renderTable([], { columns: [{ key: 'name' }, { key: 'age' }] });
    const lines = result.split('\n');
    expect(lines[0]).toBe('┌──────┬─────┐');
    expect(lines[1]).toBe('│ name │ age │');
    expect(lines[lines.length - 1]).toBe('(no rows)');
  });
});

describe('renderTable fixed width + truncation', () => {
  it('truncates cell content to a fixed column width', () => {
    const result = renderTable([{ name: 'Alexandra Hamilton' }], {
      columns: [{ key: 'name', width: 8 }],
    });
    const lines = result.split('\n');
    expect(lines[3]).toBe('│ Alexand… │');
    for (const line of lines) expect(visibleWidth(line)).toBe(visibleWidth(lines[0]!));
  });
});

describe('renderTable maxWidth shrinking', () => {
  it('shrinks the widest column(s) with truncation to fit maxWidth', () => {
    const result = renderTable(
      [{ a: 'aaaaaaaaaaaaaaaaaaaa', b: 'bbbbbbbbbbbbbbbbbbbb', c: 'ccccccccccccccccc' }],
      { maxWidth: 30 }
    );
    for (const line of result.split('\n')) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(30);
    }
  });

  it('never shrinks a column below width 5', () => {
    const result = renderTable(
      [{ a: 'x'.repeat(50), b: 'y'.repeat(50), c: 'z'.repeat(50), d: 'w'.repeat(50) }],
      { maxWidth: 10 }
    );
    // With maxWidth impossible to satisfy, columns bottom out at width 5 each.
    const lines = result.split('\n');
    expect(lines[3]).toContain('xxxx…');
  });
});

describe('renderTable ANSI-styled cells', () => {
  it('accounts for ANSI styling when computing column width alignment', () => {
    colorSupport.enabled = true;
    const result = renderTable([
      { name: c.red('Alice'), age: 30 },
      { name: 'Bob', age: 25 },
    ]);
    colorSupport.enabled = false;
    const lines = result.split('\n');
    const widths = new Set(lines.map((l) => visibleWidth(l)));
    expect(widths.size).toBe(1);
  });
});
