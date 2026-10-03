// Runs → a mod element tree. Takes the `Text` constructor that
// `$.ui.resolve(e)` hands out, so this file never touches the mods API.

function span(Text, run) {
  const props = { children: [run.text] }
  if (run.fg) props.color = run.fg
  if (run.bg) props.backgroundColor = run.bg
  if (run.bold) props.bold = true
  return Text(props)
}

// One Text per row; a row never wraps, and whatever doesn't fit is cut at the end.
export function toElements(rows, { Box, Text }) {
  const lines = rows.map((runs) => Text({ wrap: 'truncate-end', children: runs.map((run) => span(Text, run)) }))
  return lines.length === 1 ? lines[0] : Box({ flexDirection: 'column', children: lines })
}
