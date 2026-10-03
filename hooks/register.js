// status-band: draws the band above the Claude Code prompt.
//
// The band itself is built by ../core, which the classic statusLine script
// shares. This module only gathers the session's figures through the mods
// API, draws the band in the AbovePrompt render site, and runs the /band
// picker.

import { HIDEABLE, TIME_MODES, layoutBand, paint } from '../core/band.js'
import { toElements } from '../core/elements.js'
import { GIT_STATUS_ARGS, parseGitStatus } from '../core/git.js'
import { fromSession } from '../core/snapshot.js'
import { GLYPH_NAMES, SHAPES, THEMES, THEME_NAMES } from '../core/themes.js'

const PANE = 'status-band'
const DEFAULTS = {
  theme: 'clay',
  shape: 'auto',
  glyphs: 'unicode',
  time: 'elapsed',
  rows: 2,
  width: 'full',
  hide: [],
}
const WIDTHS = ['full', 'fit']
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']

// What the band shows between redraws. Preferences live in $.store so every
// session on the machine shares them; the rest is refreshed as the session runs.
let prefs = { ...DEFAULTS }
let git = null
let effort = null
let home = ''
let user = ''
let host = ''

// Keeps only the keys the band still reads, so settings saved by an older
// version (such as `place`) drop away.
function cleanPrefs(saved) {
  const s = saved && typeof saved === 'object' ? saved : {}
  const p = { ...DEFAULTS }
  if (THEME_NAMES.includes(s.theme)) p.theme = s.theme
  if (SHAPES.includes(s.shape)) p.shape = s.shape
  if (GLYPH_NAMES.includes(s.glyphs)) p.glyphs = s.glyphs
  if (TIME_MODES.includes(s.time)) p.time = s.time
  if (s.rows === 1 || s.rows === 2) p.rows = s.rows
  if (WIDTHS.includes(s.width)) p.width = s.width
  if (Array.isArray(s.hide)) p.hide = s.hide.filter((id) => HIDEABLE.includes(id))
  return p
}

function describePrefs(p) {
  const parts = [`theme ${p.theme}`, `shape ${p.shape}`, `glyphs ${p.glyphs}`, `time ${p.time}`, `rows ${p.rows}`, `width ${p.width}`]
  if (p.hide.length) parts.push(`hiding ${p.hide.join(', ')}`)
  return parts.join(' · ')
}

// `/band <words>`: each word sets whatever it names, so `/band aurora line`
// works. Returns the new prefs, or an error string.
function applyArgs(p, args) {
  const words = args.toLowerCase().split(/\s+/).filter(Boolean)
  const next = { ...p, hide: [...p.hide] }
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === 'reset') return { ...DEFAULTS, hide: [] }
    if (THEME_NAMES.includes(w)) next.theme = w
    else if (SHAPES.includes(w)) next.shape = w
    else if (GLYPH_NAMES.includes(w)) next.glyphs = w
    else if (w === 'below') return 'The band always sits above the prompt.'
    else if (w === 'above') continue
    else if (w === 'time' && TIME_MODES.includes(words[i + 1])) next.time = words[(i += 1)]
    else if (TIME_MODES.includes(w)) next.time = w
    else if (w === 'rows' && ['1', '2'].includes(words[i + 1])) next.rows = Number(words[(i += 1)])
    else if (WIDTHS.includes(w)) next.width = w
    else if (w === 'hide' || w === 'show') {
      const ids = words.slice(i + 1).filter((id) => HIDEABLE.includes(id))
      if (!ids.length) return `Name a segment to ${w}: ${HIDEABLE.join(', ')}`
      next.hide = w === 'hide' ? [...new Set([...next.hide, ...ids])] : next.hide.filter((id) => !ids.includes(id))
      i = words.length
    } else {
      return `Unknown option "${w}". Themes: ${THEME_NAMES.join(', ')}; shapes: ${SHAPES.join(', ')}; glyphs: ${GLYPH_NAMES.join(', ')}; time: ${TIME_MODES.join(', ')}; rows 1|2; full|fit; hide/show <segment>; reset.`
    }
  }
  return next
}

async function loadPrefs($) {
  try {
    prefs = cleanPrefs(await $.store.get('prefs'))
  } catch {
    prefs = cleanPrefs(null)
  }
}

async function savePrefs($, p) {
  prefs = cleanPrefs(p)
  $.ui.invalidate('ui.render')
  await $.store.set('prefs', prefs)
}

async function refreshGit($) {
  try {
    const cwd = await $.session.cwd()
    const r = await $.process.run(['git', '-C', cwd, ...GIT_STATUS_ARGS], { timeoutMs: 3000 })
    git = r.exitCode === 0 ? parseGitStatus(r.stdout) : null
  } catch {
    git = null
  }
}

// Until the first request reports the live effort, use what the last session
// saw for this model, or else what settings ask for.
async function readSettings($) {
  try {
    const settings = (await $.settings.read()) || {}
    const model = await $.session.model()
    const seen = (await $.store.get('effortByModel')) || {}
    const perModel = settings.modelSettings && settings.modelSettings[model]
    const level = model in seen ? seen[model] : (perModel && perModel.effortLevel) || settings.effortLevel
    effort = EFFORTS.includes(level) ? level : null
  } catch {}
}

async function rememberEffort($, model, level) {
  const seen = (await $.store.get('effortByModel')) || {}
  if (seen[model] === level) return
  await $.store.set('effortByModel', { ...seen, [model]: level })
}

