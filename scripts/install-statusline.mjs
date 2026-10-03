#!/usr/bin/env node
// Points Claude Code's statusLine setting at this checkout's script, for
// people who want the classic status line instead of the mod (or who run a
// Claude Code older than 2.1.287).
//
//   node scripts/install-statusline.mjs [--theme clay] [--shape auto] [--glyphs unicode]
//   node scripts/install-statusline.mjs --uninstall
//
// Your settings file is backed up next to itself before anything changes.

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'statusline', 'status-band.mjs')
const settingsPath = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json')
const args = process.argv.slice(2)

let settings = {}
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  } catch (err) {
    console.error(`Could not parse ${settingsPath}: ${err.message}. Nothing changed.`)
    process.exit(1)
  }
  const backup = `${settingsPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`
  copyFileSync(settingsPath, backup)
  console.log(`Backed up settings to ${backup}`)
}

if (args.includes('--uninstall')) {
  if (settings.statusLine && String(settings.statusLine.command || '').includes('status-band.mjs')) {
    delete settings.statusLine
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    console.log('Removed the status-band statusLine.')
  } else {
    console.log('The statusLine is not status-band\'s; left it alone.')
  }
  process.exit(0)
}

const passthrough = []
for (let i = 0; i < args.length; i++) {
  if (/^--(theme|shape|glyphs|hide|colors)$/.test(args[i]) && args[i + 1]) passthrough.push(args[i], args[++i])
}

if (settings.statusLine) console.log(`Replacing your current statusLine: ${JSON.stringify(settings.statusLine)}`)
const quoted = (s) => (/\s/.test(s) ? `"${s}"` : s)
settings.statusLine = {
  type: 'command',
  command: ['node', quoted(script), ...passthrough].join(' '),
  padding: 0,
}
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
console.log(`statusLine now runs: ${settings.statusLine.command}`)
console.log('It shows up on the next status line update in any Claude Code session.')
