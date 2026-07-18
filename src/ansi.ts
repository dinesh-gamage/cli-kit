// ANSI styling core. Zero dependencies.

export interface ColorSupport {
  enabled: boolean;
}

function detectColor(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') return true;
  if (process.env.TERM === 'dumb') return false;
  return !!stream.isTTY;
}

/** Global color switch. Mutable so hosts/tests can override. */
export const colorSupport: ColorSupport = { enabled: detectColor() };

const CODES: Record<string, [number, number]> = {
  reset: [0, 0],
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  strikethrough: [9, 29],

  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],

  brightRed: [91, 39],
  brightGreen: [92, 39],
  brightYellow: [93, 39],
  brightBlue: [94, 39],
  brightMagenta: [95, 39],
  brightCyan: [96, 39],
  brightWhite: [97, 39],

  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],
  bgGray: [100, 49],
};

type StyleName = keyof typeof CODES;

export interface StyleChain {
  (text: string | number): string;
  rgb(r: number, g: number, b: number): StyleChain;
  hex(hex: string): StyleChain;
  ansi256(code: number): StyleChain;
}

type StyledChain = StyleChain & { [K in StyleName]: StyledChain };

interface StylePair {
  open: string;
  close: string;
}

function makeChain(styles: StylePair[]): StyledChain {
  const apply = (text: string | number): string => {
    const s = String(text);
    if (!colorSupport.enabled || styles.length === 0) return s;
    let open = '';
    let close = '';
    for (const st of styles) {
      open += st.open;
      close = st.close + close;
    }
    // Re-open styles after any nested reset/close so nesting works.
    return open + s.split('[0m').join('[0m' + open) + close;
  };

  const chain = apply as StyledChain;

  for (const name of Object.keys(CODES) as StyleName[]) {
    Object.defineProperty(chain, name, {
      get() {
        const [openCode, closeCode] = CODES[name];
        return makeChain([...styles, { open: `[${openCode}m`, close: `[${closeCode}m` }]);
      },
      enumerable: true,
      configurable: true,
    });
  }

  chain.rgb = (r: number, g: number, b: number) =>
    makeChain([...styles, { open: `[38;2;${r};${g};${b}m`, close: '[39m' }]);
  chain.hex = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
    const n = parseInt(full, 16);
    return chain.rgb((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  };
  chain.ansi256 = (code: number) =>
    makeChain([...styles, { open: `[38;5;${code}m`, close: '[39m' }]);

  return chain;
}

/** Chainable style builder: c.red.bold('error'), c.hex('#4f6df5')('brand'). */
export const c: StyledChain = makeChain([]);

// ─── Width / stripping ───────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\[[0-9;]*m/g;

/** Remove all ANSI style sequences. */
export function strip(text: string): string {
  return text.replace(ANSI_RE, '');
}

function isWideCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK radicals .. Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compat forms
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji blocks
    (cp >= 0x20000 && cp <= 0x3fffd)    // CJK ext B+
  );
}

/** Printed width of a string: ANSI-aware, double-width CJK/emoji counted as 2. */
export function visibleWidth(text: string): number {
  let width = 0;
  for (const ch of strip(text)) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x200d) continue;           // zero-width joiner
    if (cp >= 0x0300 && cp <= 0x036f) continue; // combining marks
    if (cp === 0xfe0f) continue;           // variation selector
    width += isWideCodePoint(cp) ? 2 : 1;
  }
  return width;
}
