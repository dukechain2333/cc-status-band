// Unit tests for the shared core. Run with `node --test tests/`.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { layoutBand, measure, paint, renderRuns } from '../core/band.js'
import { to256, toAnsi } from '../core/ansi.js'
import { DEMOS } from '../core/demo.js'
import { formatClock, formatPath, formatResetIn, formatTokens, modelName, textWidth } from '../core/format.js'
import { parseGitStatus } from '../core/git.js'
import { fromSession, fromStatusLine } from '../core/snapshot.js'

const plain = (runs) => runs.map((r) => r.text).join('')

test('model ids become short names', () => {
  assert.equal(modelName('claude-opus-5-5'), 'Opus 5.5')
  assert.equal(modelName('claude-haiku-4-5-20251001'), 'Haiku 4.5')
  assert.equal(modelName('claude-sonnet-5-5[1m]'), 'Sonnet 5.5')
  assert.equal(modelName('claude-fable-5-1'), 'Fable 5.1')
  assert.equal(modelName('us.anthropic.claude-opus-5-5-v1:0'), 'Opus 5.5')
  assert.equal(modelName('my-proxy-model', 'Proxy'), 'Proxy')
})

test('paths fold in three steps', () => {
  const home = '/Users/you'
  assert.equal(formatPath('/Users/you/code/cc-status-band', home, 0), '~/code/cc-status-band')
  assert.equal(formatPath('/Users/you/code/cc-status-band', home, 1), '~/c/cc-status-band')
  assert.equal(formatPath('/Users/you/code/cc-status-band', home, 2), 'cc-status-band')
  assert.equal(formatPath('/Users/you/.config/nvim', home, 1), '~/.c/nvim')
  assert.equal(formatPath('/Users/you', home, 0), '~')
  assert.equal(formatPath('/a/b/c/d/e/f', home, 0), '/…/d/e/f')
})

test('durations and token counts read short', () => {
  const now = 0
  assert.equal(formatResetIn(38 * 60000, now), '38m')
  assert.equal(formatResetIn((2 * 60 + 14) * 60000, now), '2h14m')
  assert.equal(formatResetIn(19 * 3600000, now), '19h')
  assert.equal(formatResetIn(3 * 86400000, now), '3d')
  assert.equal(formatTokens(84000), '84k')
  assert.equal(formatTokens(1000000), '1M')
  assert.equal(formatTokens(1500000), '1.5M')
})

test('the clock reads in 24-hour or 12-hour form', () => {
  const at = (h, m) => new Date(2026, 9, 3, h, m).getTime()
  assert.equal(formatClock(at(13, 4)), '13:04')
  assert.equal(formatClock(at(13, 4), true), '01:04PM')
  assert.equal(formatClock(at(0, 30), true), '12:30AM')
  assert.equal(formatClock(at(9, 5)), '09:05')
})

test('the time beside the cost follows the time option', () => {
  const snap = { ...DEMOS.steady, now: new Date(2026, 9, 3, 13, 24).getTime() }
  const at = (time) => plain(renderRuns(snap, { theme: 'clay', time }, 200))
  assert.ok(at('elapsed').includes('$1.42  ◷ 23m'))
  assert.ok(at('clock').includes('$1.42  ◷ 13:24'))
  assert.ok(at('clock12').includes('$1.42  ◷ 01:24PM'))
  assert.ok(at('off').includes('◷') === false)
})

test('wide characters count two cells', () => {
  assert.equal(textWidth('abc'), 3)
  assert.equal(textWidth('剩余'), 4)
  assert.equal(textWidth('━━╸──'), 5)
})

test('git porcelain v2 parses branch, counts and divergence', () => {
  const out = [
    '# branch.oid 1234567890abcdef',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +1 -2',
    '1 M. N... 100644 100644 100644 aaa bbb staged.js',
    '1 .M N... 100644 100644 100644 aaa bbb changed.js',
    '1 MM N... 100644 100644 100644 aaa bbb both.js',
    '? new.js',
  ].join('\n')
  assert.deepEqual(parseGitStatus(out), { branch: 'main', staged: 2, changed: 3, ahead: 1, behind: 2 })
  assert.equal(parseGitStatus('# branch.oid abcdef1234\n# branch.head (detached)\n').branch, 'abcdef1')
  assert.equal(parseGitStatus(''), null)
})

test('the full band shows every segment at a wide width', () => {
  const band = layoutBand(DEMOS.steady, { theme: 'clay' }, 160)
  assert.deepEqual(
    band.segments.map((s) => s.id),
    ['model', 'dir', 'git', 'ctx', 'quota', 'cost'],
  )
  const text = plain(paint(band))
  for (const part of ['Opus 5.5', '●●●●○', '~/code/cc-status-band', 'main +2 ~3 ↑1', '42%', '84k/200k', '72% left', '↻2h14m', '7d 59%', '$1.42', '23m']) {
    assert.ok(text.includes(part), `missing ${part} in ${text}`)
  }
})

test('the band folds to fit and never exceeds the width it was given', () => {
  for (const shape of ['chips', 'arrows', 'line']) {
    for (const glyphs of ['unicode', 'nerd', 'ascii']) {
      for (const columns of [160, 120, 100, 84, 64, 56]) {
        const band = layoutBand(DEMOS.hot, { theme: 'clay', shape, glyphs }, columns)
        const width = textWidth(plain(paint(band)))
        assert.equal(width, measure(band.segments, band.shape, band.glyphs), `${shape}/${glyphs}/${columns}`)
        if (columns >= 56) assert.ok(width <= columns, `${shape}/${glyphs} at ${columns} is ${width} wide`)
      }
    }
  }
})

