// Tests for the mod itself. Run with `claude plugin test`.

import { expect, mock, test } from 'claude-code/testing'

const HINT = {
  plugin: 'status-band',
  component: 'PromptHint',
  surface: 'terminal',
  viewport: { columns: 164, rows: 40 },
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

const PANE = {
  plugin: 'status-band',
  component: 'Pane',
  surface: 'terminal',
  requestId: 'status-band',
  viewport: { columns: 140, rows: 40 },
  props: {
    title: 'status-band',
    isFocused: true,
    bodyColumns: 130,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 14 },
    view: {},
  },
} as const

const GIT = ['# branch.oid 1234567', '# branch.head main', '# branch.ab +1 -0', '1 .M N... 100644 100644 100644 a b x.js'].join('\n')

// Answers everything the mod asks Claude Code for, with a store the test can read.
function session(on, saved = new Map<string, unknown>()) {
  const clock = mock.clock(on, { now: Date.parse('2026-10-03T12:00:00Z') })
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('store.set', ($, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/Users/you' : undefined }))
  on('settings.read', () => ({ value: { effortLevel: 'high' } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.cwd', () => ({ value: '/Users/you/code/cc-status-band' }))
  on('session.usage', () => ({
    value: {
      startedAt: Date.parse('2026-10-03T11:37:00Z'),
      context: { tokens: 84000, window: 200000, percent: 42 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 28, resetsAt: '2026-10-03T14:14:00Z' },
        { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-10-06T12:00:00Z' },
      ],
      cost: { usd: 1.42 },
    },
  }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: GIT, stderr: '' } }))
  on('command.register', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', () => ({ cwd: '/Users/you/code/cc-status-band' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['? for shortcuts'] }))
  return { clock, saved }
}

async function start($) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/Users/you/code/cc-status-band' })
}

function textOf(node): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children ?? node.props?.children)
}

test('the band draws under the prompt with every segment', async ($, on) => {
  session(on)
  await start($)
  const ui = await $.ui.mount(HINT)
  const band = await ui.find({ type: 'Text', text: /Opus 5\.5/ })
  expect(band).toBeDefined()
  const text = textOf(band)
  for (const part of ['Opus 5.5', '●●●○○', '~/code/cc-status-band', 'main', '42%', '72% left', '7d 59%', '$1.42']) {
    expect(text).toContain(part)
  }
  // Claude Code's own hint line stays beneath the band
  expect(await ui.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
})

test('/band with words saves the choice and redraws', async ($, on) => {
  const { saved } = session(on)
  await start($)
  const answer = await $.command.run({ command: 'band', args: 'aurora line nerd' })
  expect(answer.text).toContain('theme aurora')
  expect(saved.get('prefs')).toMatchObject({ theme: 'aurora', shape: 'line', glyphs: 'nerd', place: 'below' })
})

test('/band rejects a word it does not know', async ($, on) => {
  const { saved } = session(on)
  await start($)
  const answer = await $.command.run({ command: 'band', args: 'neon' })
  expect(answer.text).toContain('Unknown option "neon"')
  expect(saved.get('prefs')).toBeUndefined()
})

test('moving the band above the prompt leaves the hint line alone', async ($, on) => {
  session(on, new Map([['prefs', { place: 'above' }]]))
  await start($)
  const ui = await $.ui.mount(HINT)
  expect(await ui.find({ type: 'Text', text: /Opus/ })).toBeUndefined()
})

test('the picker previews every theme and saves a press', async ($, on) => {
  const { saved } = session(on)
  await start($)
  await $.command.run({ command: 'band', args: '' })
  const ui = await $.ui.mount(PANE)
  for (const key of ['theme-clay', 'theme-paper', 'theme-aurora', 'theme-ink']) {
    expect(await ui.find({ key })).toBeDefined()
  }
  await ui.press({ key: 'theme-paper' })
  await ui.press({ key: 'shape-arrows' })
  expect(saved.get('prefs')).toMatchObject({ theme: 'paper', shape: 'arrows' })
})
