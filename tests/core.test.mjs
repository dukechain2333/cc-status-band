// Unit tests for the shared core. Run with `node --test tests/`.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { layoutBand, measure, paint, renderRuns } from '../core/band.js'
import { to256, toAnsi } from '../core/ansi.js'
import { DEMOS } from '../core/demo.js'
import { formatClock, formatPath, formatResetIn, formatTokens, modelName, textWidth } from '../core/format.js'
import { parseGitStatus } from '../core/git.js'
import { fromSession, fromStatusLine } from '../core/snapshot.js'

// Rows of runs → their text, one line per row.
const plain = (rows) => rows.map((row) => row.map((r) => r.text).join('')).join('\n')

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
  const band = layoutBand(DEMOS.steady, { theme: 'clay' }, 200)
  assert.deepEqual(
    band.segments.map((s) => s.id),
    ['host', 'model', 'dir', 'git', 'ctx', '5h', '7d', 'cost'],
  )
  const text = plain(paint(band))
  for (const part of ['you@macbook', 'Opus 5.5', '●●●●○', '~/code/cc-status-band', 'main +2 ~3 ↑1', '42%', '84k/200k', '72% left ↻2h14m', '59% left ↻3d', '$1.42', '23m']) {
    assert.ok(text.includes(part), `missing ${part} in ${text}`)
  }
})

test('every row fits the width it was given, and a stretched band fills it', () => {
  for (const shape of ['chips', 'arrows', 'line', 'band']) {
    for (const glyphs of ['unicode', 'nerd', 'ascii']) {
      for (const rows of [1, 2]) {
        for (const columns of [200, 160, 120, 100, 84, 64, 56]) {
          const band = layoutBand(DEMOS.hot, { theme: 'clay', shape, glyphs, rows }, columns)
          const label = `${shape}/${glyphs}/${rows} rows at ${columns}`
          assert.ok(band.rows.length <= rows, label)
          paint(band).forEach((runs, r) => {
            const width = textWidth(runs.map((run) => run.text).join(''))
            if (band.fill) assert.equal(width, columns, label)
            else assert.equal(width, measure(band.rows[r], band.shape, band.glyphs), label)
            assert.ok(width <= columns, `${label}: row ${r} is ${width} wide`)
          })
        }
      }
    }
  }
})

test('a wide terminal gets one line, centred in a two-row band, usage at the right end', () => {
  const band = layoutBand(DEMOS.steady, { theme: 'clay' }, 200)
  assert.equal(band.rows.length, 1)
  const [top, middle, bottom] = plain(paint(band)).split('\n')
  assert.equal(top, ' ' + '▄'.repeat(198) + ' ')
  assert.equal(bottom, ' ' + '▀'.repeat(198) + ' ')
  assert.ok(middle.startsWith('▐ you@macbook') && middle.endsWith(' ▌'), middle)
  assert.equal(textWidth(middle), 200)
  assert.match(middle, /main \+2 ~3 ↑1 {4,}ctx/)
})

test('two lines join into one block with stepped corners', () => {
  const lines = plain(renderRuns(DEMOS.steady, { theme: 'clay' }, 150)).split('\n')
  assert.equal(lines.length, 2)
  assert.ok(lines[0].startsWith('▗ ') && lines[0].endsWith(' ▖'), lines[0])
  assert.ok(lines[1].startsWith('▝ ') && lines[1].endsWith(' ▘'), lines[1])
  // One fill from edge to edge on both rows: the rows meet with no seam
  const rows = paint(layoutBand(DEMOS.steady, { theme: 'clay' }, 150))
  for (const runs of rows) assert.ok(runs.slice(1, -1).every((r) => r.bg === '#33302C'))
})

test('without block glyphs, or with rows 1, the band stays one flat row', () => {
  assert.equal(paint(layoutBand(DEMOS.steady, { glyphs: 'ascii' }, 220)).length, 1)
  assert.equal(paint(layoutBand(DEMOS.steady, { rows: 1 }, 220)).length, 1)
})

test('a narrower terminal splits where-you-are from how-much-is-left', () => {
  const band = layoutBand(DEMOS.steady, { theme: 'clay' }, 150)
  assert.deepEqual(
    band.rows.map((row) => row.map((seg) => seg.id)),
    [
      ['host', 'model', 'dir', 'git'],
      ['ctx', '5h', '7d', 'cost'],
    ],
  )
  const lines = plain(paint(band)).split('\n')
  assert.ok(lines.every((line) => textWidth(line) === 150))
  assert.ok(lines[1].includes('84k/200k'), 'two rows keep the detail one row would fold')
})

