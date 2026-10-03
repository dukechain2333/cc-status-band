// The band's layout: a snapshot of the session goes in, a row of colored runs
// comes out. Both renderers share it, so the mod and the statusLine script
// fold, color and space the band the same way.
//
// A snapshot is plain data:
//
//   {
//     model: 'Opus 5.5', effort: 'xhigh' | null,
//     cwd: '/Users/me/code/app', home: '/Users/me',
//     git: { branch, staged, changed, ahead, behind } | null,
//     context: { percent, tokens, window } | null,
//     limits: { five: { left, resetsAt }, seven: {…}, spend: {…} },   // each may be null
//     cost: 1.42 | null, elapsedMs: 1380000 | null, now: Date.now(),
//   }
//
// `left` is the percentage of a quota window still unused, and `resetsAt` is
// epoch milliseconds.

import { effortPips, formatDuration, formatPath, formatResetIn, formatTokens, formatUsd, textWidth } from './format.js'
import { resolveGlyphs, resolveShape, resolveTheme } from './themes.js'

export const SEGMENT_IDS = ['model', 'dir', 'git', 'ctx', 'quota', 'cost']

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
  ['cost', 1],
  ['ctx', 1],
  ['quota', 1],
  ['git', 1],
  ['dir', 1],
  ['cost', -1],
  ['quota', 2],
  ['git', -1],
  ['ctx', 2],
  ['dir', 2],
  ['model', 2],
  ['cost', -2],
  ['quota', 3],
  ['dir', -1],
]

const text = (t, role, bold) => ({ text: t, role, bold: !!bold })
const bar = (percent, role, width) => ({ bar: Math.max(0, Math.min(100, percent)), role, width })

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

function quotaSegment(s, g, level) {
  const limits = s.limits || {}
  const windows = [
    ['5h', limits.five],
    ['7d', limits.seven],
    ['spend', limits.spend],
  ].filter(([, w]) => w && w.left != null)
  if (!windows.length) return null
  const items = []
  windows.forEach(([name, w], i) => {
    const left = Math.max(0, Math.round(w.left))
    const role = quotaRole(left)
    const reset = formatResetIn(w.resetsAt, s.now)
    if (i === 0) {
      items.push(text(name + ' ', 'muted'))
      if (level === 0) items.push(bar(left, role, 8), text(' ', 'fg'))
      items.push(text(left + '%', role, true))
      if (level === 0) items.push(text(' left', 'muted'))
      // A low window keeps its countdown until the very last fold.
      if (reset && (level < 2 || (level === 2 && role === 'crit'))) items.push(text(' ' + g.reset + reset, role === 'crit' ? 'crit' : 'muted'))
    } else if (level < 2) {
      items.push(text('  ' + name + ' ', 'muted'), text(left + '%', role, true))
      if (level === 0 && reset) items.push(text(' ' + g.reset + reset, 'muted'))
    }
  })
  return { id: 'quota', label: 'quota left', items }
}

function costSegment(s, g, level, hero) {
  if (s.cost == null && s.elapsedMs == null) return null
  if (level === -1 && !hero) return null
  const items = []
  if (s.cost != null) items.push(text(formatUsd(s.cost), hero ? 'accent' : 'fg', hero))
  if (level === 0 && s.elapsedMs != null) {
    const d = formatDuration(s.elapsedMs)
    if (d) items.push(text((items.length ? '  ' : '') + (g.clock ? g.clock + ' ' : '') + d, 'muted'))
  }
  return items.length ? { id: 'cost', label: hero ? 'api spend · time' : 'cost · time', items } : null
}

