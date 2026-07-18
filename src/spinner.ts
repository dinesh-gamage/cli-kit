// Animated terminal spinner with graceful non-TTY fallback. Zero dependencies.

import { c } from './ansi.js';
import { symbols, spinnerFrames } from './symbols.js';

export interface SpinnerOptions {
  text?: string;
  stream?: NodeJS.WriteStream;
  frames?: string[];
  intervalMs?: number;
}

export interface Spinner {
  start(text?: string): Spinner;
  update(text: string): Spinner;
  succeed(text?: string): void;
  fail(text?: string): void;
  warn(text?: string): void;
  info(text?: string): void;
  stop(): void;
  log(line: string): Spinner;
  readonly isSpinning: boolean;
}

const CLEAR_LINE = '\x1b[2K\r';

class SpinnerImpl implements Spinner {
  private readonly stream: NodeJS.WriteStream;
  private readonly frames: string[];
  private readonly intervalMs: number;
  private text: string;
  private timer: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private spinning = false;

  constructor(opts: SpinnerOptions) {
    this.stream = opts.stream ?? process.stdout;
    this.frames = opts.frames && opts.frames.length > 0 ? opts.frames : spinnerFrames;
    this.intervalMs = opts.intervalMs ?? 80;
    this.text = opts.text ?? '';
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  private get isTty(): boolean {
    return !!this.stream.isTTY;
  }

  private render(): void {
    const frame = this.frames[this.frameIndex % this.frames.length];
    this.stream.write(CLEAR_LINE + `${c.cyan(frame)} ${this.text}`);
  }

  start(text?: string): Spinner {
    if (text !== undefined) this.text = text;

    if (this.spinning) {
      if (this.isTty) this.render();
      return this;
    }

    this.spinning = true;

    if (this.isTty) {
      this.frameIndex = 0;
      this.render();
      const timer = setInterval(() => {
        this.frameIndex++;
        this.render();
      }, this.intervalMs);
      timer.unref?.();
      this.timer = timer;
    } else {
      this.stream.write(`... ${this.text}\n`);
    }

    return this;
  }

  update(text: string): Spinner {
    this.text = text;
    if (this.spinning && this.isTty) this.render();
    return this;
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private resolve(symbol: string, colorFn: (s: string) => string, text?: string): void {
    const finalText = text ?? this.text;
    if (this.isTty) {
      this.stopTimer();
      this.stream.write(CLEAR_LINE);
    }
    this.stream.write(`${colorFn(symbol)} ${finalText}\n`);
    this.spinning = false;
  }

  succeed(text?: string): void {
    this.resolve(symbols.success, c.green, text);
  }

  fail(text?: string): void {
    this.resolve(symbols.error, c.red, text);
  }

  warn(text?: string): void {
    this.resolve(symbols.warning, c.yellow, text);
  }

  info(text?: string): void {
    this.resolve(symbols.info, c.blue, text);
  }

  stop(): void {
    if (this.isTty) {
      this.stopTimer();
      this.stream.write(CLEAR_LINE);
    }
    this.spinning = false;
  }

  log(line: string): Spinner {
    if (this.isTty && this.spinning) {
      this.stream.write(CLEAR_LINE);
      this.stream.write(line + '\n');
      this.render();
    } else {
      this.stream.write(line + '\n');
    }
    return this;
  }
}

export function createSpinner(textOrOpts?: string | SpinnerOptions): Spinner {
  const opts: SpinnerOptions = typeof textOrOpts === 'string' ? { text: textOrOpts } : textOrOpts ?? {};
  return new SpinnerImpl(opts);
}
