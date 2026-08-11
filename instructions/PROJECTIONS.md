# PROJECTIONS.md — the four field projections, in full

Every visible element of each projection: what places the points, what the tapes
track, how the indices are arranged in pixels, the OBSERVER // SOL marker and its
off-screen arrow, the distance ellipses, and the holding cloud.

Companions: `SECTION2-DATA.md` (the mappings — the arithmetic is there and is not
repeated here), `SECTION2-AXES.md` (tape formula), `EFFECT.md` (how these move),
`SOLUTION.md` (Contract D — the single `plotRect` every tape reads).

---

## 0. WHAT A PROJECTION IS

Five parts, and a projection is not complete until all five are specified:

```
1  MAPPING     record → normalised 0–1 position          SECTION2-DATA.md §4
2  FIT RECT    the normalised region the view frames      §1.1
3  FURNITURE   what is drawn that is not a data point     per projection
4  INDICES     the tapes, their ticks and their labels    §2 + per projection
5  CAPTION     what the footer and the caption strip say  per projection
```

And one rule over all four: **the amount of axis equals the amount of science.**
Two of these projections have a real measurement on both screen axes, one has a
real measurement on one axis, and one has a real measurement only in radius. The
furniture must say which is which without being read.

---

## 1. SHARED ANATOMY

### 1.1 The fit rect and per-projection view

```
fit rect      normalised, per projection:
              no unresolved records   → { 0, 0, 1, 1 }
              unresolved present      → { 0, 0, 1.26, 1 }     (room for the cloud)
view          { cx, cy, zoom } — ONE PER PROJECTION, kept independently
transform     sx = w/(fitW/zoom),  sy = h/(fitH/zoom)
              ox = w/2 − cx·sx,    oy = h/2 − cy·sy
screen        x = nx·sx + ox,  y = ny·sy + oy
```

Switching away and back returns to the frame you left. A projection change never
writes another projection's view (`EFFECT.md` §1.1).

### 1.2 Tracking the filtered set — what the tapes follow

Three different things track three different populations, and confusing them is
the most common way this reads wrong:

| what | tracks | why |
|---|---|---|
| **the domain** (what a value maps to) | the **whole archive**, cached | so filtering does not rescale the axis — a day must be the same distance in every population |
| **the envelope** (where the tape sits) | the **visible, resolved, matched** points | so the instrument frames what you are actually looking at |
| **the caption count** | matched records | it is the author speaking |

```js
envelope(t) {           // screen-space bbox, per frame
  for each record i:
    if (!resolved[i]) continue;              // holding cloud never moves the tape
    if (!matched[i])  continue;              // dimmed records never move the tape
    if (offscreen)    continue;              // culled points do not extend it
    x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y);
}
```

The envelope is **approached, never snapped**:

```
k = 1 − exp(−dt / 0.055)          ≈ 160 ms perceived settle
cur += (target − cur) · k          per edge, per frame
settled when max|Δ| < 0.4 px       → the tween leaves the set
```

That easing is the effect: change the OBSERVATION METHOD and the tape *closes in
on* the new population like an instrument acquiring a field. It is also why
rapid filter clicks never make the furniture flicker — there is nothing to
flicker, only a target that moved.

**Empty match set:** the envelope holds its last position and the tapes hold with
it at alpha 0.35. It does not collapse to a point, and it does not reset to the
fit rect. The caption carries the message (`0 of 6,336 found by Astrometry`);
the furniture does not need to also panic.

### 1.3 Where a tape may go — the one rect

Per `SOLUTION.md` Contract D, all four extents come from one `plotRect(t)` per
frame, so the bottom tape's right end and the vertical tape's bottom end are the
same pixel by construction. Reserves are **measured from the DOM**, never
hard-coded:

```
top reserve     projection panel offsetTop + offsetHeight + 10        (fallback 145)
bottom reserve  caption strip offsetTop − 26                          (fallback 26)
left floor      16 px
right ceiling   min(env.x1 + 26, annoLeftEdge − 10, w − 14)
minimum span    140 px horizontal, 120 px vertical — below either, emit nothing
```

### 1.4 FIT FIELD and CENTER TARGET

```
FIT FIELD       zoom → 1, cx/cy → fit rect centre, 420 ms easeInOut
                SPATIAL also: yaw 0.62, pitch 0.34, dist 2.75
CENTER TARGET   650 ms ease to the record, zoom → clamp(zoom, 2.4, 3.2)
                never changes projection, filter, or selection
```

