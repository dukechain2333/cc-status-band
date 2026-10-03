// Palettes, shapes and glyph sets for the band.
//
// Every color is a #rrggbb string, so the same palette feeds both renderers:
// the mod's Text elements take it as-is, and the ANSI renderer turns it into a
// truecolor (or 256-color) escape.
//
// A palette has two chip tones, `a` and `b`, that alternate left to right so
// neighbouring chips stay distinct, plus the model chip, which carries the
// accent. `ok`, `warn` and `crit` color the gauges and the numbers beside them.
// The one-band shape fills everything with tone `b` and splits segments with
// `divider`.

export const THEMES = {
  clay: {
    label: 'Clay',
    note: 'warm dark',
    shape: 'band',
    terminal: { bg: '#1A1917', fg: '#E8E5DA' },
    accent: '#D97757',
    model: { bg: '#D97757', fg: '#1A1917', icon: '#1A1917', pip: '#1A1917', pipOff: '#A9583C' },
    a: { bg: '#2A2825', fg: '#E8E5DA', muted: '#8C877B', icon: '#D97757' },
    b: { bg: '#33302C', fg: '#E8E5DA', muted: '#8C877B', icon: '#D97757' },
    ok: '#A3C281',
    warn: '#E9B44C',
    crit: '#F0715A',
    track: '#524D45',
    sep: '#4A4640',
    divider: '#5E5951',
  },
  paper: {
    label: 'Paper',
    note: 'for light terminals',
    shape: 'band',
    terminal: { bg: '#FAF9F5', fg: '#141413' },
    accent: '#B4552F',
    model: { bg: '#141413', fg: '#FAF9F5', icon: '#E08A68', pip: '#FAF9F5', pipOff: '#5E5D59' },
    a: { bg: '#ECE9E0', fg: '#2B2A27', muted: '#6E6B64', icon: '#B4552F' },
    b: { bg: '#E2DED3', fg: '#2B2A27', muted: '#6E6B64', icon: '#B4552F' },
    ok: '#4A7533',
    warn: '#9A5F0C',
    crit: '#B23A27',
    track: '#C9C3B5',
    sep: '#C9C3B5',
    divider: '#BDB7A9',
  },
  aurora: {
    label: 'Aurora',
    note: 'cool and vivid',
    shape: 'arrows',
    terminal: { bg: '#0E1120', fg: '#DCE1F5' },
    accent: '#A68CFF',
    model: { bg: '#8B6CFF', fg: '#0E1120', icon: '#0E1120', pip: '#0E1120', pipOff: '#5B45B8' },
    a: { bg: '#1A2038', fg: '#DCE1F5', muted: '#8089AD', icon: '#6FE3D0' },
    b: { bg: '#232B4A', fg: '#DCE1F5', muted: '#8089AD', icon: '#6FE3D0' },
    ok: '#6FE3D0',
    warn: '#FFCB6B',
    crit: '#FF6B8B',
    track: '#3B4570',
    sep: '#343D63',
    divider: '#4A5585',
  },
  ink: {
    label: 'Ink',
    note: 'no fills',
    shape: 'line',
    terminal: { bg: '#111111', fg: '#D4D4D4' },
    accent: '#D97757',
    model: { bg: null, fg: '#F2F2F2', icon: '#D97757', pip: '#D97757', pipOff: '#4D4D4D' },
    a: { bg: null, fg: '#CFCFCF', muted: '#7A7A7A', icon: '#9A9A9A' },
    b: { bg: null, fg: '#CFCFCF', muted: '#7A7A7A', icon: '#9A9A9A' },
    ok: '#7FB685',
    warn: '#D9A54A',
    crit: '#E06C5A',
    track: '#3A3A3A',
    sep: '#3A3A3A',
    divider: '#3A3A3A',
  },
}

export const THEME_NAMES = Object.keys(THEMES)

// `auto` means "the theme's own shape".
export const SHAPES = ['auto', 'chips', 'arrows', 'line', 'band']

// The two-row band draws its half rows, edges and stepped corners with block
// elements (▄ ▀ ▐ ▌ ▗ ▖ ▝ ▘), which every terminal font has; ascii has none,
// so there the band stays one flat row.
//
// Chips, the flat band and arrows draw their rounded and pointed caps with Nerd Font glyphs
// from the Private Use Area. Without a Nerd Font those render as boxes, so the
// unicode and ascii sets leave the caps out and the chips get square ends.
export const GLYPHS = {
  nerd: {
    capLeft: '',
    capRight: '',
    arrow: '',
    model: '✻',
    git: '',
    reset: '↻',
    clock: '◷',
    pipOn: '●',
    pipOff: '○',
    dirty: '●',
    ahead: '↑',
    behind: '↓',
    sep: '│',
    fill: '━',
    half: '╸',
    track: '─',
    none: '—',
    padTop: '▄',
    padBottom: '▀',
    edgeLeft: '▐',
    edgeRight: '▌',
    cornerTL: '▗',
    cornerTR: '▖',
    cornerBL: '▝',
    cornerBR: '▘',
  },
  unicode: {
    capLeft: '',
    capRight: '',
    arrow: '',
    model: '✻',
    git: '⎇',
    reset: '↻',
    clock: '◷',
    pipOn: '●',
    pipOff: '○',
    dirty: '●',
    ahead: '↑',
    behind: '↓',
    sep: '│',
    fill: '━',
    half: '╸',
    track: '─',
    none: '—',
    padTop: '▄',
    padBottom: '▀',
    edgeLeft: '▐',
    edgeRight: '▌',
    cornerTL: '▗',
    cornerTR: '▖',
    cornerBL: '▝',
    cornerBR: '▘',
  },
  ascii: {
    capLeft: '',
    capRight: '',
    arrow: '',
    model: '*',
    git: '',
    reset: '~',
    clock: '',
    pipOn: '#',
    pipOff: '.',
    dirty: '*',
    ahead: '^',
    behind: 'v',
    sep: '|',
    fill: '=',
    half: '-',
    track: '.',
    none: '-',
  },
}

export const GLYPH_NAMES = Object.keys(GLYPHS)

export function resolveTheme(name) {
  return THEMES[name] || THEMES.clay
}

export function resolveShape(shape, theme) {
  return shape && shape !== 'auto' && SHAPES.includes(shape) ? shape : theme.shape
}

export function resolveGlyphs(name) {
  return GLYPHS[name] || GLYPHS.unicode
}
