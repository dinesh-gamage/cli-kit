// Leveled console logger with color, timestamps, and prefixing. Zero dependencies.

import * as util from 'node:util';
import { c, colorSupport } from './ansi.js';
import { symbols } from './symbols.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerOptions {
  level?: LogLevel;
  timestamps?: boolean;
  stream?: NodeJS.WriteStream;
  errStream?: NodeJS.WriteStream;
  prefix?: string;
}

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void;
  info(msg: string, ...rest: unknown[]): void;
  success(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
  child(prefix: string): Logger;
  level: LogLevel;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatRest(rest: unknown[]): string {
  if (rest.length === 0) return '';
  return ' ' + rest.map((r) => util.inspect(r, { colors: colorSupport.enabled })).join(' ');
}

class LoggerImpl implements Logger {
  level: LogLevel;
  private readonly timestamps: boolean;
  private readonly stream: NodeJS.WriteStream;
  private readonly errStream: NodeJS.WriteStream;
  private readonly prefix?: string;

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? 'info';
    this.timestamps = opts.timestamps ?? false;
    this.stream = opts.stream ?? process.stdout;
    this.errStream = opts.errStream ?? process.stderr;
    this.prefix = opts.prefix;
  }

  private enabled(level: LogLevel): boolean {
    return LEVEL_ORDER[this.level] <= LEVEL_ORDER[level];
  }

  private timePart(): string {
    return this.timestamps ? c.dim(formatTimestamp()) + ' ' : '';
  }

  private prefixPart(): string {
    return this.prefix ? c.dim(`[${this.prefix}]`) + ' ' : '';
  }

  private compose(icon: string, msg: string, rest: unknown[]): string {
    return `${this.timePart()}${this.prefixPart()}${icon} ${msg}${formatRest(rest)}`;
  }

  private writeLine(stream: NodeJS.WriteStream, line: string): void {
    stream.write(line + '\n');
  }

  debug(msg: string, ...rest: unknown[]): void {
    if (!this.enabled('debug')) return;
    const line = `${this.timePart()}${this.prefixPart()}${msg}${formatRest(rest)}`;
    this.writeLine(this.stream, c.dim(line));
  }

  info(msg: string, ...rest: unknown[]): void {
    if (!this.enabled('info')) return;
    this.writeLine(this.stream, this.compose(c.blue(symbols.info), msg, rest));
  }

  success(msg: string, ...rest: unknown[]): void {
    if (!this.enabled('info')) return;
    this.writeLine(this.stream, this.compose(c.green(symbols.success), msg, rest));
  }

  warn(msg: string, ...rest: unknown[]): void {
    if (!this.enabled('warn')) return;
    this.writeLine(this.errStream, this.compose(c.yellow(symbols.warning), msg, rest));
  }

  error(msg: string, ...rest: unknown[]): void {
    if (!this.enabled('error')) return;
    this.writeLine(this.errStream, this.compose(c.red(symbols.error), msg, rest));
  }

  child(prefix: string): Logger {
    const combined = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new LoggerImpl({
      level: this.level,
      timestamps: this.timestamps,
      stream: this.stream,
      errStream: this.errStream,
      prefix: combined,
    });
  }
}

export function createLogger(opts?: LoggerOptions): Logger {
  return new LoggerImpl(opts);
}