The CENTER TARGET zoom is clamped at both ends deliberately: it must actually
move (2.4 floor) but must leave the record its neighbourhood (3.2 ceiling). A
record alone in an empty frame has lost the only context the field provides.

---

## 2. THE INDEX ARRANGEMENT — SHARED PIXEL SPEC

```
font           9.5px "IBM Plex Mono", letter-spacing 0 (canvas), lineWidth 1
line           rgba(150,170,255,0.42)      tape line, major ticks
dim            rgba(150,170,255,0.22)      minor ticks, titles, brackets
text           #8f9ad4                     tick labels
major tick     8 px, with label
minor tick     4 px, no label
```

Arrangement, horizontal tape (`y = plotRect.b`):

```
tape line      from (l, b) to (r, b)
major tick     from (x, b) down to (x, b + 8)
label          baseline at b + 19, textAlign 'center'
title          right-aligned at (r − 2, b − 7)  — INSIDE the tape's span,
               above the line, so the tape needs no outer clearance
```

Arrangement, vertical tape (`x = plotRect.r`):

```
tape line      from (r, t) to (r, b)
major tick     from (r, y) right to (r + 8, y)
label          left-aligned at r + 12, baseline centred on y
title          rotated −90°, at (r + 19, t + 2), reading bottom-to-top
```

Collision guard: minimum label pitch **64 px** horizontal (84 px narrow); the
vertical tape uses **55 %** of it, because numerals are wider than they are tall
and the vertical axis can carry more of them.

Corner brackets: 12 px L-marks at the three unused corners, `dim`, 1 px. They
imply the plot box without closing it — a closed box reads as a chart frame, and
the field is not a chart.

---

## 3. ORBIT × SIZE — the full instrument

The only projection where both screen axes are a measurement, so it gets the
most axis.

```
MAPPING     x = 0.06 + 0.88·(log10(orbper) − xmin)/(xmax − xmin)
            y = 1 − (0.06 + 0.88·(log10(rade) − ymin)/(ymax − ymin))
REQUIRED    orbper > 0, rade > 0          (~180 records unresolved)
FIT RECT    { 0, 0, 1.26, 1 }             (unresolved present)
```

**Indices**

```
bottom   log period tape, 1-2-5 per decade, major at m === 1
         domain reaches ~4×10⁸ d, so labels roll: 1.5K · 2.4M · 1B
         2 decimals below 1, whole numbers above
         title  ORBITAL PERIOD [D]        narrow: PERIOD [D]
right    log radius tape, same generator
         title  PLANET RADIUS [R⊕]        narrow: R⊕
```

**Furniture**

```
1 R⊕ reference   a 1 px rgba(150,170,255,0.10) horizontal rule at y(1.0),
                 running l → r, label ` 1 R⊕ ` at the left end, 9.5px, dim
1 yr reference   the same at x(365.25), vertical, label ` 1 YR `
```

Two references, no more, and both are *lines the reader already knows* — Earth's
radius and Earth's year. They are the reason the cloud's shape is legible at a
glance: hot Jupiters sit up and left of the crossing, super-Earths down and left,
the imaging population far right. A grid would have said less and cost more ink.

**Caption** — `6,336 confirmed worlds` / `1,204 of 6,336 found by Transit`.

---

## 4. DISCOVERY TIME — one real axis, and it says so

```
MAPPING     x = 0.06 + 0.88·linNorm(disc_year)
            y = 0.08 + 0.84·hash01(name, 7)          ← DISPLAY SPREAD, not data
REQUIRED    disc_year   (effectively all records)
FIT RECT    { 0, 0, 1, 1 }
```

**Indices**

```
bottom   linear year tape. Step from [1,2,5,10,25,50] — the first whose pixel
         pitch ≥ 58 px (74 px narrow). Minor step 1 year when ≥ 7 px/yr.
         ONLY whole years are ever emitted. No 2018.5 can exist.
         At step ≥ 5, a rgba(150,170,255,0.07) guide runs up into the field —
         reference, not a grid.
         title  T // DISCOVERY YEAR
right    NO SCALE. An unnumbered bracket only: a 1 px vertical line at
         plotRect.r from t to b, with 12 px inward L-turns at both ends.
         rotated caption, longest of these that fits the bracket height:
           Y // DISPLAY SPREAD · NO DATA AXIS
           Y // DISPLAY SPREAD
           DISPLAY SPREAD
           SPREAD
         If none fits, none is drawn — the footer already says
         `Y: DISPLAY DISTRIBUTION`.
```

