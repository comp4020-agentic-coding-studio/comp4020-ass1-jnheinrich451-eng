# SPATIAL.md — SPATIAL // RA + DEC, complete design

The third-dimension projection in full: the transform, the celestial reference
furniture (the dotted lines and the ecliptic ring), the RA/DEC tape interval
ladder, the origin, and depth. Section 9 is the whole thing restated as an
implementation prompt.

Companions: `LOAD-DATA.md` §5 (the transform), `PROJECTIONS.md` §6 (this
projection's place among the four), `EFFECT.md` §2.3 (how the tapes move under
rotation).

---

## 0. WHAT THIS PROJECTION IS FOR

The other three projections plot *properties*. This one plots **places** — the
actual sky positions of the host systems, at their actual (log-compressed)
distances. It is the only projection where the picture is a map, and the only one
that therefore earns a coordinate grid.

The whole design follows from that: this projection gets **reference furniture**
(a grid, an equator, an ecliptic) because there is a real sphere to reference. The
others get none, because there is nothing to reference.

---

## 1. THE TRANSFORM

Unchanged from `LOAD_DATA.md` §5, restated because everything below depends
on it:

```
r = ln(1 + dist_pc)                     monotonic → ordering is exact
x = r·cos(dec)·cos(ra)
y = r·sin(dec)                          +Y is the north celestial pole
z = r·cos(dec)·sin(ra)

camera   yaw about +Y, then pitch about +X, at `dist` along the view axis,
         always looking at the target (SOL by default)
f        1 / tan(24°)
screen   sx = 0.5 + 0.45·f·xe/ze ,  sy = 0.5 − 0.45·f·ye/ze     (÷ ze, perspective)
```

Radius is log-compressed because the archive spans 1.30 → 8500 pc; a linear
radius collapses 99 % of it into the origin. Ratio 6538× becomes 10.9×. Ordering
and ranking survive exactly; absolute spacing does not, and the footer says so:
`RADIUS: LOG-COMPRESSED ln(1+d)`.

**A point is the host system, not the planet's own measured position.** Multiple
planets of one host coincide exactly, and that is correct.

---

## 2. THE REFERENCE FURNITURE — THE DOTTED LINES

Five families, drawn in this order, all **under** the points. Together they cost
~1.1 ms; they are the most expensive furniture in section 2 and the only place
where that is justified.

### 2.1 The graticule — dotted RA meridians and DEC parallels

```
MERIDIANS      12 half-great-circles, every 2h of RA (30°), from −90° to +90° dec
               each drawn as 48 segments in world space, projected per vertex
PARALLELS      5 small circles at dec = ±60°, ±30°, 0°
               each drawn as 72 segments
RADIUS         drawn at rSphere = ln(1 + 1000) ≈ 6.91  — the 1 kpc shell, which
               contains ~97 % of the archive. The grid is a container, not a
               backdrop at infinity.
DASH           meridians   [1, 6]   1 px on, 6 px off      → reads as dotted
               parallels   [1, 5]
STROKE         rgba(150,170,255,0.13), lineWidth 1
```

Two rules that keep this from becoming visual noise:

- **Dotted, never solid.** A solid graticule at this density competes with the
  data. The dot pattern is legible as structure at a glance and disappears when
  you look at a point — which is exactly the priority order.
- **The dash pattern is in screen space** (`ctx.setLineDash`), so it does not
  stretch with perspective. A perspective-correct dash would bunch at the far
  side of the sphere and look like an error.

### 2.2 The celestial equator — the one solid ring

```
dec = 0, full circle, 96 segments
stroke   rgba(150,170,255,0.30), lineWidth 1, SOLID
label    ` CELESTIAL EQUATOR `  9.5px, at the ring's rightmost projected vertex,
         in a 62 px gap in the stroke (the same gapped-label technique as the
         distance rings — no plates, ever)
```

