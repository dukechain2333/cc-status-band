#!/usr/bin/env node
// The classic statusLine command: reads Claude Code's JSON on stdin and prints
// the band as one ANSI-colored line. Works on any Claude Code version with
// statusLine support; needs Node 18 or later and nothing else.
//
//   "statusLine": {
//     "type": "command",
//     "command": "node /path/to/cc-status-band/statusline/status-band.mjs --theme clay"
//   }
//
// Flags (each also readable from an environment variable):
//   --theme   clay | paper | aurora | ink           STATUS_BAND_THEME
//   --shape   auto | chips | arrows | line          STATUS_BAND_SHAPE
//   --glyphs  unicode | nerd | ascii                STATUS_BAND_GLYPHS
//   --time    elapsed | clock | clock12 | off       STATUS_BAND_TIME
//   --rows    1 | 2                                 STATUS_BAND_ROWS
//   --width   full | fit                            STATUS_BAND_WIDTH
//   --hide    host,model,dir,git,ctx,5h,7d,spend,quota,cost   STATUS_BAND_HIDE
//             (cost hides the dollars and keeps the time; quota = 5h,7d,spend)
//   --colors  truecolor | 256                       STATUS_BAND_COLORS
//   --demo    steady | fresh | warm | hot | apikey  (ignores stdin)

import { execFileSync } from 'node:child_process'
import { homedir, hostname, userInfo } from 'node:os'
import { renderRuns } from '../core/band.js'
import { rowsToAnsi, detectColorMode } from '../core/ansi.js'
import { GIT_STATUS_ARGS, parseGitStatus } from '../core/git.js'
import { fromStatusLine } from '../core/snapshot.js'
import { DEMOS } from '../core/demo.js'

function parseArgs(argv, env) {
  const opts = {
    theme: env.STATUS_BAND_THEME,
    shape: env.STATUS_BAND_SHAPE,
    glyphs: env.STATUS_BAND_GLYPHS,
    time: env.STATUS_BAND_TIME,
    rows: env.STATUS_BAND_ROWS,
    width: env.STATUS_BAND_WIDTH,
    hide: env.STATUS_BAND_HIDE,
    colors: env.STATUS_BAND_COLORS,
    demo: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z]+)(?:=(.*))?$/)
    if (!m) continue
    const value = m[2] !== undefined ? m[2] : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'steady'
    opts[m[1]] = value
  }
  opts.rows = Number(opts.rows) === 1 ? 1 : 2
  opts.hide = String(opts.hide || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return opts
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
  })
}

function gitStatus(cwd) {
  if (!cwd) return null
  try {
    const out = execFileSync('git', ['-C', cwd, ...GIT_STATUS_ARGS], {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return parseGitStatus(out)
  } catch {
    return null
  }
}

async function main() {
  const env = process.env
  const opts = parseArgs(process.argv.slice(2), env)
  const columns = Number(env.COLUMNS) > 0 ? Number(env.COLUMNS) - 4 : 120
  let snapshot
  if (opts.demo) {
    snapshot = DEMOS[opts.demo] || DEMOS.steady
  } else {
    let input = {}
    try {
      input = JSON.parse((await readStdin()) || '{}')
    } catch {}
    const cwd = (input.workspace && input.workspace.current_dir) || input.cwd || process.cwd()
    let user = ''
    try {
      user = userInfo().username
    } catch {}
    const host = hostname().split('.')[0]
    snapshot = fromStatusLine(input, { home: homedir(), now: Date.now(), git: gitStatus(cwd), user, host })
  }
  const runs = renderRuns(snapshot, opts, columns)
  process.stdout.write(rowsToAnsi(runs, opts.colors === '256' || opts.colors === 'truecolor' ? opts.colors : detectColorMode(env)) + '\n')
}

main().catch((err) => {
  process.stdout.write(`status-band: ${err && err.message ? err.message : err}\n`)
})