test('folding drops detail before segments', () => {
  const at = (cols) => plain(renderRuns(DEMOS.steady, { theme: 'clay' }, cols))
  assert.ok(at(112).includes('84k') === false)
  assert.ok(at(84).includes('~/c/cc-status-band'))
  assert.ok(at(84).includes('$') === false)
  assert.ok(at(56).includes('cc-status-band'))
  assert.ok(at(56).includes('5h 72%'))
})

test('a low quota keeps its countdown even when folded', () => {
  const text = plain(renderRuns(DEMOS.hot, { theme: 'clay' }, 56))
  assert.ok(text.includes('↻38m'), text)
})

test('colors follow the thresholds', () => {
  const colorOf = (snap, needle) => paint(layoutBand(snap, { theme: 'clay' }, 200)).find((r) => r.text === needle).fg
  assert.equal(colorOf(DEMOS.steady, '42%'), '#A3C281')
  assert.equal(colorOf(DEMOS.warm, '78%'), '#E9B44C')
  assert.equal(colorOf(DEMOS.hot, '94%'), '#F0715A')
  assert.equal(colorOf(DEMOS.hot, '6%'), '#F0715A')
})

test('api-key sessions lead with spend; fresh ones do not', () => {
  const api = paint(layoutBand(DEMOS.apikey, { theme: 'clay' }, 200)).find((r) => r.text === '$12.80')
  assert.equal(api.fg, '#D97757')
  assert.equal(api.bold, true)
  const fresh = paint(layoutBand(DEMOS.fresh, { theme: 'clay' }, 200)).find((r) => r.text.includes('$0.00'))
  assert.notEqual(fresh.fg, '#D97757')
})

test('hidden segments stay hidden', () => {
  const band = layoutBand(DEMOS.steady, { hide: ['cost', 'git'] }, 200)
  assert.deepEqual(
    band.segments.map((s) => s.id),
    ['model', 'dir', 'ctx', 'quota'],
  )
})

test('the model stays legible on a bare row', () => {
  const runs = paint(layoutBand(DEMOS.steady, { theme: 'clay', shape: 'line' }, 200))
  assert.equal(runs.find((r) => r.text === 'Opus 5.5').fg, '#E8E5DA')
})

test('statusLine JSON becomes a snapshot', () => {
  const snap = fromStatusLine(
    {
      model: { id: 'claude-opus-5-5', display_name: 'Opus' },
      workspace: { current_dir: '/Users/you/app' },
      effort: { level: 'high' },
      context_window: { used_percentage: 8, total_input_tokens: 15500, context_window_size: 200000 },
      rate_limits: { five_hour: { used_percentage: 23.5, resets_at: 1000 }, seven_day: { used_percentage: 41.2, resets_at: 2000 } },
      cost: { total_cost_usd: 0.01234, total_duration_ms: 45000 },
    },
    { home: '/Users/you', now: 500 },
  )
  assert.equal(snap.model, 'Opus 5.5')
  assert.equal(snap.effort, 'high')
  assert.equal(snap.cwd, '/Users/you/app')
  assert.equal(snap.context.percent, 8)
  assert.equal(snap.limits.five.left, 76.5)
  assert.equal(snap.limits.five.resetsAt, 1000000)
  assert.equal(snap.limits.spend, null)
  assert.equal(snap.cost, 0.01234)
})

test('missing statusLine fields leave their segments out', () => {
  const band = layoutBand(fromStatusLine({ model: { id: 'claude-opus-5-5' }, cwd: '/tmp/x' }, { now: 1 }), {}, 200)
  assert.deepEqual(
    band.segments.map((s) => s.id),
    ['model', 'dir', 'ctx'],
  )
})

test('session usage becomes a snapshot', () => {
  const snap = fromSession({
    modelId: 'claude-opus-5-5',
    effort: 'xhigh',
    cwd: '/Users/you/app',
    home: '/Users/you',
    usage: {
      startedAt: 1000,
      context: { tokens: 84000, window: 200000, percent: 42 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 28, resetsAt: '2026-10-03T14:14:00Z' },
        { kind: 'seven_day', percentUsed: 41 },
      ],
      cost: { usd: 1.42 },
    },
    now: 61000,
  })
  assert.equal(snap.limits.five.left, 72)
  assert.equal(snap.limits.five.resetsAt, Date.parse('2026-10-03T14:14:00Z'))
  assert.equal(snap.limits.seven.left, 59)
  assert.equal(snap.elapsedMs, 60000)
  assert.equal(snap.cost, 1.42)
})

test('ansi output carries truecolor or 256-color codes', () => {
  const runs = [{ text: 'hi', fg: '#D97757', bg: '#1A1917', bold: true }]
  assert.equal(toAnsi(runs), '\x1b[1;38;2;217;119;87;48;2;26;25;23mhi\x1b[0m')
  assert.equal(toAnsi(runs, '256'), `\x1b[1;38;5;${to256('#D97757')};48;5;${to256('#1A1917')}mhi\x1b[0m`)
  assert.equal(to256('#000000'), 16)
  assert.equal(to256('#FFFFFF'), 231)
})
