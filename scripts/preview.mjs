#!/usr/bin/env node
// Prints the band in every theme and state, so you can judge the palettes in
// your own terminal and font before picking one.
//
//   node scripts/preview.mjs                 every theme, steady state
//   node scripts/preview.mjs --states        every state, one theme
//   node scripts/preview.mjs --glyphs nerd   with Nerd Font caps

import { renderRuns } from '../core/band.js'
import { detectColorMode, toAnsi } from '../core/ansi.js'
import { DEMOS } from '../core/demo.js'
import { THEMES, THEME_NAMES } from '../core/themes.js'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf('--' + name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const glyphs = flag('glyphs', 'unicode')
const shape = flag('shape', 'auto')
const theme = flag('theme', 'clay')
const columns = Number(flag('columns', (process.stdout.columns || 160) - 12))
const mode = detectColorMode(process.env)
const dim = (s) => `\x1b[2m${s}\x1b[0m`

if (args.includes('--states')) {
  for (const state of Object.keys(DEMOS)) {
    console.log(dim(state.padEnd(8)) + ' ' + toAnsi(renderRuns(DEMOS[state], { theme, shape, glyphs }, columns), mode))
  }
} else {
  for (const name of THEME_NAMES) {
    console.log(dim(THEMES[name].label.padEnd(8)) + ' ' + toAnsi(renderRuns(DEMOS.steady, { theme: name, shape, glyphs }, columns), mode))
  }
}
