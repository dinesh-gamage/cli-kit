// Interactive terminal prompts (readline-based) with non-TTY fallbacks. Zero dependencies.

import * as readline from 'node:readline';
import { c } from './ansi.js';
import { symbols } from './symbols.js';

export interface PromptIo {
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
}

interface ResolvedIo {
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
}

function resolveIo(opts?: PromptIo): ResolvedIo {
  return {
    input: opts?.input ?? process.stdin,
    output: opts?.output ?? process.stdout,
  };
}

function isInteractive(input: NodeJS.ReadStream): boolean {
  return !!input.isTTY;
}

function nonTtyError(question: string): Error {
  return new Error('Interactive prompt requires a TTY (no default provided): ' + question);
}

function showCursor(output: NodeJS.WriteStream): void {
  output.write('\x1b[?25h');
}

function hideCursor(output: NodeJS.WriteStream): void {
  output.write('\x1b[?25l');
}

// ─── input ────────────────────────────────────────────────────────────────

export async function input(
  question: string,
  opts?: { default?: string; validate?: (v: string) => string | null } & PromptIo
): Promise<string> {
  const { input: inp, output } = resolveIo(opts);

  if (!isInteractive(inp)) {
    if (opts?.default !== undefined) return opts.default;
    throw nonTtyError(question);
  }

  const rl = readline.createInterface({ input: inp, output, terminal: true });
  const suffix = opts?.default !== undefined ? c.dim(` (${opts.default})`) : '';

  try {
    for (;;) {
      const answer = await new Promise<string>((resolve) => {
        rl.question(`${question}${suffix} `, resolve);
      });
      const trimmed = answer.trim();
      const value = trimmed === '' && opts?.default !== undefined ? opts.default : answer;

      if (opts?.validate) {
        const err = opts.validate(value);
        if (err) {
          output.write(c.red(err) + '\n');
          continue;
        }
      }
      return value;
    }
  } finally {
    rl.close();
  }
}

// ─── password ────────────────────────────────────────────────────────────

export async function password(question: string, opts?: { mask?: string } & PromptIo): Promise<string> {
  const { input: inp, output } = resolveIo(opts);

  if (!isInteractive(inp)) {
    throw nonTtyError(question);
  }

  const mask = opts?.mask ?? '*';
  output.write(question + ' ');

  return new Promise<string>((resolve) => {
    let value = '';
    const wasRaw = !!inp.isRaw;

    readline.emitKeypressEvents(inp);
    inp.setRawMode?.(true);
    inp.resume();

    const cleanup = (): void => {
      inp.removeListener('data', onData);
      inp.setRawMode?.(wasRaw);
      inp.pause();
    };

    const onData = (chunk: Buffer): void => {
      const str = chunk.toString('utf8');
      for (const ch of str) {
        if (ch === '\r' || ch === '\n') {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        } else if (ch === '\u0003') {
          cleanup();
          showCursor(output);
          output.write('\n');
          process.exit(130);
        } else if (ch === '\u0008' || ch === '\u007f') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
        } else if (ch >= ' ') {
          value += ch;
          output.write(mask);
        }
      }
    };

    inp.on('data', onData);
  });
}

// ─── confirm ─────────────────────────────────────────────────────────────

export async function confirm(question: string, opts?: { default?: boolean } & PromptIo): Promise<boolean> {
  const { input: inp, output } = resolveIo(opts);

  if (!isInteractive(inp)) {
    if (opts?.default !== undefined) return opts.default;
    throw nonTtyError(question);
  }

  const def = opts?.default ?? false;
  const suffix = def ? ' (Y/n)' : ' (y/N)';
  const rl = readline.createInterface({ input: inp, output, terminal: true });

  try {
    for (;;) {
      const answer = await new Promise<string>((resolve) => {
        rl.question(`${question}${suffix} `, resolve);
      });
      const v = answer.trim().toLowerCase();
      if (v === '') return def;
      if (v === 'y' || v === 'yes') return true;
      if (v === 'n' || v === 'no') return false;
      // anything else: re-ask
    }
  } finally {
    rl.close();
  }
}

// ─── select / multiselect shared helpers ──────────────────────────────────

interface NormalizedChoice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

function normalizeChoices<T extends string>(
  choices: Array<T | { value: T; label?: string; hint?: string }>
): Array<NormalizedChoice<T>> {
  return choices.map((choice) => {
    if (typeof choice === 'string') {
      return { value: choice, label: choice };
    }
    return { value: choice.value, label: choice.label ?? choice.value, hint: choice.hint };
  });
}

function setupRawMode(inp: NodeJS.ReadStream): () => void {
  const wasRaw = !!inp.isRaw;
  readline.emitKeypressEvents(inp);
  inp.setRawMode?.(true);
  inp.resume();
  return () => {
    inp.setRawMode?.(wasRaw);
    inp.pause();
  };
}

// ─── select ────────────────────────────────────────────────────────────────

