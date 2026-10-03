// Builds the band's snapshot (see band.js) from what each host hands over:
// the statusLine command's stdin JSON, or the mods API's session figures.

import { modelName } from './format.js'

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function window(usedPercent, resetsAt) {
  const used = num(usedPercent)
  return used == null ? null : { left: 100 - used, resetsAt: resetsAt || null }
}

// The JSON Claude Code pipes to a statusLine command.
export function fromStatusLine(input, { home, now, git } = {}) {
  const i = input || {}
  const ctx = i.context_window || {}
  const rl = i.rate_limits || {}
  const sec = (v) => (num(v) == null ? null : v * 1000)
  return {
    model: modelName(i.model && i.model.id, i.model && i.model.display_name),
    effort: (i.effort && i.effort.level) || null,
    cwd: (i.workspace && i.workspace.current_dir) || i.cwd || '',
    home: home || '',
    git: git || null,
    context: {
      percent: num(ctx.used_percentage),
      tokens: num(ctx.total_input_tokens),
      window: num(ctx.context_window_size),
    },
    limits: {
      five: rl.five_hour ? window(rl.five_hour.used_percentage, sec(rl.five_hour.resets_at)) : null,
      seven: rl.seven_day ? window(rl.seven_day.used_percentage, sec(rl.seven_day.resets_at)) : null,
      spend: rl.spend_limit ? window(rl.spend_limit.used_percentage, sec(rl.spend_limit.resets_at)) : null,
    },
    cost: num(i.cost && i.cost.total_cost_usd),
    elapsedMs: num(i.cost && i.cost.total_duration_ms),
    now: now || Date.now(),
  }
}

// What a mod reads through $.session: model(), cwd() and usage().
export function fromSession({ modelId, effort, cwd, home, usage, git, now }) {
  const u = usage || {}
  const ctx = u.context || {}
  const limits = { five: null, seven: null, spend: null }
  for (const rl of u.rateLimits || []) {
    const key = rl.kind === 'five_hour' ? 'five' : rl.kind === 'seven_day' ? 'seven' : rl.kind === 'spend_limit' ? 'spend' : null
    if (key) limits[key] = window(rl.percentUsed, rl.resetsAt ? Date.parse(rl.resetsAt) : null)
  }
  const t = now || Date.now()
  return {
    model: modelName(modelId),
    effort: typeof effort === 'string' ? effort : null,
    cwd: cwd || '',
    home: home || '',
    git: git || null,
    context: {
      percent: num(ctx.percent),
      tokens: num(ctx.tokens),
      window: num(ctx.window),
    },
    limits,
    cost: u.cost ? num(u.cost.usd) : null,
    elapsedMs: num(u.startedAt) == null ? null : Math.max(0, t - u.startedAt),
    now: t,
  }
}