It is solid because it is the reference plane of the coordinate system the tapes
are labelled in. Exactly one ring may be solid, or "solid" stops meaning
anything.

### 2.3 The ecliptic — the "eclipse orbit"

The plane of Earth's orbit: the path the Sun traces against the sky over a year,
inclined **23.44°** to the celestial equator. It is the second most meaningful
circle in the sky and the reason the constellations of the zodiac are the ones
they are.

```
GEOMETRY     the equator's circle rotated 23.44° about the +X axis
             (the vernal equinox direction, RA 0h), 96 segments, same rSphere
STROKE       rgba(232,195,122,0.34) — the Transit amber, borrowed deliberately:
             it is the only warm line in the field, so the ecliptic reads as
             "solar system" against a cold sky
DASH         [5, 4] — dashed, not dotted and not solid. Its own third weight,
             so it can never be confused with the equator or the graticule.
WIDTH        1.2 px
NODES        two 5 px × marks where it crosses the equator, at
               RA 0h   ` ♈ VERNAL EQUINOX `
               RA 12h  ` ♎ AUTUMNAL EQUINOX `
             marks in rgba(232,195,122,0.55); labels 9.5px #8f9ad4, 10 px offset,
             drawn only when the node is on the near hemisphere
POLES        a 3 px × at the ecliptic north pole (RA 18h, dec +66.56°),
             label ` ECLIPTIC POLE `, alpha 0.3, near hemisphere only
LABEL        ` ECLIPTIC · 23.44° `  in a gap in the dash, placed at the vertex
             furthest from both equinox labels
```

Why it belongs: it is the plane every one of these planets' own orbits is *not*
in, and the plane our own detection methods are biased along. Drawing it makes
the archive's geometry honest — you can see that the confirmed worlds are not
distributed along the ecliptic but along **Kepler's field of view**, which is a
far more interesting fact and one the picture can now state by contrast.

### 2.4 The Kepler field marker (optional, high value)

```
a 12°-radius circle at RA 19h22m, dec +44.5°, on the sphere
stroke  rgba(159,196,255,0.22), dash [2,4]
label   ` KEPLER FIELD `  9.5px, alpha 0.4
```

The single densest clump in the whole projection sits inside it. With the circle
drawn, the clump stops looking like a data artefact and becomes the story: this
is not a map of where planets are, it is a map of where we have looked. Behind a
footer toggle (`REFERENCE // ON · OFF`) if it feels like too much.

### 2.5 Near / far hemisphere split

Every furniture family is drawn in **two passes**, split by whether each segment's
midpoint is on the near or far side of the sphere relative to the camera:

```
far pass    alpha × 0.45      drawn BEFORE the points
near pass   alpha × 1.00      drawn BEFORE the points as well
```

Both passes stay under the data — furniture never crosses over a point. But the
near/far alpha split is what makes the sphere read as a sphere rather than as a
flat mandala. Without it, the graticule is genuinely ambiguous: the eye cannot
tell an inside from an outside, and the whole 3D read collapses.

### 2.6 The dotted drop lines (selection only)

The one dotted line that is not part of the sphere:

```
when      a record is selected or hovered
geometry  from the point, perpendicular to the equatorial plane, to dec = 0
dash      [1, 4], rgba(214,224,255,0.35), 1 px
plus      a 3 px open circle at the foot, on the plane
```

It answers "is this above or below the equator, and by how much" for one record
at a time, which is the one question the projection cannot otherwise answer at a
glance. **Never draw it for more than the marked records** — 6,336 drop lines is
a hairball, and this is the entire reason it is gated on selection.

---

## 3. THE TAPES — INTERVAL DESIGN

The tapes are fixed-scale HUD strips (`EFFECT.md` §2.3), not fitted axes. What
changes with the dolly is not the scale-to-data mapping but **which interval from
a ladder is drawn** — exactly as a sky atlas changes from 30° to 1° gridlines as
you zoom in.

