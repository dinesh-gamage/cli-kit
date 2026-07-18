// Terminal progress bar with graceful non-TTY fallback. Zero dependencies.

import { c } from './ansi.js';
import { symbols } from './symbols.js';

export interface ProgressOptions {
  total: number;
  width?: number;
  format?: string;
  stream?: NodeJS.WriteStream;
  label?: string;
}

export interface ProgressBar {
  tick(delta?: number): void;
  update(current: number): void;
  stop(finalText?: string): void;
  readonly current: number;
}

const RENDER_THROTTLE_MS = 50;
const MILESTONES = [0, 25, 50, 75, 100];

function formatEta(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds) || seconds < 0) return 'eta —';
  const total = Math.round(seconds);
  if (total < 60) return `eta ${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `eta ${minutes}m ${rest}s`;
}

function renderBar(current: number, total: number, width: number): string {
  const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
  const filledLen = Math.round(ratio * width);
  const emptyLen = width - filledLen;
  const useAscii = symbols.line === '-';
  const filledChar = useAscii ? '#' : '█';
  const emptyChar = useAscii ? '-' : '░';
  return filledChar.repeat(filledLen) + c.dim(emptyChar.repeat(emptyLen));
}

class ProgressBarImpl implements ProgressBar {
  private readonly stream: NodeJS.WriteStream;
  private readonly total: number;
  private readonly width: number;
  private readonly format: string;
  private readonly label: string;

  private _current = 0;
  private lastRenderTime = 0;
  private samples: Array<{ t: number; v: number }> = [];
  private lastMilestone = -1;
  private finished = false;

  constructor(opts: ProgressOptions) {
    this.stream = opts.stream ?? process.stdout;
    this.total = opts.total;
    this.width = opts.width ?? 28;
    this.format = opts.format ?? '{bar} {pct} {current}/{total} {eta}';
    this.label = opts.label ?? '';

    if (!this.isTty) {
      this.paintNonTty();
    }
  }

  get current(): number {
    return this._current;
  }

  private get isTty(): boolean {
    return !!this.stream.isTTY;
  }

  private pushSample(v: number): void {
    const now = Date.now();
    this.samples.push({ t: now, v });
    const cutoff = now - 5000;
    while (this.samples.length > 1 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
    if (this.samples.length > 20) this.samples.shift();
  }

  private computeRate(): number | null {
    if (this.samples.length < 2) return null;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return null;
    const dv = last.v - first.v;
    if (dv <= 0) return null;
    return dv / dt;
  }

  private percent(): number {
    if (this.total <= 0) return 0;
    return Math.min(100, Math.round((this._current / this.total) * 100));
  }

  private buildLine(): string {
    const pct = this.percent();
    const rate = this.computeRate();
    const eta = rate ? (this.total - this._current) / rate : null;
    const tokens: Record<string, string> = {
      bar: renderBar(this._current, this.total, this.width),
      pct: `${String(pct).padStart(3)}%`,
      current: String(this._current),
      total: String(this.total),
      eta: formatEta(eta),
      rate: rate ? `${rate.toFixed(1)}/s` : '—/s',
      label: this.label,
    };
    return this.format.replace(/\{(\w+)\}/g, (match, key: string) => (key in tokens ? tokens[key] : match));
  }

  private paintTty(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastRenderTime < RENDER_THROTTLE_MS) return;
    this.lastRenderTime = now;
    this.stream.write('\x1b[2K\r' + this.buildLine());
  }

  private paintNonTty(): void {
    const pct = this.total > 0 ? Math.min(100, Math.floor((this._current / this.total) * 100)) : 0;
    let toPrint: number | null = null;
    for (const m of MILESTONES) {
      if (pct >= m && m > this.lastMilestone) toPrint = m;
    }
    if (toPrint === null) return;
    this.lastMilestone = toPrint;
    const labelPart = this.label ? `${this.label} ` : '';
    this.stream.write(`${labelPart}${toPrint}% (${this._current}/${this.total})\n`);
  }

  private maybeAutoFinish(): void {
    if (this.finished) return;
    if (this._current < this.total) return;
    this.finished = true;
    if (this.isTty) {
      this.paintTty(true);
      this.stream.write('\n');
    }
    // non-TTY 100% milestone (including its trailing newline) is already
    // emitted by the regular paintNonTty() call in update().
  }

  tick(delta = 1): void {
    this.update(this._current + delta);
  }

  update(current: number): void {
    this._current = Math.max(0, Math.min(this.total, current));
    this.pushSample(this._current);

    if (this.isTty) {
      this.paintTty(this._current >= this.total);
    } else {
      this.paintNonTty();
    }

    this.maybeAutoFinish();
  }

  stop(finalText?: string): void {
    if (this.isTty) {
      this.stream.write('\x1b[2K\r');
    }
    if (finalText !== undefined) {
      this.stream.write(finalText + '\n');
    }
    this.finished = true;
  }
}

export function createProgressBar(opts: ProgressOptions): ProgressBar {
  return new ProgressBarImpl(opts);
}