async function snapshot($) {
  const [modelId, cwd, usage, now] = await Promise.all([
    $.session.model(),
    $.session.cwd(),
    $.session.usage(),
    $.clock.now(),
  ])
  return fromSession({ modelId, effort, cwd, home, usage, git, now, user, host })
}

function drawBand(snap, options, columns, elements) {
  return toElements(paint(layoutBand(snap, options, columns)), elements)
}

async function readHost($) {
  try {
    const r = await $.process.run(['hostname', '-s'], { timeoutMs: 2000 })
    if (r.exitCode === 0 && r.stdout.trim()) return r.stdout.trim()
  } catch {}
  return (await $.env.get('COMPUTERNAME')) || ''
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await loadPrefs($)
    home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
    user = (await $.env.get('USER')) || (await $.env.get('USERNAME')) || ''
    host = await readHost($)
    await readSettings($)
    await refreshGit($)

    // Keeps the reset countdowns and git state current while the session idles.
    $.clock.every(20000, async () => {
      await refreshGit($)
      $.ui.invalidate('ui.render')
    })

    try {
      await $.command.register({
        name: 'band',
        description: 'Pick the status band theme, shape and layout',
        argumentHint: '[theme | shape | glyphs | time <mode> | rows 1|2 | full | fit | hide <segment> | show <segment> | reset]',
        immediate: true,
      })
    } catch {}
    return next(e)
  })

  // The figures moved: context fill, a quota window, or cost.
  on('session.measure', async ($, e, next) => {
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // Each request on the main loop carries the live effort, /effort included,
  // and none for a model that takes no effort setting.
  on('turn.step', async function* ($, e, next) {
    const live = EFFORTS.includes(e.effort) ? e.effort : null
    if (!e.agentId && live !== effort) {
      effort = live
      $.ui.invalidate('ui.render')
      await rememberEffort($, e.model, live)
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refreshGit($)
    $.ui.invalidate('ui.render')
    return result
  })

  // Above the prompt, in the band other mods share; theirs stays beneath ours.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    // Claude Code draws its `[-]` collapse control over the band's last three
    // cells, so the band stops one cell short of it.
    const band = drawBand(await snapshot($), prefs, Math.max(20, e.props.bodyColumns - 4), { Box, Text })
    // Claude Code draws nothing here itself; only another mod's tree is kept.
    const theirs = await next(e)
    return theirs && theirs.type !== 'engine' ? Box({ flexDirection: 'column', children: [band, theirs] }) : band
  })

  on('command.run', { command: 'band' }, async ($, e) => {
    const args = (e.args || '').trim()
    if (!args) {
      await $.ui.open({ id: PANE, title: 'status-band', focus: true, closeOnEscape: true })
      return {}
    }
    if (args === 'help') return { text: describePrefs(prefs) }
    const result = applyArgs(prefs, args)
    if (typeof result === 'string') return { text: result }
    await savePrefs($, result)
    return { text: describePrefs(prefs) }
  })

  // The /band picker: one row per theme, previewed with this session's own
  // figures, then the shape, layout, glyph and time choices.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const snap = await snapshot($)
    const previewColumns = Math.max(30, (e.props.bodyColumns || 80) - 17)
    const choose = (key, value) => () => savePrefs($, { ...prefs, [key]: value })

    const themeRows = THEME_NAMES.map((name, i) => {
      const active = prefs.theme === name
      return Box({
        flexDirection: 'row',
        columnGap: 1,
        children: [
          Text({ color: THEMES[name].accent, children: [active ? '❯' : ' '] }),
          Box({
            width: 12,
            flexShrink: 0,
            children: [
              Button({
                key: 'theme-' + name,
                label: THEMES[name].label,
                hotkey: String(i + 1),
                plain: true,
                dimColor: !active,
                onPress: choose('theme', name),
              }),
            ],
          }),
          drawBand(snap, { ...prefs, theme: name, rows: 1, width: 'fit' }, previewColumns, { Box, Text }),
        ],
      })
    })

    const optionRow = (title, key, options) =>
      Box({
        flexDirection: 'row',
        columnGap: 3,
        children: [
          Box({ width: 7, flexShrink: 0, children: [Text({ dimColor: true, children: [title] })] }),
          ...options.map(([value, label, hotkey]) =>
            Button({
              key: key + '-' + value,
              label,
              hotkey,
              plain: true,
              dimColor: prefs[key] !== value,
              onPress: choose(key, value),
            }),
          ),
        ],
      })

    return Box({
      flexDirection: 'column',
      rowGap: 0,
      children: [
        ...themeRows,
        Text({ children: [' '] }),
        optionRow('shape', 'shape', [
          ['auto', 'theme default', 'd'],
          ['chips', 'chips', 'c'],
          ['arrows', 'arrows', 'a'],
          ['line', 'line', 'l'],
          ['band', 'one band', 'w'],
        ]),
        optionRow('width', 'width', [
          ['full', 'full width', 'f'],
          ['fit', 'fit content', 'i'],
        ]),
        optionRow('rows', 'rows', [
          [2, 'up to two', 'm'],
          [1, 'one row', 's'],
        ]),
        optionRow('glyphs', 'glyphs', [
          ['unicode', 'unicode', 'u'],
          ['nerd', 'nerd font', 'n'],
          ['ascii', 'plain ascii', 'p'],
        ]),
        optionRow('time', 'time', [
          ['elapsed', 'session time', 'e'],
          ['clock', 'clock 24h', 'k'],
          ['clock12', 'clock 12h', 'h'],
          ['off', 'off', 'o'],
        ]),
        Text({ children: [' '] }),
        Text({ dimColor: true, children: ['Saved for every session. Esc closes. /band help shows the current setup.'] }),
      ],
    })
  })
}