### 3.1 px/deg

```
fovDeg     = 48°                          (2 × the 24° half-angle)
visibleDeg ≈ fovDeg · (dist / 2.75)       the reference dolly is 2.75
pxPerDeg   = plotWidth / visibleDeg
```

At `dist 2.75` on a 900 px-wide plot: ≈ 18.8 px/deg. At `dist 7` (full pull-out):
≈ 7.4 px/deg. At `dist 1.25` (closest): ≈ 41 px/deg.

### 3.2 The RA interval ladder — in hours and minutes, never degrees

RA is an hour angle. Labelling it in degrees is the single most common way an
otherwise good sky view announces that nobody checked it.

```
ladder      6h · 2h · 1h · 30m · 15m · 5m · 2m · 1m
choose      the first whose label pitch ≥ 58 px   (74 px on a narrow field)
            pitch = interval_in_deg · pxPerDeg     (1h = 15°, 1m = 0.25°)
minor       the next rung down the ladder, ticks only, no labels
labels      6h/2h/1h rungs   `14h`
            30m/15m/5m rungs `14h 30m`
            2m/1m rungs      `14h 32m`
cyclic      emit over [centre − span/2 − 30°, centre + span/2 + 30°] in an
            unwrapped space, label mod 24h. No beginning, no end.
title       RA // HOURS        right-aligned inside the tape span
```

### 3.3 The DEC interval ladder — degrees and arcminutes

```
ladder      30° · 15° · 10° · 5° · 2° · 1° · 30' · 10'
choose      first whose pitch ≥ 32 px  (vertical uses 55 % of the horizontal
            pitch — numerals are wider than they are tall)
minor       next rung down, ticks only
labels      degree rungs    `+30°`  `0°`  `−60°`     always signed, always the °
            arcmin rungs    `+30° 30'`
clamp       ±90°. The tape runs out of ticks and fades through its 24 px end
            zone; it does not wrap, because declination does not.
title       DEC // DEGREES     rotated −90°, reading bottom-to-top
```

### 3.4 Interval changes must not pop

When the dolly crosses a ladder threshold, the new rung's ticks do not appear at
full strength:

```
hysteresis   promote at pitch ≥ 58 px, demote at pitch ≤ 44 px
             (a 14 px dead band — without it, a slow dolly at the boundary
              flickers between two rungs every frame)
cross-fade   the arriving rung fades 0 → 1 over 220 ms; the departing rung fades
             1 → 0 over the same 220 ms, holding its positions
survivors    ticks whose value exists on BOTH rungs never fade at all — they are
             keyed by value (EFFECT.md §2.1), so 14h stays lit while 14h 30m
             fades in around it
```

That last line is the good detail: zooming in *adds* subdivisions between the
labels you were already reading, rather than replacing the tape. It is why a
paper atlas feels continuous across plate scales.

### 3.5 Geometry

Shared with `PROJECTIONS.md` §2 — majors 8 px, minors 4 px, horizontal labels at
`b + 19`, vertical labels at `r + 12`, 9.5 px IBM Plex Mono, `line`
`rgba(150,170,255,0.42)`, `dim` `rgba(150,170,255,0.22)`, text `#8f9ad4`. Plus
the two HUD-specific mechanics: **sub-pixel positions** (never round a tick's
position; round lengths only) and **24 px fade zones** at both ends of both
strips.

### 3.6 The caret and its readout

```
caret     fixed at each strip's centre, 9 px, #e6e9fb, 1.4 px
readout   directly under (RA) / left of (DEC) the caret, 10.5 px
          RA   `14h 32m`     DEC  `+44° 30'`
drum      each digit column translates vertically by its own fractional part, so
          179.8 → 180.2 rolls through instead of flicking. One clip per column,
          drum height = the label's line height.
