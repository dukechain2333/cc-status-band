# Design notes

The band was laid out on a Claude Design canvas before any code was written: an overview in a terminal window, an annotated anatomy, the four themes and three shapes, five session states, four widths, and the `/band` picker. This file records what that canvas decided, so the code has something to be checked against.

## Principles

- **Two rows tall, one block.** On a wide terminal one line sits centred between half rows of fill (`▄` above, `▀` below); on a narrower one the two groups take a line each. Either way the band is two rows high and reads as one shape. Detail folds away only in a line that still overflows.
- **Color carries urgency; layout doesn't move.** A segment never changes position because a number crossed a threshold. Only its color does.
- **Remaining, not spent.** Quota is shown as what is left, with a bar that drains, because that is the number you act on.
- **Quiet by default.** Labels (`ctx`, `5h`, `left`) and secondary numbers use the muted tone; the figures that matter are bold.

## Anatomy

Two groups, left to right. On one row the usage group sits at the right end, with the band's fill between them; on two rows each group has its own row.

Where you are:

0. **User · host.** `william@macbook`.
1. **Model · effort.** The accent chip. `✻` marks Claude, five pips mark effort (`low` 1 … `max` 5).
2. **Directory.** `~`-relative and bold.
3. **Git.** Branch, then `+staged ~changed ↑ahead ↓behind`.
How much you have used:

4. **Context.** A ten-cell gauge (`━` filled, `─` track, `╸` for half a cell), percent used, tokens over window.
5. **5-hour quota left.** Its own chip: an eight-cell gauge that drains, the percent, `left`, and a `↻` countdown.
6. **Weekly quota left.** The same chip for the 7-day window. A gateway spend limit gets a third.
7. **Cost · time.** The time is the session's running time or the wall clock. Hiding cost drops the dollars and keeps the time.

## Thresholds

| Gauge | ok | warn | crit |
| :- | :- | :- | :- |
| Context used | under 60% | 60–84% | 85% and up |
| Quota left | over 40% | 15–40% | under 15% |

A window in `crit` keeps its countdown through one more fold than the others, since the refill time is what matters then.

## Folding order

Each step trims one segment. The band stops at the first step that fits.

1. Context gauge shortens to 6 cells and drops token counts
2. Each quota window shortens its gauge to 5 cells and drops `left` (weekly first, then 5-hour)
3. Cost drops the time
4. Git collapses to branch and a dirty dot
5. Directory abbreviates parents (`~/c/cc-status-band`)
6. Cost hides, unless the session is billed by API key, then user@host hides
7. Quota windows become numbers (weekly first); a low window keeps its countdown
8. Git hides
9. Context becomes a number
10. Directory becomes the folder name
11. The weekly window hides
12. The model drops its pips
13. Cost hides even for API-key sessions
14. The 5-hour window drops its last countdown
15. Directory hides

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
- **Band** (default for Clay and Paper): one block around every segment, filled with tone `b`, segments split by a `│` in the theme's `divider` color, stretched to the terminal's width. The model keeps the accent for `✻` and its pips. Two rows tall by default, with stepped corners: the edge columns fill only the inner half of the band (`▐ ▌` beside a centred line, `▗ ▖ ▝ ▘` beside two lines), so each corner loses a quarter cell. Block elements are in every terminal font, so this needs no Nerd Font. With `rows 1` it is one flat row with Nerd Font caps.
- **Arrows**: flush segments joined by powerline arrows (``) with Nerd Fonts, flush blocks otherwise.
- **Line**: no fills, segments separated by a dim `│`.
