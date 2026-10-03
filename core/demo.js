// Sample snapshots, the same five states the design canvas shows. Used by
// `--demo`, the preview script and the tests.

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const base = {
  user: 'you',
  host: 'macbook',
  model: 'Opus 5.5',
  effort: 'xhigh',
  cwd: '/Users/you/code/cc-status-band',
  home: '/Users/you',
  now: NOW,
}

export const DEMOS = {
  fresh: {
    ...base,
    git: { branch: 'main', staged: 0, changed: 0, ahead: 0, behind: 0 },
    context: { percent: null, tokens: 0, window: 200000 },
    limits: { five: null, seven: null, spend: null },
    cost: 0,
    elapsedMs: 0,
  },
  steady: {
    ...base,
    git: { branch: 'main', staged: 2, changed: 3, ahead: 1, behind: 0 },
    context: { percent: 42, tokens: 84000, window: 200000 },
    limits: {
      five: { left: 72, resetsAt: NOW + 2 * HOUR + 14 * MIN },
      seven: { left: 59, resetsAt: NOW + 3 * DAY },
      spend: null,
    },
    cost: 1.42,
    elapsedMs: 23 * MIN,
  },
  warm: {
    ...base,
    git: { branch: 'feat/themes', staged: 9, changed: 14, ahead: 3, behind: 0 },
    context: { percent: 78, tokens: 156000, window: 200000 },
    limits: {
      five: { left: 31, resetsAt: NOW + HOUR + 2 * MIN },
      seven: { left: 34, resetsAt: NOW + 2 * DAY },
      spend: null,
    },
    cost: 6.75,
    elapsedMs: HOUR + 48 * MIN,
  },
  hot: {
    ...base,
    effort: 'max',
    git: { branch: 'feat/themes', staged: 21, changed: 30, ahead: 5, behind: 0 },
    context: { percent: 94, tokens: 188000, window: 200000 },
    limits: {
      five: { left: 6, resetsAt: NOW + 38 * MIN },
      seven: { left: 12, resetsAt: NOW + 19 * HOUR },
      spend: null,
    },
    cost: 14.1,
    elapsedMs: 3 * HOUR + 5 * MIN,
  },
  apikey: {
    ...base,
    model: 'Sonnet 5.5',
    effort: 'high',
    git: { branch: 'main', staged: 2, changed: 3, ahead: 0, behind: 0 },
    context: { percent: 42, tokens: 84000, window: 200000 },
    limits: { five: null, seven: null, spend: null },
    cost: 12.8,
    elapsedMs: 52 * MIN,
  },
}
