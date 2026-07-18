// Pure, ANSI-aware string formatting helpers. Zero dependencies.

import { c, strip, visibleWidth } from './ansi.js';
import { symbols } from './symbols.js';

type Align = 'left' | 'right' | 'center';

// ─── Tokenizer ────────────────────────────────────────────────────────────
// Breaks a string into an ordered stream of "char" tokens (one code point,
// with its rendered width) and "ansi" tokens (a raw escape sequence, width
// 0). Every helper below operates on this stream so that width math never
// misjudges ANSI bytes and truncation/wrapping never splits a sequence.

const ANSI_SEQ_RE = /\x1b\[[0-9;]*m/g;

interface CharTok {
  type: 'char';
  value: string;
  width: number;
}

interface AnsiTok {
  type: 'ansi';
  value: string;
}

type Tok = CharTok | AnsiTok;

function tokenize(text: string): Tok[] {
  const toks: Tok[] = [];
  const re = new RegExp(ANSI_SEQ_RE);
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const pushChars = (segment: string) => {
    for (const ch of segment) {
      toks.push({ type: 'char', value: ch, width: visibleWidth(ch) });
    }
  };
  while ((m = re.exec(text))) {
    pushChars(text.slice(lastIndex, m.index));
    toks.push({ type: 'ansi', value: m[0] });
    lastIndex = re.lastIndex;
  }
  pushChars(text.slice(lastIndex));
  return toks;
}

function renderToks(toks: Tok[]): string {
  let out = '';
  for (const t of toks) out += t.value;
  return out;
}

/** Slice tokens to at most maxWidth visible width, stopping at first overflow. */
function sliceToWidth(toks: Tok[], maxWidth: number): { text: string; width: number } {
  let text = '';
  let width = 0;
  for (const tok of toks) {
    if (tok.type === 'ansi') {
      text += tok.value;
      continue;
    }
    if (width + tok.width > maxWidth) break;
    text += tok.value;
    width += tok.width;
  }
  return { text, width };
}

/** Split tokens into successive chunks each at most maxWidth visible width. */
function chunkByWidth(toks: Tok[], maxWidth: number): { text: string; width: number }[] {
  const chunks: { text: string; width: number }[] = [];
  let text = '';
  let width = 0;
  for (const tok of toks) {
    if (tok.type === 'ansi') {
      text += tok.value;
      continue;
    }
    if (width > 0 && width + tok.width > maxWidth) {
      chunks.push({ text, width });
      text = '';
      width = 0;
    }
    text += tok.value;
    width += tok.width;
  }
  if (text !== '' || chunks.length === 0) chunks.push({ text, width });
  return chunks;
}

// ─── wrap ───────────────────────────────────────────────────────────────

interface Word {
  toks: Tok[];
  width: number;
}

function splitWords(toks: Tok[]): Word[] {
  const words: Word[] = [];
  let cur: Tok[] = [];
  let curWidth = 0;
  const flush = () => {
    if (cur.length > 0) {
      words.push({ toks: cur, width: curWidth });
      cur = [];
      curWidth = 0;
    }
  };
  for (const tok of toks) {
    if (tok.type === 'char' && tok.value === ' ') {
      flush();
      continue;
    }
    cur.push(tok);
    if (tok.type === 'char') curWidth += tok.width;
  }
  flush();
  return words;
}

function wrapLine(line: string, width: number): string[] {
  const words = splitWords(tokenize(line));
  if (words.length === 0) return [''];

  const result: string[] = [];
  let curToks: Tok[] = [];
  let curWidth = 0;
  const flush = () => {
    result.push(renderToks(curToks));
    curToks = [];
    curWidth = 0;
  };

  for (const word of words) {
    if (word.width > width) {
      if (curWidth > 0) flush();
      const chunks = chunkByWidth(word.toks, width);
      for (let i = 0; i < chunks.length - 1; i++) result.push(chunks[i]!.text);
      const last = chunks[chunks.length - 1]!;
      curToks = tokenize(last.text);
      curWidth = last.width;
      continue;
    }
    if (curWidth === 0) {
      curToks = [...word.toks];
      curWidth = word.width;
    } else if (curWidth + 1 + word.width <= width) {
      curToks.push({ type: 'char', value: ' ', width: 1 }, ...word.toks);
      curWidth += 1 + word.width;
    } else {
      flush();
      curToks = [...word.toks];
      curWidth = word.width;
    }
  }
  if (curWidth > 0 || curToks.length > 0) flush();
  return result;
}

/** Word-wrap text to `width` columns, preserving existing newlines. Words longer
 * than `width` are hard-broken. ANSI sequences are preserved on their line. */
export function wrap(text: string, width: number): string {
  const w = width > 0 ? width : 1;
  return text
    .split('\n')
    .flatMap((line) => wrapLine(line, w))
    .join('\n');
}

// ─── truncate ─────────────────────────────────────────────────────────────

/** Truncate `text` to `width` visible columns, appending an ellipsis when cut.
 * Never splits an ANSI sequence; re-closes styling with a reset if any was present. */
export function truncate(text: string, width: number, ellipsis: string = symbols.ellipsis): string {
  if (width <= 0) return '';
  if (visibleWidth(text) <= width) return text;

  const toks = tokenize(text);
  const hasAnsi = toks.some((t) => t.type === 'ansi');
  const ellipsisWidth = visibleWidth(ellipsis);

  if (ellipsisWidth >= width) {
    // Ellipsis itself doesn't fit; fall back to slicing the ellipsis text.
    let out = '';
    let w = 0;
    for (const ch of ellipsis) {
      const cw = visibleWidth(ch);
      if (w + cw > width) break;
      out += ch;
      w += cw;
    }
    return out;
  }

  const { text: sliced } = sliceToWidth(toks, width - ellipsisWidth);
  return sliced + ellipsis + (hasAnsi ? '\x1b[0m' : '');
}

// ─── pad ────────────────────────────────────────────────────────────────

function buildFill(fill: string, width: number): string {
  if (width <= 0) return '';
  const unit = fill.length > 0 ? fill : ' ';
  const unitWidth = visibleWidth(unit) || 1;
  let out = '';
  let cur = 0;
  while (cur < width) {
    out += unit;
    cur += unitWidth;
  }
  return sliceToWidth(tokenize(out), width).text;
}

/** Pad `text` to `width` visible columns using `fill` (default space). */
export function pad(text: string, width: number, align: Align = 'left', fill: string = ' '): string {
  const w = visibleWidth(text);
  if (w >= width) return text;
  const diff = width - w;
  if (align === 'right') return buildFill(fill, diff) + text;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return buildFill(fill, left) + text + buildFill(fill, right);
  }
  return text + buildFill(fill, diff);
}