```

---

## 4. THE ORIGIN

Same OBSERVER // SOL marker as `PROJECTIONS.md` §5.2 — 3.5 px dot, 1 px ring at
r = 7, four 5 px cross ticks at 45° — with these additions:

```
label      OBSERVER // SOL   +   ` 0 PC · ORIGIN OF THE TRANSFORM `
axis stubs three 16 px stubs along +X, +Y, +Z projected through the camera:
             +X  ` RA 0h `        (the vernal equinox — same direction as the
                                   ecliptic's ascending node, deliberately)
             +Y  ` +DEC `         (the north celestial pole)
             +Z  ` RA 6h `
           rgba(150,170,255,0.22), labels at 0.35 alpha
fixed size  SOL and the stubs are screen-pixel sizes at every dolly. They are
           instruments, not objects in the scene.
```

The stubs rotate with the camera, so they answer "which way am I looking" without
a corner gizmo. And because +X is both RA 0h and the ecliptic's ascending node,
the stub, the equinox mark and the ecliptic's node all agree — one direction,
three pieces of furniture, no contradiction.

Off-screen: the SOL arrow (`PROJECTIONS.md` §5.3) with the readout ` OFF-AXIS `
instead of a pc value — the pan is perpendicular to the view, so a distance in pc
would be a fabrication.

---

## 5. THE POINTS

```
depth cue    α × clamp(camDist / depth, 0.45, 1.5)
             interpolated with the projection (1.0 = no cue), so it fades in and
             out with SPATIAL rather than switching in one frame
radius       unchanged: 2.0 px matched / 1.2 px dimmed, × zoom gain
             NOT depth-scaled — only alpha carries depth. Size carries the
             filter, and one channel may only mean one thing.
holding      unresolved records (no ra/dec/dist) drift outward on
             k = min(√(2.75/dist), 2) — the square root, so a real net dolly
             survives while the two clouds stay separated at any dolly
sort         painter's order by descending `depth`, so near points overpaint far
             ones. One `Uint16Array` index sort, recomputed only on camera change
             (PERFORMANCE.md §2.5), never per frame.
```

---

## 6. NAVIGATION

```
left-drag    pan   → moves the camera TARGET perpendicular to the view axis,
                     clamped to a sphere of radius rSphere × 0.6 around SOL
right-drag   orbit → yaw ±Δx·0.006, pitch clamp ±1.45
                     (context menu suppressed HERE ONLY, where it is a control)
wheel        dolly → clamp(dist · exp(Δy·0.0012), 1.25, 7), non-passive, on the
                     canvas element only
hover        18 px · click 16 px · drag > 3 px suppresses the click
FIT FIELD    yaw 0.62, pitch 0.34, dist 2.75, target SOL, 420 ms easeInOut
caption      NAV // L-DRAG PAN · R-DRAG ORBIT · WHEEL DOLLY
```

Reprojection runs **once per camera change**, into a preallocated buffer, so the
draw loop stays a pure affine map. Dragging must not increment a
`computePositions` counter more than once per pointer event.

---

## 7. WHAT THIS PROJECTION MUST NEVER DO

- **Auto-rotate.** Not on entry, not while idle, not "to show it is 3D." The
  camera has one writer (`CAMERA-STOP.md`).
- **Label RA in degrees.** Hours and minutes, always.
- **Draw a solid graticule**, or a second solid ring. Exactly one solid circle
  exists here: the celestial equator.
- **Draw constellation lines or names.** They are a cultural overlay on a data
  instrument, and they would be the one decorative element in the entire section.
- **Scale SOL, the stubs or the tape with the dolly.**
- **Imply that the radius is linear.** The footer disclosure is not optional.

---

## 8. VERIFICATION

```
transform   verifySkyTransform() and auditSky3D() must both pass — keep them,
            they are the contract
equinox     the ecliptic's two node marks must fall exactly on the celestial
            equator ring, at RA 0h and 12h, at every camera angle
tilt        measure the maximum angular separation between the ecliptic and the
            equator on screen: it must correspond to 23.44°, not 23.44 px
ladder      dolly slowly from 7 → 1.25: each ladder rung cross-fades once, no
            rung flickers, and every surviving label stays lit throughout
hours       at the 30m rung, labels read `14h 30m` — never `217.5°`
sphere      the far-hemisphere pass must be visibly dimmer; occlude test: a
            meridian behind SOL is at 0.45 alpha, the same meridian in front is
            at 1.0
drop line   select a high-declination record: the dotted line runs to the
            equator plane and the foot circle sits on it. Deselect → both gone.
camera      the CAMERA-STOP.md §7a stillness assertion passes here too
```

---

## 9. THE PROMPT

Hand this to an implementer or a coding agent as-is.

> Implement the SPATIAL // RA + DEC projection for the exoplanet field canvas.
>
> **Transform.** For each host system: `r = ln(1 + dist_pc)`,
> `x = r·cos(dec)·cos(ra)`, `y = r·sin(dec)`, `z = r·cos(dec)·sin(ra)`. Camera:
> yaw about +Y then pitch about +X, positioned at `dist` along the view axis,
> looking at a target that defaults to the origin (SOL). `f = 1/tan(24°)`;
> project to `0.5 + 0.45·f·xe/ze` and `0.5 − 0.45·f·ye/ze`. Reproject into a
> preallocated `Float32Array` **once per camera change**, never per frame; the
> draw loop must be a pure affine map. Keep a `Uint16Array` painter's-order sort
> by descending depth, recomputed on the same schedule.
>
> **Reference furniture**, all drawn under the points, at a sphere radius of
> `ln(1 + 1000) ≈ 6.91`, each family split into a far pass at 0.45× alpha and a
> near pass at 1.0× alpha (split by segment-midpoint depth):
> - 12 dotted RA meridians every 2h, 48 segments each, dash `[1,6]`,
>   `rgba(150,170,255,0.13)`, 1 px.
> - 5 dotted DEC parallels at ±60°, ±30°, 0°, 72 segments, dash `[1,5]`, same
>   colour.
> - The celestial equator at dec 0: **solid**, `rgba(150,170,255,0.30)`, 1 px,
>   96 segments, with a 62 px gap in the stroke holding the label
>   `CELESTIAL EQUATOR` at 9.5 px `#8f9ad4`. No label plates anywhere.
> - The **ecliptic**: the equator circle rotated 23.44° about +X. Dash `[5,4]`,
>   `rgba(232,195,122,0.34)`, 1.2 px, 96 segments. Two 5 px × node marks where it
>   crosses the equator, at RA 0h (`VERNAL EQUINOX`) and RA 12h
>   (`AUTUMNAL EQUINOX`), drawn only on the near hemisphere. A 3 px × at the
>   ecliptic pole (RA 18h, dec +66.56°) at 0.3 alpha. Label `ECLIPTIC · 23.44°`
>   in a dash gap, placed at the vertex furthest from both node labels.
> - Dash patterns are screen-space (`setLineDash`), not perspective-corrected.
>
> **Selection drop line.** For marked records only: a dotted `[1,4]` line from
> the point perpendicular to the equatorial plane down to dec 0, plus a 3 px open
> circle at the foot, `rgba(214,224,255,0.35)`. Never for unmarked records.
>
> **Tapes.** Fixed-scale HUD strips, not fitted axes: RA horizontally along
> `plotRect.b`, DEC vertically along `plotRect.r`, both reading one `plotRect`
> per frame. `pxPerDeg = plotWidth / (48° · dist/2.75)`.
> - RA interval ladder `6h · 2h · 1h · 30m · 15m · 5m · 2m · 1m`; pick the first
>   rung whose label pitch ≥ 58 px (74 px narrow). Minors are the next rung down,
>   ticks only. Labels `14h` / `14h 30m` / `14h 32m` by rung. **Never degrees.**
>   Cyclic: emit over centre ± (span/2 + 30°) in unwrapped space, label mod 24h.
> - DEC ladder `30° · 15° · 10° · 5° · 2° · 1° · 30' · 10'`; pitch ≥ 32 px.
>   Labels always signed with the degree sign. Clamps at ±90°, no wrap.
> - Ladder changes: promote at ≥ 58 px, demote at ≤ 44 px (14 px hysteresis, or a
>   slow dolly flickers). Arriving rung fades in over 220 ms, departing rung
>   fades out over 220 ms holding its positions. Ticks are keyed by **value**, so
>   a tick present on both rungs never fades — zooming adds subdivisions between
>   the labels you were already reading.
> - Majors 8 px, minors 4 px, 9.5 px IBM Plex Mono, `rgba(150,170,255,0.42)`
>   lines, `#8f9ad4` labels; horizontal labels at `b + 19`, vertical at `r + 12`.
>   **Never round a tick's position** — sub-pixel only; round lengths. The outer
>   24 px of each strip fades via `alpha = clamp(distFromEnd/24, 0, 1)`.
> - A fixed 9 px `#e6e9fb` caret at each strip's centre with a 10.5 px readout
>   (`14h 32m`, `+44° 30'`) rendered as a per-digit vertical drum, so the number
>   rolls rather than flicks.
>
> **Origin.** A 3.5 px `#e8eaf5` dot with a 1 px `rgba(232,234,245,0.55)` ring at
> r = 7 and four 5 px cross ticks at 45° from r = 10; label `OBSERVER // SOL`
> plus `0 PC · ORIGIN OF THE TRANSFORM`. Three 16 px axis stubs along +X, +Y, +Z
> labelled `RA 0h`, `+DEC`, `RA 6h`. SOL, the stubs and the tapes are **screen-px
> sizes at every dolly** and never scale. SOL is not selectable. When SOL is
> off-screen, show the edge chevron indicator with the readout `OFF-AXIS` and a
> 32 × 32 px hit area that recentres over 420 ms.
>
> **Points.** Radius 2.0 px matched / 1.2 px dimmed × zoom gain, *not*
> depth-scaled — depth is carried by alpha only, via
> `α × clamp(camDist/depth, 0.45, 1.5)`, itself interpolated with the projection.
> Unresolved records drift outward on `k = min(√(2.75/dist), 2)`.
>
> **Navigation.** Left-drag pans the target (clamped to a sphere of
> `rSphere × 0.6` around SOL); right-drag orbits (yaw ±Δx·0.006, pitch ±1.45,
> context menu suppressed here only); wheel dollies
> `clamp(dist·exp(Δy·0.0012), 1.25, 7)`, bound non-passive on the canvas element
> alone. Hover 18 px, click 16 px, a drag over 3 px suppresses the click. FIT
> FIELD → yaw 0.62, pitch 0.34, dist 2.75, target SOL, 420 ms easeInOut.
>
> **Constraints.** No auto-rotation ever — the camera's only writers are the
> pointer and an explicit FOCUS request. No RA labels in degrees. Exactly one
> solid circle (the equator). No constellation lines or names. No label plates.
> No `shadowBlur` and no per-point `save/restore`; the whole furniture pass must
> stay under ~1.1 ms and `drawField()` under 4 ms total. The footer must state
> `RADIUS: LOG-COMPRESSED ln(1+d)`.
>
> **Acceptance.** The ecliptic's two node marks land exactly on the equator ring
> at RA 0h and 12h from every camera angle; their on-screen maximum separation
> from the equator corresponds to 23.44°. Dollying 7 → 1.25 cross-fades each
> ladder rung once with no flicker and no surviving label dropping out. A
> meridian behind SOL is visibly dimmer than the same meridian in front. Idle for
> 5 s with the view open changes `yaw`, `pitch` and `dist` by 0.