Putting ticks on the vertical would invent a measurement. The bracket gives the
spread a **shape and a disclosure, never a scale** — and it is the clearest
single example of this project's whole posture.

**Furniture**

```
target cursor   vertical line at the target's own year, top→bottom of plotRect
                locked   solid rgba(214,224,255,0.55) + #e6e9fb 9 px caret
                preview  dashed [3,4], rgba(150,170,255,0.40)
                label    DISCOVERED // 2016, 9.5px, clamped inside the tape span
```

**Caption** — unchanged; footer reads `Y: DISPLAY DISTRIBUTION`.

---

## 5. EARTH DISTANCE — SOL, the rings, and the arrow

The projection with a real radius, a display angle, and an observer at its
centre. Everything below assumes **Option B** from `FIX.md` §5 (rings share the
points' anisotropic transform); §5.5 gives the Option A variant.

```
MAPPING     r = logNorm(1 + dist_pc) · 0.46        θ = hash01(name, 3) · 2π
            x = 0.5 + r·cosθ                       y = 0.5 + r·sinθ
REQUIRED    dist_pc > 0
FIT RECT    { 0, 0, 1.26, 1 }
```

### 5.1 The rings — the "orbit" ellipses

Constant-distance loci. Under Option B they are drawn with the same transform the
points get, so a ring and the records on it coincide exactly:

```js
ctx.ellipse(solX, solY, rn·sx, rn·sy, 0, 0, 2π)     // rn = the ring's normalised r
```

```
ring values     1-2-5 per decade in pc, inside the visible domain:
                1 · 2 · 5 · 10 · 20 · 50 · 100 · 200 · 500 · 1K · 2K · 5K
stroke          major (m === 1)   rgba(150,170,255,0.30), 1 px
                minor             rgba(150,170,255,0.16), 1 px
pitch guard     a ring is skipped if its screen radius is within 26 px of the
                previous drawn ring — at low zoom the inner decades collapse and
                must not be drawn as a smudge
outermost       the last ring inside the envelope + one beyond it. Never draw
                rings out to the fit rect: furniture must not claim space the
                data does not occupy.
```

**The label gap.** No plates anywhere in this design, so the ring breaks for its
own label instead of being painted over:

```
bearing        −38° from SOL (up and to the right), the same for every ring
gap            the arc is drawn in two passes, leaving a gap of
               (label width + 14 px) centred on the bearing
label          9.5px, #8f9ad4, drawn in the gap, rotated to the ring's local
               tangent ONLY if |tangent| > 12°, otherwise horizontal
text           ` 50 PC `  ·  ` 1 KPC ` above 999 pc
```

Every gap is on the same bearing, so the breaks line up as a single radial
corridor — it reads as a deliberate index line, not as damage.

### 5.2 OBSERVER // SOL — the marker

The one fixed point in the archive, and the only marker in section 2 that is not
a record. Design it as an instrument origin, not as a star:

```
dot         3.5 px filled #e8eaf5
inner ring  1 px rgba(232,234,245,0.55) at r = 7 px
cross       four 5 px ticks at 45° / 135° / 225° / 315°, starting at r = 10 px,
            rgba(150,170,255,0.42), 1 px
label       OBSERVER // SOL      9.5px, letter-spacing .14em (drawn per-char),
            #8f9ad4, positioned at (solX + 14, solY + 4), left-aligned
sub-label   0 PC                 9.5px, rgba(150,170,255,0.30), 13 px below
```

Rules:

- **SOL is drawn under the points, above the rings.** It is the origin of the
  furniture, not a datum competing with the records.
- **SOL does not scale with zoom.** All the numbers above are screen pixels at
  every zoom level. A marker that grows is a data point; a marker that holds is
  an instrument.
- **SOL is never selectable.** `findNearest` ignores it, so it can never be
  mistaken for a record or open a system.
- If the label would leave the box, it flips to right-aligned at
  `(solX − 14, solY + 4)`; if SOL is off-screen entirely, §5.3 takes over.

### 5.3 The arrow to SOL — off-screen indicator

Pan away and the origin leaves the frame. The projection is radial and becomes
unreadable without its centre, so the centre gets an edge indicator:

```
appears when   SOL's screen position is outside the field box, inset 22 px
position       clamped to the box's inner rect (inset 22 px), on the segment
               from the box centre to SOL — so it sits at the edge nearest SOL
chevron        9 px, 1.4 px stroke, rgba(232,234,245,0.72), apex pointing along
               the direction to SOL, drawn rotated to that bearing
tail           a 14 px line trailing the chevron at 0.30 alpha, on the same
               bearing — it reads as direction, not as a cursor
label          ` OBSERVER // SOL `  9.5px #8f9ad4, offset 13 px back along the
               bearing from the chevron, clamped to stay inside the box
distance       ` +340 PC OFF-FRAME `  — the ring value at the box centre, so the
               indicator answers "how far out am I", 9.5px, alpha 0.55
interactive    the chevron is a 32 × 32 px hit area (the ONE pointer-events
               exception in the field's furniture). Click → 420 ms easeInOut
               recentre on SOL, zoom unchanged.
fade           opacity 0 → 1 over 180 ms on appear; on disappear, 120 ms out.
               It never pops.
```

The same indicator, same code, runs in SPATIAL (§6.4). It does not exist in
ORBIT × SIZE or DISCOVERY TIME, because there is no origin there to point at —
an arrow to a place with no meaning is worse than no arrow.

### 5.4 Angle disclosure

```
caption right   ANGLE // DISPLAY DISTRIBUTION
footer          ANGLE: DISPLAY DISTRIBUTION
```

Non-negotiable, and it stays under every Option in `FIX.md` §5. The radius is a
measurement; the angle is a hash. The one thing this projection must never do is
let the eye read a direction into the sky.

### 5.5 If Option A is adopted

Radial layout in a square world, one aspect factor applied to points **and**
rings alike (`s = min(sx, sy)`), letterboxed horizontally. Then:

```
rings        ctx.arc(...) — true circles
SOL          unchanged (it was never scaled)
label gaps   unchanged
letterbox    the unused margin is left empty — no furniture, no fan, no border.
             It is the projection's own frame, and it should be silent.
```

Everything else in §5 is identical. That is the point of specifying the rings by
value and bearing rather than by geometry.

---

## 6. SPATIAL // RA + DEC — the three-dimensional one

```
MAPPING     r = ln(1 + dist_pc)
            x = r·cos(dec)·cos(ra)   y = r·sin(dec)   z = r·cos(dec)·sin(ra)
            → yaw about +Y, pitch about +X, camera at dist on the view axis,
              always looking at the origin (SOL); f = 1/tan(24°)
REQUIRED    ra, dec, dist_pc > 0
FIT RECT    n/a — the camera replaces it; `zoom` is `dist`
```

### 6.1 Indices — fixed px/deg HUD strips

Not fitted tapes. A heading tape has a **constant scale** or it is not a heading
tape (`EFFECT.md` §2.3):

```
RA strip     horizontal, along plotRect.b
             scale    fixed px/deg, ≈ 2.4 px/° at reference dolly, scaled with
                      the camera's field width
             ticks    every 10°, major every 30° with a label
             labels   0h 2h 4h … 22h  (hours, not degrees — RA is an hour angle)
             cyclic   emit for [yaw − span/2 − 30°, yaw + span/2 + 30°] in an
                      unwrapped space, label mod 360. No beginning, no end.
             caret    fixed at the strip's centre, 9 px #e6e9fb, live readout
                      under it as a rolling digit drum
             title    RA // HOURS
DEC strip    vertical, along plotRect.r
             ticks    every 10°, major every 30°
             labels   +60 +30 0 −30 −60
             clamps   at ±90° with the pitch limit; the tape simply runs out
             title    DEC // DEGREES
fade zones   the outer 24 px of each strip: alpha = clamp(dist/24, 0, 1)
sub-pixel    never round a tick position. Round tick lengths only.
```

### 6.2 Depth

```
depth cue    α × clamp(camDist / depth, 0.45, 1.5)     applied per point
             interpolated with the projection (1.0 = no cue) so it fades in and
             out with SPATIAL rather than switching in one frame
```

The near half of the archive is brighter than the far half. That is the entire 3D
read; there is no perspective grid, and there should not be.

### 6.3 SOL at the origin

Same marker as §5.2, with three differences:

```
scale        still fixed in screen px — SOL does not dolly
depth        SOL is at the origin, which is what the camera looks at, so it is
             always at the box centre unless the user pans
label        OBSERVER // SOL  +  ` 0 PC · ORIGIN OF THE TRANSFORM `
axis stubs   three 16 px stubs along +X, +Y, +Z projected through the camera,
             rgba(150,170,255,0.22), labelled ` RA 0h `, ` +DEC `, ` RA 6h `
             at 0.35 alpha — the only orientation furniture in the scene
```

The stubs rotate with the camera, so they double as the answer to "which way am I
looking" without a gizmo in the corner.

### 6.4 The arrow to SOL

Identical to §5.3, including the recentre click, with one change: the distance
readout becomes ` OFF-AXIS ` rather than a pc value, because the pan is
perpendicular to the view and a distance in pc would be a fabrication.

### 6.5 Caption

```
right   NAV // L-DRAG PAN · R-DRAG ORBIT · WHEEL DOLLY
footer  RADIUS: LOG-COMPRESSED ln(1+d)
```

---

## 7. THE HOLDING CLOUD — where unresolved records live

```
position     unresolvedPos(name, cx = 1.15, k) — a disc of radius 0.072k × 0.15k
             in normalised space, i.e. deliberately OUTSIDE the 0–1 region
ellipse      1 px rgba(150,170,255,0.18) dashed [2,5], drawn around the cloud at
             its actual extent + 10 px. It is the boundary of a place, not a plot.
annotation   two lines, right-aligned, 9.5px, at the ellipse's left edge − 12 px:
               NO ORBITAL PERIOD          #8f9ad4
               180 RECORDS                rgba(150,170,255,0.30)
             The first line is per-projection (`missingFor()`), so it names the
             actual missing field, never a generic "no data".
drift        SPATIAL only: outward on k = min(√(2.75/dist), 2) — the square root,
             so a real net dolly survives while the two clouds stay separated
tape rule    the cloud NEVER extends the envelope, and its annotation may push
             the vertical tape left but may never pull it right of env.x1 + 26
```

Records here are dimmed and hoverable but keep their method colour and can be
selected — they are archive members, not errors. The ellipse and the count are
the whole disclosure: **the archive is 6,336 records, and you are looking at
6,156 of them.**

---

## 8. PER-PROJECTION SUMMARY

| | bottom | right | origin | furniture | disclosure |
|---|---|---|---|---|---|
| **ORBIT × SIZE** | log period tape | log radius tape | — | 1 R⊕ + 1 YR references | — |
| **DISCOVERY TIME** | linear year tape | unnumbered bracket | — | year guides, target cursor | `Y: DISPLAY DISTRIBUTION` |
| **EARTH DISTANCE** | — | — | OBSERVER // SOL | 1-2-5 pc ellipse rings, gapped labels, SOL arrow | `ANGLE: DISPLAY DISTRIBUTION` |
| **SPATIAL** | RA hour strip | DEC degree strip | OBSERVER // SOL | axis stubs, depth cue, SOL arrow | `RADIUS: LOG-COMPRESSED` |

Two of the four carry a disclosure in the footer. Those two are exactly the two
whose picture contains something that is not a measurement. That correspondence
is the design.

---

## 9. VERIFICATION

```
domain      filter to Imaging (≈ 80 records) in ORBIT × SIZE: the tick VALUES
            must not change, only the tape's position
envelope    switch method filters rapidly: the tape must ease, never jump, and
            never flicker
corners     every projection × 5 zoom levels × both rail states: bottom-right
            tape ends are the same pixel
rings       three records with near-equal dist_pc, different hashed angles: equal
            screen distance from SOL, all on the same ring
gaps        every ring's label gap is on the same bearing and the labels form one
            straight radial corridor
SOL         zoom 1 → 6: the dot stays 3.5 px, the ring stays r = 7 px
arrow       pan SOL off each of the four edges: the chevron appears within 180 ms
            at the nearest edge, points correctly, and recentres on click
cloud       in DISCOVERY TIME (no unresolved records) the ellipse, annotation and
            the 1.26 fit rect must all be absent
```
