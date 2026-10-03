// Tests for the mod itself. Run with `claude plugin test`.

import { expect, mock, test } from 'claude-code/testing'

const ABOVE = {
  plugin: 'status-band',
  component: 'AbovePrompt',
  surface: 'terminal',
  viewport: { columns: 200, rows: 40 },
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 196, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

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
  on('env.get', ($, e) => ({ value: { HOME: '/Users/you', USER: 'you' }[e.name] }))
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
  on('process.run', ($, e) => ({ value: { exitCode: 0, stdout: e.argv[0] === 'hostname' ? 'macbook\n' : GIT, stderr: '' } }))
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

// Everything a mounted band shows, every row of it.
async function bandText(ui): Promise<string> {
  return textOf((await ui.find({ type: 'Box' })) ?? (await ui.find({ type: 'Text', text: /Opus/ })))
}

function textOf(node): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children ?? node.props?.children)
}

test('by default the band draws above the prompt with every segment', async ($, on) => {
  session(on)
  await start($)
  const ui = await $.ui.mount(ABOVE)
  const text = await bandText(ui)
  for (const part of ['you@macbook', 'Opus 5.5', '●●●○○', '~/code/cc-status-band', 'main', '42%', '72% left', '59% left', '$1.42']) {
    expect(text).toContain(part)
  }
})

test('/band with words saves the choice and redraws', async ($, on) => {
  const { saved } = session(on)
  await start($)
  const answer = await $.command.run({ command: 'band', args: 'aurora line nerd' })
  expect(answer.text).toContain('theme aurora')
  expect(saved.get('prefs')).toMatchObject({ theme: 'aurora', shape: 'line', glyphs: 'nerd' })
})

test('/band time switches the cost segment to the wall clock', async ($, on) => {
  const { saved } = session(on)
  await start($)
  const answer = await $.command.run({ command: 'band', args: 'time clock12' })
  expect(answer.text).toContain('time clock12')
  expect(saved.get('prefs')).toMatchObject({ time: 'clock12' })
  const ui = await $.ui.mount(ABOVE)
  expect(await bandText(ui)).toMatch(/\$1\.42 {2}◷ \d\d:\d\d[AP]M/)
})

test('/band hide cost keeps the clock', async ($, on) => {
  const { saved } = session(on)
  await start($)
  await $.command.run({ command: 'band', args: 'time clock' })
  await $.command.run({ command: 'band', args: 'hide cost' })
  expect(saved.get('prefs')).toMatchObject({ time: 'clock', hide: ['cost'] })
  const text = await bandText(await $.ui.mount(ABOVE))
  expect(text).not.toContain('$1.42')
  expect(text).toMatch(/◷ \d\d:\d\d/)
})

test('the band only sits above the prompt: /band below is refused', async ($, on) => {
  const { saved } = session(on)
  await start($)
  const answer = await $.command.run({ command: 'band', args: 'below' })
  expect(answer.text).toBe('The band always sits above the prompt.')
  expect(saved.get('prefs')).toBeUndefined()
})

test('a place saved by an older version is ignored', async ($, on) => {
  session(on, new Map([['prefs', { place: 'below', theme: 'aurora' }]]))
  await start($)
  expect(await bandText(await $.ui.mount(ABOVE))).toContain('Opus 5.5')
  expect((await $.command.run({ command: 'band', args: 'help' })).text).not.toContain('below')
})

test('/band rejects a word it does not know', async ($, on) => {
  const { saved } = session(on)
  await start($)
  const answer = await $.command.run({ command: 'band', args: 'neon' })
  expect(answer.text).toContain('Unknown option "neon"')
  expect(saved.get('prefs')).toBeUndefined()
})

test('the hint line under the prompt is left alone', async ($, on) => {
  session(on)
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