export async function select<T extends string>(
  question: string,
  choices: Array<T | { value: T; label?: string; hint?: string }>,
  opts?: { default?: T } & PromptIo
): Promise<T> {
  const { input: inp, output } = resolveIo(opts);
  const items = normalizeChoices(choices);

  if (!isInteractive(inp)) {
    if (opts?.default !== undefined) return opts.default;
    throw nonTtyError(question);
  }

  let index = 0;
  if (opts?.default !== undefined) {
    const foundIndex = items.findIndex((item) => item.value === opts.default);
    if (foundIndex >= 0) index = foundIndex;
  }

  output.write(question + '\n');

  const lineFor = (i: number): string => {
    const item = items[i];
    const isActive = i === index;
    const pointer = isActive ? c.cyan(symbols.pointer) : ' ';
    const label = isActive ? c.cyan(item.label) : item.label;
    const hint = item.hint ? ' ' + c.dim(item.hint) : '';
    return `${pointer} ${label}${hint}`;
  };

  let firstPaint = true;
  const paint = (): void => {
    if (!firstPaint) output.write(`\x1b[${items.length}A`);
    firstPaint = false;
    for (let i = 0; i < items.length; i++) {
      output.write('\x1b[2K' + lineFor(i) + '\n');
    }
  };

  hideCursor(output);
  paint();

  return new Promise<T>((resolve) => {
    const restore = setupRawMode(inp);

    const cleanup = (): void => {
      inp.removeListener('keypress', onKeypress);
      restore();
      showCursor(output);
    };

    const finish = (value: T): void => {
      cleanup();
      resolve(value);
    };

    const onKeypress = (str: string | undefined, key: readline.Key): void => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        output.write('\n');
        process.exit(130);
      }
      if (key.name === 'up') {
        index = (index - 1 + items.length) % items.length;
        paint();
      } else if (key.name === 'down') {
        index = (index + 1) % items.length;
        paint();
      } else if (key.name === 'return' || key.name === 'enter') {
        finish(items[index].value);
      } else if (str && /^[1-9]$/.test(str)) {
        const n = parseInt(str, 10) - 1;
        if (n < items.length) {
          index = n;
          paint();
          finish(items[index].value);
        }
      }
    };

    inp.on('keypress', onKeypress);
  });
}

// ─── multiselect ───────────────────────────────────────────────────────────

export async function multiselect<T extends string>(
  question: string,
  choices: Array<T | { value: T; label?: string }>,
  opts?: { default?: T[] } & PromptIo
): Promise<T[]> {
  const { input: inp, output } = resolveIo(opts);
  const items = normalizeChoices(choices);

  if (!isInteractive(inp)) {
    if (opts?.default !== undefined) return opts.default;
    throw nonTtyError(question);
  }

  const defaults = opts?.default ?? [];
  const selected = new Set<number>(
    items.reduce<number[]>((acc, item, i) => {
      if (defaults.includes(item.value)) acc.push(i);
      return acc;
    }, [])
  );

  let index = 0;
  output.write(question + c.dim(' (space to toggle, a to toggle all, enter to confirm)') + '\n');

  const lineFor = (i: number): string => {
    const item = items[i];
    const isActive = i === index;
    const pointer = isActive ? c.cyan(symbols.pointer) : ' ';
    const box = selected.has(i) ? symbols.checkboxOn : symbols.checkboxOff;
    const label = isActive ? c.cyan(item.label) : item.label;
    return `${pointer} ${box} ${label}`;
  };

  let firstPaint = true;
  const paint = (): void => {
    if (!firstPaint) output.write(`\x1b[${items.length}A`);
    firstPaint = false;
    for (let i = 0; i < items.length; i++) {
      output.write('\x1b[2K' + lineFor(i) + '\n');
    }
  };

  hideCursor(output);
  paint();

  return new Promise<T[]>((resolve) => {
    const restore = setupRawMode(inp);

    const cleanup = (): void => {
      inp.removeListener('keypress', onKeypress);
      restore();
      showCursor(output);
    };

    const finish = (): void => {
      cleanup();
      const result = items.filter((_, i) => selected.has(i)).map((item) => item.value);
      resolve(result);
    };

    const onKeypress = (str: string | undefined, key: readline.Key): void => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        output.write('\n');
        process.exit(130);
      }
      if (key.name === 'up') {
        index = (index - 1 + items.length) % items.length;
        paint();
      } else if (key.name === 'down') {
        index = (index + 1) % items.length;
        paint();
      } else if (key.name === 'space') {
        if (selected.has(index)) selected.delete(index);
        else selected.add(index);
        paint();
      } else if (str === 'a') {
        if (selected.size === items.length) {
          selected.clear();
        } else {
          for (let i = 0; i < items.length; i++) selected.add(i);
        }
        paint();
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
      }
    };

    inp.on('keypress', onKeypress);
  });
}
