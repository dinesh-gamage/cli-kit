// Unicode symbols with ASCII fallbacks for terminals that can't render them.

const unicodeOk =
  process.platform !== 'win32' || !!process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode';

export const symbols = {
  success: unicodeOk ? '✓' : '√',
  error: unicodeOk ? '✗' : 'x',
  warning: unicodeOk ? '⚠' : '!',
  info: unicodeOk ? 'ℹ' : 'i',
  bullet: unicodeOk ? '•' : '*',
  ellipsis: unicodeOk ? '…' : '...',
  pointer: unicodeOk ? '❯' : '>',
  line: unicodeOk ? '─' : '-',
  radioOn: unicodeOk ? '◉' : '(*)',
  radioOff: unicodeOk ? '◯' : '( )',
  checkboxOn: unicodeOk ? '◼' : '[x]',
  checkboxOff: unicodeOk ? '◻' : '[ ]',
} as const;

export const spinnerFrames = unicodeOk
  ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  : ['-', '\\', '|', '/'];
