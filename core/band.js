// The band's layout: a snapshot of the session goes in, one or two rows of
// colored runs come out. Both renderers share it, so the mod and the
// statusLine script fold, color and space the band the same way.
//
// A snapshot is plain data:
//
//   {
//     user: 'william', host: 'macbook',
//     model: 'Opus 5.5', effort: 'xhigh' | null,
//     cwd: '/Users/me/code/app', home: '/Users/me',
//     git: { branch, staged, changed, ahead, behind } | null,
//     context: { percent, tokens, window } | null,
//     limits: { five: { left, resetsAt }, seven: {…}, spend: {…} },   // each may be null
//     cost: 1.42 | null, elapsedMs: 1380000 | null, now: Date.now(),   // now also drives the clock
//   }
//
// `left` is the percentage of a quota window still unused, and `resetsAt` is
// epoch milliseconds.

import { effortPips, formatClock, formatDuration, formatPath, formatResetIn, formatTokens, formatUsd, textWidth } from './format.js'
import { resolveGlyphs, resolveShape, resolveTheme } from './themes.js'

export const SEGMENT_IDS = ['host', 'model', 'dir', 'git', 'ctx', '5h', '7d', 'spend', 'cost']

// The band reads as two groups: where you are, then how much you have used.
// On one row the second group sits at the right end; on two rows each group
// gets its own row.
const IDENTITY = ['host', 'model', 'dir', 'git']

// Names `hide` accepts: every segment, plus `quota` for all three windows.
// Hiding `cost` drops the dollar figure and keeps the time beside it.
export const HIDEABLE = [...SEGMENT_IDS, 'quota']

export function expandHide(list) {
  const out = new Set()
  for (const id of Array.isArray(list) ? list : []) {
    if (id === 'quota') ['5h', '7d', 'spend'].forEach((w) => out.add(w))
    else if (SEGMENT_IDS.includes(id)) out.add(id)
  }
  return [...out]
}

// What the time beside the cost shows: the session's running time, the wall
// clock (24-hour or 12-hour), or nothing.
export const TIME_MODES = ['elapsed', 'clock', 'clock12', 'off']

// Context fills up: it turns amber at 60% used and red at 85%.
export function contextRole(percent) {
  return percent >= 85 ? 'crit' : percent >= 60 ? 'warn' : 'ok'
}

// Quota drains: amber at 40% left, red under 15%.
export function quotaRole(left) {
  return left < 15 ? 'crit' : left <= 40 ? 'warn' : 'ok'
}

// When the row is too narrow, detail folds away in this order. Each step sets
// one segment's level: 0 is full, 1 compact, 2 minimal, and below 0 hidden.
// API-key sessions have no quota windows, so their cost is kept until the
// very last step.
const FOLDS = [
  ['ctx', 1],
  ['7d', 1],
  ['spend', 1],
  ['5h', 1],
  ['cost', 1],
  ['git', 1],
  ['dir', 1],
  ['cost', -1],
  ['host', -1],
  ['7d', 2],
  ['spend', 2],
  ['5h', 2],
  ['git', -1],
  ['ctx', 2],
  ['dir', 2],
  ['7d', -1],
  ['spend', -1],
  ['model', 2],
  ['cost', -2],
  ['5h', 3],
  ['dir', -1],
]

const text = (t, role, bold) => ({ text: t, role, bold: !!bold })
const bar = (percent, role, width) => ({ bar: Math.max(0, Math.min(100, percent)), role, width })

function hostSegment(s) {
  if (!s.user && !s.host) return null
  const items = []
  if (s.user) items.push(text(s.user, 'fg'))
  if (s.user && s.host) items.push(text('@', 'muted'))
  if (s.host) items.push(text(s.host, 'fg'))
  return { id: 'host', label: 'user@host', items }
}

function modelSegment(s, g, level) {
  const items = [text(g.model + ' ', 'icon'), text(s.model || 'Claude', 'fg', true)]
  const pips = effortPips(s.effort)
  if (level < 2 && pips) items.push(text(' ' + g.pipOn.repeat(pips), 'pip'), text(g.pipOff.repeat(5 - pips), 'pipOff'))
  return { id: 'model', label: 'model · effort', items }
}

function dirSegment(s, g, level) {
  const path = formatPath(s.cwd, s.home, level)
  return path ? { id: 'dir', label: 'directory', items: [text(path, 'fg', true)] } : null
}

