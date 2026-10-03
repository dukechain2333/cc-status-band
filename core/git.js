// Parses `git status --porcelain=v2 --branch` into what the git segment shows.
// Both renderers run git themselves (the mod through $.process.run, the
// statusLine script through child_process) and hand the output here.

export const GIT_STATUS_ARGS = ['--no-optional-locks', 'status', '--porcelain=v2', '--branch']

export function parseGitStatus(stdout) {
  if (!stdout) return null
  let branch = null
  let oid = null
  let ahead = 0
  let behind = 0
  let staged = 0
  let changed = 0
  for (const line of String(stdout).split('\n')) {
    if (line.startsWith('# branch.head ')) branch = line.slice(14).trim()
    else if (line.startsWith('# branch.oid ')) oid = line.slice(13).trim()
    else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/\+(\d+) -(\d+)/)
      if (m) {
        ahead = Number(m[1])
        behind = Number(m[2])
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const xy = line.slice(2, 4)
      if (xy[0] !== '.') staged += 1
      if (xy[1] !== '.') changed += 1
    } else if (line.startsWith('u ') || line.startsWith('? ')) {
      changed += 1
    }
  }
  if (!branch) return null
  if (branch === '(detached)') branch = oid && oid !== '(initial)' ? oid.slice(0, 7) : 'detached'
  return { branch, staged, changed, ahead, behind }
}
