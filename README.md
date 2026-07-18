# @dinesh-gamage/cli-kit

Zero-dependency toolkit for building friendly command-line tools: colors, tables, spinners, progress bars, prompts, and logging — with **graceful non-TTY fallbacks** so everything still behaves in CI, pipes, and log files (the usual reason spinners and progress bars "don't work").

## Install

```bash
npm i @dinesh-gamage/cli-kit
```

Node 18+. ESM and CJS. No runtime dependencies.

## Colors

```ts
import { c } from '@dinesh-gamage/cli-kit';

console.log(c.red.bold('error'), c.hex('#4f6df5')('brand'), c.bgBlue.white(' badge '));
```

Chainable styles, 16/bright/256/truecolor, correct nesting. Respects `NO_COLOR`, `FORCE_COLOR`, and TTY detection (`colorSupport.enabled` is mutable for tests).

## Tables

```ts
import { printTable } from '@dinesh-gamage/cli-kit';

printTable(rows, {
  border: 'single',          // 'single' | 'compact' | 'none'
  index: true,               // 1-based # column
  columns: [{ key: 'name' }, { key: 'size', align: 'right', format: (v) => `${v} MB` }],
});
```

ANSI-aware widths (styled cells line up), wide-char/CJK/emoji safe, auto-shrinks to the terminal width, numeric columns right-align automatically, `null` renders as `—`.

## Spinner

```ts
import { createSpinner } from '@dinesh-gamage/cli-kit';

const spin = createSpinner('Installing…').start();
spin.update('Linking…');
spin.log('fetched 42 packages'); // permanent line above the spinner
spin.succeed('Done');            // or .fail() / .warn() / .info() / .stop()
```

In a TTY: animated frames. Not a TTY: one line at start, one at resolution — no control-character garbage in logs.

## Progress bar

```ts
import { createProgressBar } from '@dinesh-gamage/cli-kit';

const bar = createProgressBar({ total: 100, label: 'migrate' });
bar.tick();          // or bar.update(42)
```

`{bar} {pct} {current}/{total} {eta}` format (customizable), rate/ETA from a moving average. Not a TTY: prints milestone lines at 0/25/50/75/100% instead of animating.

## Prompts

```ts
import { input, password, confirm, select, multiselect } from '@dinesh-gamage/cli-kit';

const name = await input('Project name', { default: 'demo', validate: (v) => (v ? null : 'required') });
const secret = await password('API key');
const ok = await confirm('Continue?', { default: true });
const kind = await select('Template', [{ value: 'lib', label: 'Library', hint: 'tsup + vitest' }, 'cli']);
const feats = await multiselect('Features', ['lint', 'tests', 'ci'], { default: ['tests'] });
```

Arrow-key navigation, masked password input, Ctrl+C restores the terminal. Not a TTY: returns the provided `default`, or throws a clear error when there is none.

## Logger

```ts
import { createLogger } from '@dinesh-gamage/cli-kit';

const log = createLogger({ level: 'info', timestamps: true });
log.info('3 modules registered');
log.success('applied', { ms: 182 });
log.warn('2 stale hints');       // → stderr
log.error('refused');            // → stderr
log.child('fin').info('scoped'); // [fin] prefix
```

## Text helpers

`wrap`, `truncate`, `pad`, `indent`, `heading`, `box` — all ANSI-aware, all wide-char safe.

```ts
console.log(box('Hello!', { title: 'welcome' }));
```

## What this package deliberately is not

Argument parsing is out of scope — pair it with [commander](https://www.npmjs.com/package/commander). cli-kit is the presentation layer.

## Demo

```bash
npm run demo          # in a terminal: full animations + interactive prompts
npm run demo | cat    # piped: watch every component fall back to plain lines
```

## License

MIT