function gitSegment(s, g, level) {
  if (!s.git || !s.git.branch) return null
  const { branch, staged, changed, ahead, behind } = s.git
  const items = []
  if (g.git) items.push(text(g.git + ' ', 'icon'))
  items.push(text(branch, 'fg'))
  if (level === 0) {
    if (staged) items.push(text(' +' + staged, 'ok'))
    if (changed) items.push(text(' ~' + changed, 'warn'))
    if (ahead) items.push(text(' ' + g.ahead + ahead, 'muted'))
    if (behind) items.push(text(' ' + g.behind + behind, 'muted'))
  } else if (staged || changed) {
    items.push(text(' ' + g.dirty, 'warn'))
  }
  return { id: 'git', label: 'git', items }
}

function ctxSegment(s, g, level) {
  if (!s.context) return null
  const { percent, tokens, window } = s.context
  const items = [text('ctx ', 'muted')]
  if (percent == null) {
    items.push(text(g.none, 'muted'))
  } else {
    const p = Math.round(percent)
    const role = contextRole(p)
    if (level < 2) items.push(bar(p, role, level === 0 ? 10 : 6), text(' ', 'fg'))
    items.push(text(p + '%', role, true))
    if (level === 0 && tokens && window) items.push(text(` ${formatTokens(tokens)}/${formatTokens(window)}`, 'muted'))
  }
  return { id: 'ctx', label: 'context window', items }
}

// One chip per quota window. Each bar drains as the window is spent.
const WINDOWS = { '5h': 'five', '7d': 'seven', spend: 'spend' }

function windowSegment(id) {
  return (s, g, level) => {
    const w = (s.limits || {})[WINDOWS[id]]
    if (!w || w.left == null) return null
    const left = Math.max(0, Math.round(w.left))
    const role = quotaRole(left)
    const reset = formatResetIn(w.resetsAt, s.now)
    const items = [text(id + ' ', 'muted')]
    if (level < 2) items.push(bar(left, role, level === 0 ? 8 : 5), text(' ', 'fg'))
    items.push(text(left + '%', role, true))
    if (level === 0) items.push(text(' left', 'muted'))
    // A low window keeps its countdown until the very last fold.
    if (reset && (level < 2 || (level === 2 && role === 'crit'))) {
      items.push(text(' ' + g.reset + reset, role === 'crit' ? 'crit' : 'muted'))
    }
    return { id, label: id === 'spend' ? 'spend limit left' : id + ' quota left', items }
  }
}

function timeText(s, time) {
  if (time === 'off') return ''
  if (time === 'clock' || time === 'clock12') return formatClock(s.now, time === 'clock12')
  return s.elapsedMs == null ? '' : formatDuration(s.elapsedMs)
}

function costSegment(s, g, level, { hero, time, hideMoney }) {
  if (level === -1 && !hero) return null
  const items = []
  if (s.cost != null && !hideMoney) items.push(text(formatUsd(s.cost), hero ? 'accent' : 'fg', hero))
  const t = level === 0 ? timeText(s, time) : ''
  if (t) items.push(text((items.length ? '  ' : '') + (g.clock ? g.clock + ' ' : '') + t, 'muted'))
  const label = hideMoney ? 'time' : hero ? 'api spend · time' : 'cost · time'
  return items.length ? { id: 'cost', label, items } : null
}

function buildSegments(s, g, levels, { hide, time }) {
  const limits = s.limits || {}
  const hideMoney = hide.includes('cost')
  // Without quota windows (API-key billing) spend is the number to watch.
  const hero = !hideMoney && !limits.five && !limits.seven && !limits.spend && s.cost > 0
  const extra = { hero, time, hideMoney }
  const out = []
  const add = (id, make) => {
    // `cost` stays to carry the time; its segment drops the money itself.
    if ((hide.includes(id) && id !== 'cost') || levels[id] < -1 || (levels[id] < 0 && id !== 'cost')) return
    const seg = make(s, g, levels[id], extra)
    if (seg) out.push(seg)
  }
  add('host', hostSegment)
  add('model', modelSegment)
  add('dir', dirSegment)
  add('git', gitSegment)
  add('ctx', ctxSegment)
  add('5h', windowSegment('5h'))
  add('7d', windowSegment('7d'))
  add('spend', windowSegment('spend'))
  add('cost', costSegment)
  return out
}

function itemWidth(item) {
  return item.bar != null ? item.width : textWidth(item.text)
}