// ─── indent ───────────────────────────────────────────────────────────────

/** Indent every line of `text` by `spaces` spaces. */
export function indent(text: string, spaces: number): string {
  const prefix = ' '.repeat(Math.max(0, spaces));
  return text
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
}

// ─── heading ──────────────────────────────────────────────────────────────

/** Bold heading followed by a dim underline of symbols.line. */
export function heading(text: string, opts?: { width?: number }): string {
  const width = opts?.width ?? visibleWidth(text);
  const line = symbols.line.repeat(Math.max(0, width));
  return `${c.bold(text)}\n${c.dim(line)}`;
}

// ─── box ────────────────────────────────────────────────────────────────

interface BoxChars {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
}

const BOX_UNICODE: BoxChars = { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' };
const BOX_ASCII: BoxChars = { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' };

function defaultTermWidth(): number {
  return process.stdout.columns || 80;
}

/** Rounded box around (possibly multi-line) text, with optional title and padding. */
export function box(
  text: string,
  opts?: { title?: string; padding?: number; width?: number; borderColor?: (s: string) => string }
): string {
  const ascii = symbols.line === '-';
  const chars = ascii ? BOX_ASCII : BOX_UNICODE;
  const padding = opts?.padding ?? 1;
  const color = opts?.borderColor ?? ((s: string) => s);
  const title = opts?.title;

  const cap = (opts?.width ?? defaultTermWidth() - 2) - 2 - padding * 2;
  const contentAreaWidth = Math.max(1, cap);

  const rawLines = text.split('\n').flatMap((line) => wrap(line, contentAreaWidth).split('\n'));

  const naturalContentWidth = Math.max(
    0,
    ...rawLines.map(visibleWidth),
    title ? visibleWidth(title) : 0
  );
  const finalContentWidth = Math.min(contentAreaWidth, Math.max(naturalContentWidth, 1));
  const innerWidth = finalContentWidth + padding * 2;

  const top = buildTopBorder(chars, innerWidth, title, color);
  const bottom = color(chars.bl + chars.h.repeat(innerWidth) + chars.br);
  const blank = color(chars.v) + ' '.repeat(innerWidth) + color(chars.v);
  const paddingLines = Array.from({ length: padding }, () => blank);
  const contentLines = rawLines.map(
    (line) =>
      color(chars.v) +
      ' '.repeat(padding) +
      pad(truncate(line, finalContentWidth), finalContentWidth) +
      ' '.repeat(padding) +
      color(chars.v)
  );

  return [top, ...paddingLines, ...contentLines, ...paddingLines, bottom].join('\n');
}

function buildTopBorder(
  chars: BoxChars,
  innerWidth: number,
  title: string | undefined,
  color: (s: string) => string
): string {
  if (!title) return color(chars.tl + chars.h.repeat(innerWidth) + chars.tr);

  const label = ` ${strip(title)} `;
  const labelWidth = visibleWidth(label);
  const leftDashes = 1;
  const rightDashes = Math.max(0, innerWidth - leftDashes - labelWidth);
  return (
    color(chars.tl + chars.h.repeat(leftDashes)) +
    label +
    color(chars.h.repeat(rightDashes) + chars.tr)
  );
}
