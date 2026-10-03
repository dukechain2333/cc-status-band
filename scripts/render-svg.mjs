#!/usr/bin/env node
// Renders the README's preview images from the same code the band runs, so
// the pictures can't drift from what the terminal shows.
//
//   node scripts/render-svg.mjs   → docs/themes.svg, docs/states.svg, docs/widths.svg

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderRuns } from '../core/band.js'
import { DEMOS } from '../core/demo.js'
import { textWidth } from '../core/format.js'
import { THEMES, THEME_NAMES } from '../core/themes.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FONT = 14
const CELL = FONT * 0.6
const ROW = 26
const PAD = 20
const LABEL = 92

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// One terminal strip: the terminal's own background, then the band's runs.
function strip(runs, x, y, width, bg) {
  let out = `<rect x="${x}" y="${y}" width="${width}" height="${ROW + 16}" rx="8" fill="${bg}"/>`
  let col = 0
  const top = y + 8
  for (const run of runs) {
    const w = textWidth(run.text)
    const left = x + 14 + col * CELL
    // Neighbouring fills overlap by a hair so no seam shows between them.
    if (run.bg) out += `<rect x="${left.toFixed(1)}" y="${top}" width="${(w * CELL + 0.6).toFixed(1)}" height="${ROW}" fill="${run.bg}" shape-rendering="crispEdges"/>`
    if (run.text.trim()) {
      out +=
        `<text x="${left.toFixed(1)}" y="${top + ROW / 2 + FONT * 0.36}" textLength="${(w * CELL).toFixed(1)}" lengthAdjust="spacingAndGlyphs"` +
        ` fill="${run.fg || '#E8E5DA'}"${run.bold ? ' font-weight="700"' : ''} xml:space="preserve">${esc(run.text)}</text>`
    }
    col += w
  }
  return out
}

function sheet(rows, columns) {
  const stripWidth = columns * CELL + 28
  const width = PAD * 2 + LABEL + stripWidth
  const height = PAD * 2 + rows.length * (ROW + 16) + (rows.length - 1) * 12
  let body = ''
  rows.forEach((row, i) => {
    const y = PAD + i * (ROW + 28)
    body += `<text x="${PAD}" y="${y + (ROW + 16) / 2 + 4}" fill="#5E5A51" font-size="12">${esc(row.label)}</text>`
    body += strip(row.runs, PAD + LABEL, y, row.width ? row.width * CELL + 28 : stripWidth, row.bg)
  })
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"` +
    ` font-family="'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace" font-size="${FONT}">` +
    `<rect width="100%" height="100%" rx="12" fill="#ECE9E1"/>${body}</svg>\n`
  )
}

const COLS = 172
const files = {
  'themes.svg': sheet(
    THEME_NAMES.map((name) => ({
      label: THEMES[name].label,
      bg: THEMES[name].terminal.bg,
      runs: renderRuns(DEMOS.steady, { theme: name }, COLS),
    })),
    COLS,
  ),
  'states.svg': sheet(
    Object.keys(DEMOS).map((state) => ({
      label: state,
      bg: THEMES.clay.terminal.bg,
      runs: renderRuns(DEMOS[state], { theme: 'clay' }, COLS),
    })),
    COLS,
  ),
  'widths.svg': sheet(
    [170, 130, 100, 72].map((cols) => ({
      label: `${cols} cols`,
      bg: THEMES.clay.terminal.bg,
      width: cols,
      runs: renderRuns(DEMOS.steady, { theme: 'clay' }, cols),
    })),
    COLS,
  ),
}

mkdirSync(join(root, 'docs'), { recursive: true })
for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(root, 'docs', name), svg)
  console.log('wrote docs/' + name)
}