// Cells the shape adds around n segments.
// A band has an edge glyph at each end when it is two rows tall (block
// elements) or when Nerd Font caps round it off.
function chromeWidth(shape, g, n, edged) {
  if (n === 0) return 0
  if (shape === 'line') return (n - 1) * 3
  if (shape === 'chips') return n * (2 + (g.capLeft ? 2 : 0)) + (n - 1)
  if (shape === 'band') return (n - 1) * 3 + 2 + (edged ? 2 : 0)
  return n * (2 + (g.arrow ? 1 : 0))
}

export function measure(segments, shape, g, edged = !!g.capLeft) {
  let w = chromeWidth(shape, g, segments.length, edged)
  for (const seg of segments) for (const item of seg.items) w += itemWidth(item)
  return w
}

// Lays the snapshot out in at most `rows` rows of `columns` cells.
//   options: { theme, shape, glyphs, hide, time, rows: 1 | 2, width: 'full' | 'fit' }
//
// Everything on one row when it fits at full detail. Otherwise, with two rows
// allowed, the two groups split onto their own rows, and only a row that
// still overflows folds its own segments.
export function layoutBand(snapshot, options = {}, columns = 120) {
  const theme = resolveTheme(options.theme)
  // A palette without fills has nothing to draw chips or arrows with.
  const shape = theme.model.bg ? resolveShape(options.shape, theme) : 'line'
  const glyphs = resolveGlyphs(options.glyphs)
  const maxRows = options.rows === 1 ? 1 : 2
  // With two rows allowed the band stands two rows tall: one line centred
  // between half rows of fill, or two lines when one is too short.
  const tall = shape === 'band' && maxRows === 2 && !!glyphs.padTop
  const edged = tall || !!glyphs.capLeft
  const pick = {
    hide: expandHide(options.hide),
    time: TIME_MODES.includes(options.time) ? options.time : 'elapsed',
  }
  const levels = Object.fromEntries(SEGMENT_IDS.map((id) => [id, 0]))
  const build = () => buildSegments(snapshot, glyphs, levels, pick)
  const fits = (row) => measure(row, shape, glyphs, edged) <= columns
  const split = (segs) =>
    [segs.filter((seg) => IDENTITY.includes(seg.id)), segs.filter((seg) => !IDENTITY.includes(seg.id))].filter((row) => row.length)

  let rows = [build()]
  if (!fits(rows[0])) {
    const steps = FOLDS.slice()
    if (maxRows === 2) rows = split(rows[0])
    for (;;) {
      const over = new Set(rows.filter((row) => !fits(row)).flatMap((row) => row.map((seg) => seg.id)))
      if (!over.size) break
      const next = steps.findIndex(([id]) => over.has(id))
      if (next < 0) break
      const [id, level] = steps.splice(next, 1)[0]
      levels[id] = level
      rows = maxRows === 2 ? split(build()) : [build()]
    }
  }
  return {
    rows,
    segments: rows.flat(),
    theme,
    shape,
    glyphs,
    columns,
    // Only the one-band shape stretches; other shapes keep their own width.
    fill: shape === 'band' && options.width !== 'fit',
    tall,
    edged,
  }
}

function barText(item, g) {
  const halves = Math.round((item.bar / 100) * item.width * 2) || (item.bar > 0 ? 1 : 0)
  const full = Math.min(item.width, Math.floor(halves / 2))
  const half = full < item.width && halves % 2 ? 1 : 0
  return {
    filled: g.fill.repeat(full) + (half ? g.half : ''),
    empty: g.track.repeat(item.width - full - half),
  }
}

// Turns a laid-out band into rows of runs, { text, fg, bg, bold }. A null fg
// or bg is the terminal's own color.
export function paint(band) {
  const { rows, theme: T, glyphs: g } = band
  if (band.shape !== 'band') return rows.map((row) => paintRow(row, band, {}))
  // Every row of a band shares one width, so the rows stack into one block.
  const width = band.fill ? band.columns : Math.max(...rows.map((row) => measure(row, 'band', g, band.edged)))
  if (!band.tall) return rows.map((row) => paintRow(row, band, { left: g.capLeft, right: g.capRight, width }))
  if (rows.length === 1) {
    // One line, centred: half a row of fill above and below, and edges only
    // beside the text, so each corner steps in by a quarter cell.
    const half = (glyph) => [
      { text: ' ', fg: null, bg: null },
      { text: glyph.repeat(Math.max(0, width - 2)), fg: T.b.bg, bg: null },
      { text: ' ', fg: null, bg: null },
    ]
    return [half(g.padTop), paintRow(rows[0], band, { left: g.edgeLeft, right: g.edgeRight, width }), half(g.padBottom)]
  }
  // Two lines: the edge columns fill only the inner half of each row.
  return rows.map((row, i) =>
    paintRow(row, band, {
      left: i === 0 ? g.cornerTL : g.cornerBL,
      right: i === 0 ? g.cornerTR : g.cornerBR,
      width,
    }),
  )
}