function buildSegments(s, g, levels, hide) {
  const limits = s.limits || {}
  // Without quota windows (API-key billing) spend is the number to watch.
  const hero = !limits.five && !limits.seven && !limits.spend && s.cost > 0
  const out = []
  const add = (id, make) => {
    if (hide.includes(id) || levels[id] < -1 || (levels[id] < 0 && id !== 'cost')) return
    const seg = make(s, g, levels[id], hero)
    if (seg) out.push(seg)
  }
  add('model', modelSegment)
  add('dir', dirSegment)
  add('git', gitSegment)
  add('ctx', ctxSegment)
  add('quota', quotaSegment)
  add('cost', costSegment)
  return out
}

function itemWidth(item) {
  return item.bar != null ? item.width : textWidth(item.text)
}

// Cells the shape adds around n segments.
function chromeWidth(shape, g, n) {
  if (n === 0) return 0
  if (shape === 'line') return (n - 1) * 3
  if (shape === 'chips') return n * (2 + (g.capLeft ? 2 : 0)) + (n - 1)
  return n * (2 + (g.arrow ? 1 : 0))
}

export function measure(segments, shape, g) {
  let w = chromeWidth(shape, g, segments.length)
  for (const seg of segments) for (const item of seg.items) w += itemWidth(item)
  return w
}

// Lays the snapshot out in at most `columns` cells.
//   options: { theme, shape, glyphs, hide }
export function layoutBand(snapshot, options = {}, columns = 120) {
  const theme = resolveTheme(options.theme)
  // A palette without fills has nothing to draw chips or arrows with.
  const shape = theme.model.bg ? resolveShape(options.shape, theme) : 'line'
  const glyphs = resolveGlyphs(options.glyphs)
  const hide = Array.isArray(options.hide) ? options.hide : []
  const levels = { model: 0, dir: 0, git: 0, ctx: 0, quota: 0, cost: 0 }
  let segments = buildSegments(snapshot, glyphs, levels, hide)
  for (const [id, level] of FOLDS) {
    if (measure(segments, shape, glyphs) <= columns) break
    levels[id] = level
    segments = buildSegments(snapshot, glyphs, levels, hide)
  }
  return { segments, theme, shape, glyphs, width: measure(segments, shape, glyphs) }
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

// Turns a laid-out band into runs of { text, fg, bg, bold }. A null fg or bg
// is the terminal's own color.
export function paint(band) {
  const { segments, theme: T, shape, glyphs: g } = band
  // On a bare row the model chip's on-accent colors would vanish into the
  // terminal, so it borrows the plain tone and keeps the accent for its marks.
  const bareModel = { bg: null, fg: T.a.fg, muted: T.a.muted, icon: T.accent, pip: T.accent, pipOff: T.track }
  const toneOf = (seg, i) =>
    seg.id === 'model' ? (shape === 'line' && T.model.bg ? bareModel : T.model) : i % 2 === 1 ? T.a : T.b
  const bgOf = (i) => (shape === 'line' || !segments[i] ? null : toneOf(segments[i], i).bg)
  const runs = []
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
    if (shape === 'chips' && i > 0) runs.push({ text: ' ', fg: null, bg: null })
    if (shape === 'chips' && g.capLeft) runs.push({ text: g.capLeft, fg: bg, bg: null })
    if (bg) runs.push({ text: ' ', fg: tone.fg, bg })
    for (const item of seg.items) {
      if (item.bar != null) {
        const { filled, empty } = barText(item, g)
        if (filled) runs.push({ text: filled, fg: color(item.role), bg })
        if (empty) runs.push({ text: empty, fg: T.track, bg })
      } else {
        runs.push({ text: item.text, fg: color(item.role), bg, bold: item.bold })
      }
    }
    if (bg) runs.push({ text: ' ', fg: tone.fg, bg })
    if (shape === 'chips' && g.capRight) runs.push({ text: g.capRight, fg: bg, bg: null })
    if (shape === 'arrows' && g.arrow) runs.push({ text: g.arrow, fg: bg, bg: bgOf(i + 1) })
  })
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

// The whole pipeline in one call.
export function renderRuns(snapshot, options, columns) {
  return paint(layoutBand(snapshot, options, columns))
}
