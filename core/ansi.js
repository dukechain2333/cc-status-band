// Runs → one line of ANSI-colored text, for the classic statusLine command.

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Nearest color in the xterm 256-color palette: the 6×6×6 cube or the gray ramp.
export function to256(hex) {
  const [r, g, b] = rgb(hex)
  const level = (v) => (v < 48 ? 0 : v < 115 ? 1 : Math.floor((v - 35) / 40))
  const steps = [0, 95, 135, 175, 215, 255]
  const [cr, cg, cb] = [level(r), level(g), level(b)]
  const cube = 16 + 36 * cr + 6 * cg + cb
  const cubeDist = (steps[cr] - r) ** 2 + (steps[cg] - g) ** 2 + (steps[cb] - b) ** 2
  const avg = Math.round((r + g + b) / 3)
  const grayIndex = avg > 238 ? 23 : Math.max(0, Math.round((avg - 8) / 10))
  const grayLevel = 8 + grayIndex * 10
  const grayDist = (grayLevel - r) ** 2 + (grayLevel - g) ** 2 + (grayLevel - b) ** 2
  return grayDist < cubeDist ? 232 + grayIndex : cube
}

function colorCode(hex, layer, mode) {
  if (mode === '256') return `${layer === 'fg' ? 38 : 48};5;${to256(hex)}`
  const [r, g, b] = rgb(hex)
  return `${layer === 'fg' ? 38 : 48};2;${r};${g};${b}`
}

// mode: 'truecolor' | '256'
export function toAnsi(runs, mode = 'truecolor') {
  let out = ''
  for (const run of runs) {
    const codes = []
    if (run.bold) codes.push('1')
    if (run.fg) codes.push(colorCode(run.fg, 'fg', mode))
    if (run.bg) codes.push(colorCode(run.bg, 'bg', mode))
    out += codes.length ? `\x1b[${codes.join(';')}m${run.text}\x1b[0m` : run.text
  }
  return out
}

// Truecolor unless the terminal says it can't: Apple's Terminal before macOS 26
// and anything that only advertises 256 colors.
export function detectColorMode(env) {
  const ct = String(env.COLORTERM || '').toLowerCase()
  if (ct === 'truecolor' || ct === '24bit') return 'truecolor'
  if (env.TERM_PROGRAM === 'Apple_Terminal') return '256'
  if (/256color/.test(String(env.TERM || '')) && !ct) return '256'
  return 'truecolor'
}