function paintRow(segments, band, frame) {
  const { theme: T, shape, glyphs: g } = band
  // On a bare row the model chip's on-accent colors would vanish into the
  // terminal, so it borrows the plain tone and keeps the accent for its marks.
  // The one-band shape does the same inside its single fill.
  const bareModel = { bg: null, fg: T.a.fg, muted: T.a.muted, icon: T.accent, pip: T.accent, pipOff: T.track }
  const single = shape === 'band'
  const toneOf = (seg, i) => {
    if (single) return seg.id === 'model' ? { ...bareModel, bg: T.b.bg } : T.b
    return seg.id === 'model' ? (shape === 'line' && T.model.bg ? bareModel : T.model) : i % 2 === 1 ? T.a : T.b
  }
  const bgOf = (i) => (shape === 'line' || !segments[i] ? null : toneOf(segments[i], i).bg)
  // A stretched band fills its spare cells: between the two groups when both
  // share the row, else at the end.
  const spare = single ? Math.max(0, frame.width - measure(segments, shape, g, band.edged)) : 0
  const groupBreak = segments.findIndex((seg) => !IDENTITY.includes(seg.id))
  const runs = []
  if (single && segments.length) {
    if (frame.left) runs.push({ text: frame.left, fg: T.b.bg, bg: null })
    runs.push({ text: ' ', fg: T.b.fg, bg: T.b.bg })
  }
  segments.forEach((seg, i) => {
    const tone = toneOf(seg, i)
    const bg = bgOf(i)
    const color = (role) =>
      ({
        fg: tone.fg,
        muted: tone.muted,
        icon: tone.icon,
        pip: tone.pip || T.model.pip,
        pipOff: tone.pipOff || T.model.pipOff,
        ok: T.ok,
        warn: T.warn,
        crit: T.crit,
        accent: T.accent,
      })[role] || tone.fg

    if (shape === 'line' && i > 0) runs.push({ text: ` ${g.sep} `, fg: T.sep, bg: null })
    if (single && i > 0 && spare && band.fill && i === groupBreak) runs.push({ text: ' '.repeat(3 + spare), fg: T.divider, bg })
    else if (single && i > 0) runs.push({ text: ` ${g.sep} `, fg: T.divider, bg })
    if (shape === 'chips' && i > 0) runs.push({ text: ' ', fg: null, bg: null })
    if (shape === 'chips' && g.capLeft) runs.push({ text: g.capLeft, fg: bg, bg: null })
    if (bg && !single) runs.push({ text: ' ', fg: tone.fg, bg })
    for (const item of seg.items) {
      if (item.bar != null) {
        const { filled, empty } = barText(item, g)
        if (filled) runs.push({ text: filled, fg: color(item.role), bg })
        if (empty) runs.push({ text: empty, fg: T.track, bg })
      } else {
        runs.push({ text: item.text, fg: color(item.role), bg, bold: item.bold })
      }
    }
    if (bg && !single) runs.push({ text: ' ', fg: tone.fg, bg })
    if (shape === 'chips' && g.capRight) runs.push({ text: g.capRight, fg: bg, bg: null })
    if (shape === 'arrows' && g.arrow) runs.push({ text: g.arrow, fg: bg, bg: bgOf(i + 1) })
  })
  if (single && segments.length) {
    if (spare && !(band.fill && groupBreak > 0)) runs.push({ text: ' '.repeat(spare), fg: T.b.fg, bg: T.b.bg })
    runs.push({ text: ' ', fg: T.b.fg, bg: T.b.bg })
    if (frame.right) runs.push({ text: frame.right, fg: T.b.bg, bg: null })
  }
  return mergeRuns(runs)
}

function mergeRuns(runs) {
  const out = []
  for (const r of runs) {
    if (!r.text) continue
    const last = out[out.length - 1]
    const plain = r.text.trim() === ''
    if (last && last.bg === r.bg && (last.fg === r.fg || plain) && !!last.bold === !!r.bold) {
      last.text += r.text
    } else {
      out.push({ text: r.text, fg: r.fg || null, bg: r.bg || null, bold: !!r.bold })
    }
  }
  return out
}

// The whole pipeline in one call: rows of runs.
export function renderRuns(snapshot, options, columns) {
  return paint(layoutBand(snapshot, options, columns))
}
