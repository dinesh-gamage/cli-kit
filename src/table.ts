// ANSI-aware table renderer. Zero dependencies.

import { c, visibleWidth } from './ansi.js';
import { symbols } from './symbols.js';
import { pad, truncate } from './text.js';

type Align = 'left' | 'right' | 'center';
type Border = 'single' | 'compact' | 'none';
type Row = Record<string, unknown>;

export interface TableColumn {
  key: string;
  header?: string;
  align?: Align;
  width?: number;
  format?: (value: unknown, row: Row) => string;
}

export interface TableOptions {
  columns?: TableColumn[];
  border?: Border;
  headerStyle?: (s: string) => string;
  maxWidth?: number;
  index?: boolean;
}

interface ResolvedColumn {
  header: string;
  align: Align;
  width: number;
  fixedWidth: boolean;
  cells: string[];
}

interface BoxChars {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
  t: string;
  b: string;
  l: string;
  r: string;
  x: string;
}

const BOX_UNICODE: BoxChars = {
  tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', t: '┬', b: '┴', l: '├', r: '┤', x: '┼',
};
const BOX_ASCII: BoxChars = {
  tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', t: '+', b: '+', l: '+', r: '+', x: '+',
};

function deriveColumns(rows: Row[]): TableColumn[] {
  const seen = new Set<string>();
  const cols: TableColumn[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push({ key });
      }
    }
  }
  return cols;
}

function resolveColumns(rows: Row[], opts: TableOptions): ResolvedColumn[] {
  const columns = opts.columns ?? deriveColumns(rows);
  const resolved: ResolvedColumn[] = [];

  if (opts.index) {
    resolved.push({
      header: '#',
      align: 'right',
      width: 0,
      fixedWidth: false,
      cells: rows.map((_row, i) => c.dim(String(i + 1))),
    });
  }

  for (const col of columns) {
    const header = col.header ?? col.key;
    const rawValues = rows.map((row) => row[col.key]);
    const nonNil = rawValues.filter((v) => v !== null && v !== undefined);
    const allNumeric = nonNil.length > 0 && nonNil.every((v) => typeof v === 'number');
    const align: Align = col.align ?? (allNumeric ? 'right' : 'left');

    const cells = rows.map((row) => {
      const value = row[col.key];
      if (col.format) return col.format(value, row);
      if (value === null || value === undefined) return c.dim('—');
      return String(value);
    });

    resolved.push({
      header,
      align,
      width: col.width ?? 0,
      fixedWidth: col.width !== undefined,
      cells,
    });
  }

  for (const rc of resolved) {
    if (!rc.fixedWidth) {
      const headerWidth = visibleWidth(rc.header);
      const maxCellWidth = rc.cells.reduce((m, s) => Math.max(m, visibleWidth(s)), 0);
      rc.width = Math.max(headerWidth, maxCellWidth, 1);
    }
  }

  return resolved;
}

function totalWidth(widths: number[], border: Border): number {
  const n = widths.length;
  if (n === 0) return 0;
  if (border === 'single') return 1 + widths.reduce((s, w) => s + w + 3, 0);
  if (border === 'compact') return widths.reduce((s, w) => s + w, 0) + 2 * (n - 1);
  return widths.reduce((s, w) => s + w, 0) + (n - 1);
}

function fitWidths(cols: ResolvedColumn[], border: Border, maxWidth: number): void {
  const widths = cols.map((col) => col.width);
  const shrinkable = cols.map((col) => !col.fixedWidth);

  while (totalWidth(widths, border) > maxWidth) {
    let idx = -1;
    let best = -1;
    for (let i = 0; i < widths.length; i++) {
      if (shrinkable[i] && widths[i]! > 5 && widths[i]! > best) {
        best = widths[i]!;
        idx = i;
      }
    }
    if (idx === -1) break;
    widths[idx] -= 1;
  }

  cols.forEach((col, i) => {
    col.width = widths[i]!;
  });
}

function renderCell(raw: string, width: number, align: Align): string {
  return pad(truncate(raw, width), width, align);
}

function renderSingle(cols: ResolvedColumn[], rows: Row[], headerStyle: (s: string) => string, ascii: boolean): string[] {
  const bc = ascii ? BOX_ASCII : BOX_UNICODE;
  const top = bc.tl + cols.map((col) => bc.h.repeat(col.width + 2)).join(bc.t) + bc.tr;
  const sep = bc.l + cols.map((col) => bc.h.repeat(col.width + 2)).join(bc.x) + bc.r;
  const bottom = bc.bl + cols.map((col) => bc.h.repeat(col.width + 2)).join(bc.b) + bc.br;

  const headerRow =
    bc.v +
    cols
      .map((col) => ' ' + renderCell(headerStyle(col.header), col.width, col.align) + ' ')
      .join(bc.v) +
    bc.v;

  const lines = [top, headerRow, sep];
  for (let r = 0; r < rows.length; r++) {
    const rowLine =
      bc.v +
      cols.map((col) => ' ' + renderCell(col.cells[r]!, col.width, col.align) + ' ').join(bc.v) +
      bc.v;
    lines.push(rowLine);
  }
  lines.push(bottom);
  return lines;
}

function renderCompact(cols: ResolvedColumn[], rows: Row[], headerStyle: (s: string) => string): string[] {
  const headerLine = cols.map((col) => renderCell(headerStyle(col.header), col.width, col.align)).join('  ');
  const underline = cols.map((col) => c.dim(symbols.line.repeat(col.width))).join('  ');
  const lines = [headerLine, underline];
  for (let r = 0; r < rows.length; r++) {
    lines.push(cols.map((col) => renderCell(col.cells[r]!, col.width, col.align)).join('  '));
  }
  return lines;
}

function renderNone(cols: ResolvedColumn[], rows: Row[], headerStyle: (s: string) => string): string[] {
  const headerLine = cols.map((col) => renderCell(headerStyle(col.header), col.width, col.align)).join(' ');
  const lines = [headerLine];
  for (let r = 0; r < rows.length; r++) {
    lines.push(cols.map((col) => renderCell(col.cells[r]!, col.width, col.align)).join(' '));
  }
  return lines;
}

/** Render an array-of-objects as a text table. */
export function renderTable(rows: Row[], opts: TableOptions = {}): string {
  const border: Border = opts.border ?? 'single';
  const maxWidth = opts.maxWidth ?? (process.stdout.columns || 80);
  const headerStyle = opts.headerStyle ?? c.bold;

  const cols = resolveColumns(rows, opts);
  if (cols.length === 0) return c.dim('(no rows)');

  fitWidths(cols, border, maxWidth);
  const ascii = symbols.line === '-';

  let lines: string[];
  if (border === 'single') lines = renderSingle(cols, rows, headerStyle, ascii);
  else if (border === 'compact') lines = renderCompact(cols, rows, headerStyle);
  else lines = renderNone(cols, rows, headerStyle);

  if (rows.length === 0) lines.push(c.dim('(no rows)'));

  return lines.join('\n');
}

/** console.log(renderTable(...)) */
export function printTable(rows: Row[], opts?: TableOptions): void {
  console.log(renderTable(rows, opts));
}
