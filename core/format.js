// Small, pure formatters shared by the mod and the statusLine script.

// claude-opus-5-5 → Opus 5.5, claude-haiku-4-5-20251001 → Haiku 4.5,
// claude-sonnet-5-5[1m] → Sonnet 5.5. Anything else is shown as given.
export function modelName(id, displayName) {
  const raw = String(id || '')
  const m = raw.match(/^(?:[a-z0-9.-]+\.)?claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:-v\d+(?::\d+)?)?(\[1m\])?$/i)
  if (m) {
    const family = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
    return `${family} ${m[2]}${m[3] ? '.' + m[3] : ''}`
  }
  return displayName || raw || 'Claude'
}

const EFFORT_PIPS = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 }

export function effortPips(level) {
  return EFFORT_PIPS[level] || 0
}

// Three levels of detail for a path:
//   0  ~/code/cc-status-band   (long paths keep their last three parts)
//   1  ~/c/cc-status-band      (every parent cut to its first letter)
//   2  cc-status-band
export function formatPath(cwd, home, level = 0) {
  if (!cwd) return ''
  let p = String(cwd).replace(/\\/g, '/')
  if (home) {
    const h = String(home).replace(/\\/g, '/').replace(/\/$/, '')
    if (p === h) p = '~'
    else if (p.startsWith(h + '/')) p = '~' + p.slice(h.length)
  }
  const parts = p.split('/')
  const base = parts[parts.length - 1] || p
  if (level >= 2) return base
  if (level === 1) {
    return parts
      .map((part, i) => {
        if (i === parts.length - 1 || part === '' || part === '~') return part
        const start = part.startsWith('.') ? 2 : 1
        return Array.from(part).slice(0, start).join('')
      })
      .join('/')
  }
  if (parts.length > 5) return [parts[0] === '~' ? '~' : '', '…', ...parts.slice(-3)].join('/')
  return p
}

// 23m · 1h48m · 2d5h
export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return ''
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h${String(mins % 60).padStart(2, '0')}m`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days}d${hours % 24}h` : `${days}d`
}

// Time until a window refills, coarser than a duration: 38m · 2h14m · 3d
export function formatResetIn(resetsAt, now) {
  if (resetsAt == null || now == null) return ''
  const ms = resetsAt - now
  if (ms <= 0) return 'now'
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 10) return `${hours}h${String(mins % 60).padStart(2, '0')}m`
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return days < 3 && hours % 24 ? `${days}d${hours % 24}h` : `${days}d`
}

// The wall clock in the machine's time zone: 13:24, or 01:24PM with `twelve`.
export function formatClock(ms, twelve = false) {
  if (ms == null || !Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (!twelve) return `${String(d.getHours()).padStart(2, '0')}:${mm}`
  const h = d.getHours() % 12 || 12
  return `${String(h).padStart(2, '0')}:${mm}${d.getHours() < 12 ? 'AM' : 'PM'}`
}

// 950 · 84k · 1.2M
export function formatTokens(n) {
  if (n == null || !Number.isFinite(n)) return ''
  if (n < 1000) return String(Math.round(n))
  if (n < 1e6) return `${Math.round(n / 1000)}k`
  const m = n / 1e6
  return `${m >= 10 || Number.isInteger(m) ? Math.round(m) : m.toFixed(1)}M`
}

export function formatUsd(usd) {
  if (usd == null || !Number.isFinite(usd)) return ''
  if (usd >= 100) return `$${Math.round(usd)}`
  return `$${usd.toFixed(2)}`
}

// Terminal cells a string takes: wide East Asian characters count two, and
// combining marks and zero-width joiners count none.
export function textWidth(s) {
  let w = 0
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0)
    if (cp === 0x200d || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0xfe00 && cp <= 0xfe0f)) continue
    if (
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x3fffd)
    ) {
      w += 2
    } else {
      w += 1
    }
  }
  return w
}
