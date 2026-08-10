# SECTION 2 — AXES / HUD TAPE FORMULA
*Four projections, four different amounts of axis — because the amount of axis
must equal the amount of science.*
Connected to: `SECTION2-DATA.md` (the mappings the tapes read).

---

## 1. THE ONE LAW

**A tape reads the exact expression that placed the points.** Never a
re-derived scale, never a prettified domain. If the two can drift, the axis is
a decoration that lies.

## 2. DOMAINS ARE DATASET PROPERTIES, NOT VIEW PROPERTIES

Both orbit domains are computed once over the **whole archive** and cached:
```
xToWorld(v) = 0.06 + 0.88 * (log10(v) − xmin) / (xmax − xmin)      orbper
yToWorld(v) = 1 − (0.06 + 0.88 * (log10(v) − ymin) / (ymax − ymin))  rade
xFromWorld / yFromWorld are the exact inverses
```
So filtering to TRANSIT does **not** rescale the axis: a day is the same
distance in every population, and the shape of the change is readable.
The 0.06 / 0.88 pad leaves 6% margin at each end for the marks' own radius.

Only the *decorative envelope* follows the visible cloud.

## 3. ENVELOPE — where the tape sits

Screen-space bounding box of the currently visible **resolved** points,
approached exponentially rather than snapped:
```
k = 1 − exp(−dt / 0.055)          ≈ 160 ms perceived settling
cur += (target − cur) * k          per frame, per edge
settled when max |Δ| < 0.4 px
```
It reads like an instrument acquiring a field, not a box jumping.

Placement:
```
ax  = min(env.x1 + 26, annoLeftEdge − 10, w − 14)     vertical tape x
ay  = min(env.y1 + 26, bottom caption reserve)        horizontal tape y
top = max(env.y0, top reserve = FIELD PROJECTION panel bottom)
```
The tape is furniture: it yields to the caption strip, to the FIELD PROJECTION
overlay, and to the unresolved cloud's annotation — measured from the DOM
elements themselves, not hard-coded.

## 4. TICKS

**Log tapes** — 1-2-5 per decade, `major = (m === 1)`, emitted only inside the
visible domain. Major 8px + label, minor 4px, no label.
Labels: `1.5K`, `2.4M`, `1B` rollover (the period domain really reaches ~4×10⁸ d),
2 decimals below 1, whole numbers above.
Collision guard: 64px minimum label pitch (84px narrow); vertical uses 55% of it.

**Linear tape (DISCOVERY TIME)** — step chosen from `[1,2,5,10,25,50]`, the
first whose pixel pitch ≥ 58px (74px narrow). Minor step 1 year when ≥7px/yr.
**Only whole years are ever emitted** — no 2018.5 can exist. At step ≥5 a
`rgba(150,170,255,0.07)` guide runs up into the field: reference, not a grid.

## 5. COLOURS + WEIGHT

```
line   rgba(150,170,255,0.42)     axis + major ticks
dim    rgba(150,170,255,0.22)     minor ticks, titles, brackets
text   #8f9ad4                    tick labels
font   9.5px "IBM Plex Mono"      lineWidth 1 everywhere
```
Titles are drawn *inside* the tape (right-aligned above the horizontal, rotated
90° on the vertical) so the tape needs no outer clearance.

## 6. PER-PROJECTION AXIS BUDGET

| projection | bottom | right | title |
|---|---|---|---|
| ORBIT × SIZE | log period tape | log radius tape | `ORBITAL PERIOD [D]` / `PLANET RADIUS [R⊕]` (narrow: `PERIOD [D]` / `R⊕`) |
| DISCOVERY TIME | linear year tape | **unnumbered bracket** | `T // DISCOVERY YEAR` + rotated `Y // DISPLAY SPREAD · NO DATA AXIS` |
| EARTH DISTANCE | radial range rings | — | origin SOL, radius only |
| SPATIAL RA+DEC | RA heading tape | DEC elevation tape | fixed px/deg HUD strips |

The DISCOVERY TIME right side is the rule made visible: y there is
`0.08 + 0.84 · hash01(name)`, a display spread. It gets a **shape and a
disclosure, never a scale** — putting ticks on it would invent a measurement.
The caption picks the longest of four strings that fits the bracket height
(`Y // DISPLAY SPREAD · NO DATA AXIS` → `SPREAD`); if none fit, none is drawn,
because the footer already states `Y: DISPLAY DISTRIBUTION`.

## 7. CORNER BRACKETS

12px L-marks at the three unused corners imply the plot box without closing it.
A closed box would read as a chart frame; the field is not a chart.

## 8. TARGET CURSOR (DISCOVERY TIME)

A vertical line at the target's own year plus a 9px caret on the tape:
locked = solid `rgba(214,224,255,0.55)` + `#e6e9fb` caret;
preview = dashed `[3,4]`, `rgba(150,170,255,0.4)`.
Label `DISCOVERED // 2016` clamped inside the tape span.

## 9. AXES CROSS-FADE WITH THE POINTS

During a projection morph the tapes are not switched, they are alpha-mixed on
the same clock: source fades out over the first 35%, destination fades in over
the last 35%, so the **points own the middle of the move**. The pixel mapping
(fit rect, pan, zoom) is interpolated too — the frame and the data change
together as one continuous motion, never a jump followed by a slide.
