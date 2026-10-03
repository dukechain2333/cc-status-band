# Design notes

The band was laid out on a Claude Design canvas before any code was written: an overview in a terminal window, an annotated anatomy, the four themes and three shapes, five session states, four widths, and the `/band` picker. This file records what that canvas decided, so the code has something to be checked against.

## Principles

- **One row, always.** The band folds detail away rather than wrapping or growing a second line.
- **Color carries urgency; layout doesn't move.** A segment never changes position because a number crossed a threshold. Only its color does.
- **Remaining, not spent.** Quota is shown as what is left, with a bar that drains, because that is the number you act on.
- **Quiet by default.** Labels (`ctx`, `5h`, `left`) and secondary numbers use the muted tone; the figures that matter are bold.

## Anatomy

Left to right, in the order you glance at them:

1. **Model · effort.** The accent chip. `✻` marks Claude, five pips mark effort (`low` 1 … `max` 5).
2. **Directory.** `~`-relative and bold.
3. **Git.** Branch, then `+staged ~changed ↑ahead ↓behind`.
4. **Context.** A ten-cell gauge (`━` filled, `─` track, `╸` for half a cell), percent used, tokens over window.
5. **Quota left.** The first window gets the gauge, the percent, `left` and a `↻` countdown; later windows get percent and countdown.
6. **Cost · time.**

## Thresholds

| Gauge | ok | warn | crit |
| :- | :- | :- | :- |
| Context used | under 60% | 60–84% | 85% and up |
| Quota left | over 40% | 15–40% | under 15% |

A window in `crit` keeps its countdown through one more fold than the others, since the refill time is what matters then.

## Folding order

Each step trims one segment. The band stops at the first step that fits.

1. Cost drops the session time
2. Context gauge shortens to 6 cells and drops token counts
3. Quota drops its gauge, `left`, and the weekly countdown
4. Git collapses to branch and a dirty dot
5. Directory abbreviates parents (`~/c/cc-status-band`)
6. Cost hides, unless the session is billed by API key
7. Quota shows only the first window's percent (plus its countdown when low)
8. Git hides
9. Context becomes a number
10. Directory becomes the folder name
11. The model drops its pips
12. Cost hides even for API-key sessions
13. Quota drops its last countdown
14. Directory hides

## Palettes

Every theme has a model chip (the accent), two alternating chip tones `a` and `b`, and the three semantic colors. On a bare `line` row, the model borrows tone `a` and keeps the accent for `✻` and the pips, so on-accent text never ends up on the terminal's own background.

| Theme | Model chip | Chip a / b | ok · warn · crit | Terminal |
| :- | :- | :- | :- | :- |
| Clay | `#D97757` on `#1A1917` | `#2A2825` / `#33302C` | `#A3C281` `#E9B44C` `#F0715A` | `#1A1917` |
| Paper | `#141413` on `#FAF9F5` | `#ECE9E0` / `#E2DED3` | `#4A7533` `#9A5F0C` `#B23A27` | `#FAF9F5` |
| Aurora | `#8B6CFF` on `#0E1120` | `#1A2038` / `#232B4A` | `#6FE3D0` `#FFCB6B` `#FF6B8B` | `#0E1120` |
| Ink | no fill | no fill | `#7FB685` `#D9A54A` `#E06C5A` | `#111111` |

Full values live in [`core/themes.js`](../core/themes.js).

## Shapes

- **Chips**: separate pills one cell apart. Rounded caps with the Nerd Font glyph set (`` ``), square ends otherwise.
- **Arrows**: flush segments joined by powerline arrows (``) with Nerd Fonts, flush blocks otherwise.
- **Line**: no fills, segments separated by a dim `│`.
