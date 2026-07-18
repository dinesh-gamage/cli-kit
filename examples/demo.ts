// Visual smoke test: npx tsx examples/demo.ts
// Run in a real terminal to see animations; pipe to a file to see non-TTY fallbacks.
import {
  c, symbols, heading, box, wrap, indent,
  renderTable, createSpinner, createProgressBar, createLogger,
  input, confirm, select, multiselect,
} from '../src/index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(heading('Colors'));
  console.log(`${c.red('red')} ${c.green.bold('green bold')} ${c.yellow.underline('underline')} ${c.hex('#4f6df5')('brand hex')} ${c.bgBlue.white(' badge ')} ${c.dim('dim')}`);
  console.log(c.cyan(`nested: outer ${c.bold.magenta('inner')} outer again`));

  console.log('\n' + heading('Symbols'));
  console.log(`${c.green(symbols.success)} success  ${c.red(symbols.error)} error  ${c.yellow(symbols.warning)} warning  ${c.blue(symbols.info)} info`);

  console.log('\n' + heading('Box'));
  console.log(box(`Welcome to ${c.bold('cli-kit')}.\nZero dependencies. ${c.dim('Plays nice without a TTY too.')}`, { title: 'hello' }));

  console.log('\n' + heading('Wrap + indent'));
  console.log(indent(wrap('A fairly long sentence that will be wrapped to a narrow column width to demonstrate ANSI-aware word wrapping without breaking escape sequences.', 40), 2));

  console.log('\n' + heading('Table'));
  console.log(
    renderTable(
      [
        { module: 'fin', tables: 15, status: c.green('enabled'), size: 20.5 },
        { module: 'pm', tables: 9, status: c.green('enabled'), size: 12.1 },
        { module: 'health', tables: null, status: c.dim('planned'), size: null },
      ],
      { border: 'single', index: true },
    ),
  );

  console.log('\n' + heading('Spinner'));
  const spin = createSpinner('Resolving dependencies…').start();
  await sleep(900);
  spin.update('Linking packages…');
  spin.log(`${c.dim('fetched 42 packages')}`);
  await sleep(900);
  spin.succeed('Install complete');

  const spin2 = createSpinner('Contacting server…').start();
  await sleep(700);
  spin2.fail('Connection refused');

  console.log('\n' + heading('Progress'));
  const bar = createProgressBar({ total: 40, label: 'migrate' });
  for (let i = 0; i < 40; i++) {
    await sleep(40);
    bar.tick();
  }

  console.log('\n' + heading('Logger'));
  const log = createLogger({ level: 'debug', timestamps: true });
  log.debug('resolved config from supaorm.config.ts');
  log.info('3 modules registered');
  log.success('migration 004_add_books applied', { ms: 182 });
  log.warn('2 stale rename hints');
  log.error('connection refused', { host: 'db.example.co' });
  log.child('fin').info('scoped child logger');

  if (process.stdout.isTTY && process.stdin.isTTY && !process.env.CI) {
    console.log('\n' + heading('Prompts'));
    const name = await input('Project name', { default: 'demo' });
    const kind = await select('Template', [
      { value: 'lib', label: 'Library', hint: 'tsup + vitest' },
      { value: 'cli', label: 'CLI tool' },
      { value: 'app', label: 'Web app' },
    ]);
    const feats = await multiselect('Features', ['lint', 'tests', 'ci'], { default: ['tests'] });
    const ok = await confirm(`Create ${c.bold(name)} (${kind}) with [${feats.join(', ')}]?`, { default: true });
    console.log(ok ? c.green(`${symbols.success} confirmed`) : c.dim('cancelled'));
  } else {
    console.log('\n' + c.dim('(skipping interactive prompts — no TTY)'));
  }
}

main();