test('rows 1 keeps one folded row; fit keeps the band at its content width', () => {
  const one = layoutBand(DEMOS.steady, { theme: 'clay', rows: 1 }, 150)
  assert.equal(one.rows.length, 1)
  assert.ok(!plain(paint(one)).includes('84k'))
  const fit = layoutBand(DEMOS.steady, { theme: 'clay', width: 'fit' }, 220)
  assert.ok(plain(paint(fit)).split('\n').every((line) => textWidth(line) < 220))
})

test('folding drops detail before segments', () => {
  const at = (cols) => plain(renderRuns(DEMOS.steady, { theme: 'clay', rows: 1, width: 'fit' }, cols))
  assert.ok(at(112).includes('84k') === false)
  assert.ok(at(84).includes('~/c/cc-status-band'))
  assert.ok(at(84).includes('$') === false)
  assert.ok(at(56).includes('cc-status-band'))
  assert.ok(at(56).includes('5h 72%'))
})

test('a low quota keeps its countdown even when folded', () => {
  const text = plain(renderRuns(DEMOS.hot, { theme: 'clay', rows: 1 }, 56))
  assert.ok(text.includes('↻38m'), text)
})

test('colors follow the thresholds', () => {
  const colorOf = (snap, needle) => paint(layoutBand(snap, { theme: 'clay' }, 220)).flat().find((r) => r.text === needle).fg
  assert.equal(colorOf(DEMOS.steady, '42%'), '#A3C281')
  assert.equal(colorOf(DEMOS.warm, '78%'), '#E9B44C')
  assert.equal(colorOf(DEMOS.hot, '94%'), '#F0715A')
  assert.equal(colorOf(DEMOS.hot, '6%'), '#F0715A')
})

test('api-key sessions lead with spend; fresh ones do not', () => {
  const api = paint(layoutBand(DEMOS.apikey, { theme: 'clay' }, 220)).flat().find((r) => r.text === '$12.80')
  assert.equal(api.fg, '#D97757')
  assert.equal(api.bold, true)
  const fresh = paint(layoutBand(DEMOS.fresh, { theme: 'clay' }, 220)).flat().find((r) => r.text.includes('$0.00'))
  assert.notEqual(fresh.fg, '#D97757')
})

test('hidden segments stay hidden', () => {
  const band = layoutBand(DEMOS.steady, { hide: ['git', 'quota'] }, 200)
  assert.deepEqual(
    band.segments.map((s) => s.id),
    ['host', 'model', 'dir', 'ctx', 'cost'],
  )
  const only7d = layoutBand(DEMOS.steady, { hide: ['5h'] }, 200)
  assert.ok(only7d.segments.some((s) => s.id === '7d') && !only7d.segments.some((s) => s.id === '5h'))
})

test('each quota window is its own chip with its own gauge', () => {
  const band = layoutBand(DEMOS.steady, { theme: 'clay' }, 200)
  for (const id of ['5h', '7d']) {
    const seg = band.segments.find((s) => s.id === id)
    assert.ok(seg.items.some((item) => item.bar != null), `${id} has a bar`)
  }
})

test('hiding cost keeps the time', () => {
  const snap = { ...DEMOS.steady, now: new Date(2026, 9, 3, 13, 24).getTime() }
  const text = plain(renderRuns(snap, { hide: ['cost'], time: 'clock12' }, 200))
  assert.ok(text.includes('$') === false, text)
  assert.ok(text.includes('◷ 01:24PM'), text)
  const none = layoutBand(snap, { hide: ['cost'], time: 'off' }, 200)
  assert.ok(!none.segments.some((s) => s.id === 'cost'))
})

test('the band shape is one fill split by dividers', () => {
  const band = layoutBand(DEMOS.steady, { theme: 'clay', shape: 'band', glyphs: 'nerd', width: 'fit', rows: 1 }, 220)
  const runs = paint(band)[0]
  const text = plain([runs])
  assert.ok(text.startsWith('\uE0B6') && text.endsWith('\uE0B4'), text)
  assert.equal(text.split(' │ ').length, band.segments.length)
  const inside = runs.slice(1, -1)
  assert.ok(inside.every((r) => r.bg === '#33302C'), 'one fill from cap to cap')
  assert.equal(runs.find((r) => r.text === 'Opus 5.5').fg, '#E8E5DA')
})

test('the model stays legible on a bare row', () => {
  const runs = paint(layoutBand(DEMOS.steady, { theme: 'clay', shape: 'line' }, 220)).flat()
  assert.equal(runs.find((r) => r.text === 'Opus 5.5').fg, '#E8E5DA')
})

test('the host segment reads user@host', () => {
  const text = plain(renderRuns({ ...DEMOS.steady, user: 'william', host: 'macbook' }, { theme: 'clay' }, 220)).split('\n')[1]
  assert.ok(text.startsWith('▐ william@macbook │ ✻ Opus 5.5'), text)
  assert.ok(!plain(renderRuns(DEMOS.steady, { hide: ['host'] }, 220)).includes('@'))
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
