# EFFECT.md — every motion in section 2

The complete effect specification: what moves, what must **not** move, on which
clock, and in which direction. Read with `SOLUTION.md` (the repair order),
`PERFORMANCE.md` (the budget every effect here must fit inside) and
`SECTION2-INTERACTION.md` (what triggers what).

Where a line here contradicts an earlier document it is marked **SUPERSEDES** and
names the section it replaces.

---

## 0. FOUR LAWS

**I. Every motion has an author.** The user moves the camera; the simulation
moves the bodies. Nothing on screen moves for a third reason. If the viewing
angle changes and the user did not change it, the effect is broken — not
expressive.

**II. A transition never re-seeds.** Motion always starts from *what is currently
drawn*, never from a stored or recomputed starting state. A tween that begins by
placing things somewhere else has already failed, no matter how it ends.

**III. Nothing is computed on frame 0.** All destination geometry is resolved
*before* the clock starts. A tween whose first frame does layout work stalls
exactly where the eye is most sensitive, and reads as "lag and stuck."

**IV. One signed direction per system.** `dir = +1` counter-clockwise,
`dir = −1` clockwise, derived once. Orbit motion, trail, chevrons and the
starfield all read that one variable. They cannot disagree.

---

## 1. FIELD PROJECTION CHANGE

**SUPERSEDES** `SECTION2-AXES.md` §9 (pixel-mapping interpolation) and
`SECTION2.md` PART IV §13.

### 1.1 What moves and what is frozen

```
MOVES    point positions          currently-drawn → destination, 900 ms easeInOut
MOVES    axis furniture           §2, on the same clock
FROZEN   zoom                     the user's
FROZEN   cx, cy                   the user's
FROZEN   the SPATIAL camera       yaw, pitch, distance — untouched
FROZEN   selection, hover, filter, FIND state, scroll positions
```

A projection change is a change of *what the points mean*, not of where the user
is standing. Taking the camera away to "show the new shape" is a hijack; the
user re-frames deliberately, or not at all.

### 1.2 No second location at the start (Law II)

The single most common way this effect goes wrong:

```js
// WRONG — three ways to produce the jolt-then-slide
this._tweenFrom = this._layoutCache[oldLayout];      // stored source, not drawn source
this.view = fitRectFor(newLayout);                   // camera re-seeded
computePositions(newLayout);                         // 25 ms of work on frame 0
```

```js
// RIGHT
startMorph(next) {
  const dest = this._layoutCache[next];              // MUST already exist — §1.3
  if (!dest) { this._pendingLayout = next; return; } // hold the old picture, do not start
  const cur = this._drawPoints || this._layoutCache[this.state.layout];
  if (!this._tweenFrom || this._tweenFrom.length !== cur.length)
    this._tweenFrom = new Float32Array(cur.length);
  this._tweenFrom.set(cur);                          // start = exactly what is on screen
  this.tweens.morph = { to: next, t: 0, dur: 900 };
  this.clampView(this.viewFor(next));                // CLAMP into the new rect — never lerp to it
  this.startFieldAnim();
}
```

Three rules fall out, and all three are load-bearing:

- **Start from the draw buffer.** Interrupting a morph mid-flight must retarget
  from the current interpolated positions, so morph→morph is continuous. Same
  for a morph interrupted by a dive (`SOLUTION.md` step 6).
- **Clamp, don't interpolate, the view.** If the new projection's fit rect
  differs, clamp the existing `{cx, cy, zoom}` into it. A clamp is a correction;
  an interpolation is a hijack.
- **Never start unresolved.** If the destination cache is cold, keep drawing the
  old picture and start on the frame the cache lands. One dropped frame of
  *stillness* is invisible; one frame of half-computed motion is not.

### 1.3 Warming — where the 900 ms of smoothness is actually bought

Destination positions are computed **once per layout, ever**, and never on the
frame the user clicks:

```
on data load (idle)   compute ORBIT×SIZE (the default) + DISCOVERY TIME
on pointerenter of a  compute that projection's cache if cold, in a
  FIELD PROJECTION      requestIdleCallback (fallback: setTimeout 0)
  button
on pointerdown        last chance — compute synchronously if still cold, BEFORE
                        setState, so the work lands in the click, not the tween
after any morph       schedule the two uncached projections in idle time
```

The user's cursor travels to the button for ~200 ms. That is the compute window,
and it is free. SPATIAL is the expensive one (`skyPositions()` + a reprojection),
so it warms on hover without exception.

### 1.4 Point motion

```
path        straight in screen space, per point
easing      easeInOut, one clock for all 6,336 — no per-point stagger
buffer      one preallocated Float32Array, lerped in place (PERFORMANCE.md §2.4)
after-image last 14% of each point's path, 22 px cap, sin(πp) alpha envelope
unresolved  records that lack the destination axis fade to the annotation cluster
              rather than travelling to a fake coordinate
```

No stagger, deliberately: a staggered cloud reads as a shimmer, a synchronous one
reads as a mechanism.

*Verify:* pan to a corner, zoom 3×, cycle all four projections. The zoom readout
and view centre never change; the first and last frames show no jump; the frame
after the click is identical to the frame before it.

---

## 2. THE AXES — FIGHTER-HUD TAPES

The tapes are instrument tapes, not chart axes. **Labels do not get replaced;
they travel.** That single behaviour is what makes an axis read as an instrument.

### 2.1 Tick identity — the rule that makes travel possible

Ticks are keyed by **value**, never by index:

```js
key = `${axis}:${value}`        // "x:100" is the same tick in every frame it exists
```

Then a change is a three-way set operation on keys, and each class has its own
behaviour:

```
SURVIVING   in both sets   → travels: position lerps old → new, alpha 1 throughout
RETIRING    old only       → fades 1 → 0 over the first 45%, holds its old position,
                             tick length shrinks 8 → 3 px
ARRIVING    new only       → sits at its final position from t=0, alpha 0 → 1 over
                             the last 45%, length grows 3 → 8 px
```

An arriving tick never slides in from off-tape, and a retiring one never slides
out. Only ticks that mean the same thing in both projections move — which is the
honest reading, and also the one that looks deliberate.

Between two log domains (period ↔ radius) the surviving set is large, so the tape
visibly *rescales* rather than swapping. Between a log and a linear domain
(ORBIT×SIZE → DISCOVERY TIME) it is nearly empty, so the tape dissolves and
reforms — which is correct: those are not the same measurement.

### 2.2 The tape frame

The tape line itself, the corner brackets and the titles ride `plotRect`
(`SOLUTION.md` Contract D), interpolated on the morph clock:

```
tape endpoints   plotRect(from) → plotRect(to), easeInOut, same 900 ms
brackets         follow their corners; never redrawn at a third position
titles           cross-fade only (out over first 35%, in over last 35%) — they are
                 words, and words should not slide
```

Corner connection holds **during** the morph, not only at the ends: the rect is
interpolated as a rect, so the tapes stay joined at `(r, b)` on every frame.

### 2.3 Rotation — the scrolling heading tape (SPATIAL)

This is the fighter-HUD behaviour proper. Dragging the SPATIAL camera scrolls the
RA and DEC strips continuously, the way a heading tape scrolls under an aircraft
caret.

```
RA strip      horizontal, along the bottom of plotRect
DEC strip     vertical, along the right
scale         fixed px/deg — NOT fitted to the data (a heading tape has a constant
              scale or it is not a heading tape)
motion        strip offset = −cameraYaw · pxPerDeg      (tape scrolls opposite the
              camera, so the world stays still and the instrument moves)
caret         fixed at the strip's centre, 9 px, #e6e9fb, with the live numeric
              readout directly under it
```

Four mechanics that separate a HUD tape from a sliding ruler:

- **Sub-pixel positions.** Never `Math.round()` a tick's position. Rounding at
  small drag rates produces a 1 px stutter that reads as a low frame rate even at
  60 fps. Round only tick *lengths*.
- **Fade zones at both ends.** The outer 24 px of each strip carries
  `alpha = clamp(distanceFromEnd / 24, 0, 1)`. Ticks and labels dissolve in and
  out instead of popping at the clip edge.
- **Wrap, don't regenerate.** RA is cyclic: emit ticks for
  `[yaw − span/2 − 30°, yaw + span/2 + 30°]` in a continuous unwrapped space and
  label them `mod 360`. The strip has no beginning and no end.
- **The caret readout rolls.** The number under the caret is not re-rendered as
  text per frame — it is a digit drum: each digit column translates vertically by
  its own fractional part, so `179.8 → 180.2` rolls through rather than flicking.
  Drum height = the label's line height; one canvas clip per digit.

DEC is not cyclic — it clamps at ±90° with the pitch limit, and the tape simply
runs out of ticks, fading through the same 24 px zone.

**Motion must be frame-driven, not event-driven.** The camera's yaw is updated
from the pointer; the tape reads the yaw at draw time. Never advance the tape
inside the pointer handler, or the tape moves at pointer rate and the cloud moves
at frame rate, and the two visibly disagree.

*Verify:* drag SPATIAL slowly through 360°. The RA labels pass the caret in
order, none pops at either end, the readout rolls without flicker, and the tick
pitch never changes. Then change projection at 3× zoom: surviving ticks travel,
the rest fade, and the corners stay joined on every frame.

---

## 3. INSIDE OPEN SYSTEM — THE CAMERA

**SUPERSEDES** `SECTION2-OPEN-SYSTEM.md` §3, paragraph 3.

### 3.1 The camera is fixed at entry and holds

```
entry     yaw π ± 0.95, pitch 0.24, dist = planetR × 6      (unchanged)
after     the camera HOLDS. No drift, no auto-orbit, no easing settle.
```

Revolution is **never** expressed by moving the camera. It is read from the
planet's own motion along the orbit, the trail, the orbit ticks passing, and the
starfield drift behind. If the camera expressed it, every static frame would lie
about where the user is standing, and pan/zoom would fight an animation that
never stops.

### 3.2 What the user can do

```
orbit       drag              yaw ×0.006, pitch clamp ±1.35        (unchanged)
zoom        wheel / − +       exp(Δy·0.0012) · ×0.8 / ×1.25        (unchanged)
pan         right-drag, or two-finger, or space-drag
            → moves the camera TARGET perpendicular to the view axis
            → clamped to a sphere of radius orbitR × 1.4 around the barycentre,
              so the system can never be lost off-frame
focus       [ FOCUS PLANET ] / [ FOCUS STAR ] / [ FOCUS SYSTEM ]
```

### 3.3 Focus — the only camera motion the design initiates, and only on request

```
target      barycentre (SYSTEM) | star centre | planet centre (tracked)
tween       700 ms easeInOutCubic on the target point AND on distance
            yaw and pitch are NOT changed — the user's viewing angle is theirs
tracking    with FOCUS PLANET the target follows the planet continuously after
            the tween; the camera therefore translates but never rotates on its own
release     any drag cancels tracking and leaves the target where it is —
            the user always wins
```

Focusing the planet at inspection distance and letting the target track it is
what makes "the camera rotates to the planet" honest: the *camera* moves to keep
the planet framed, the *scene* is not rotated to present it.

### 3.4 Zoom regimes stay as specified

`min = planetR × 1.9`, `max = max(planetR × 16, orbitR × 2.6)`. The floor comes
from the guaranteed periapsis clearance: the camera can never enter the planet
and never escape toward the star. Panning does not change either bound.

---

## 4. THE STARFIELD BACKDROP — REVOLUTION MADE VISIBLE

### 4.1 Direction is law IV

```js
dir       = +1 counter-clockwise (as seen from the system's north pole)
          = −1 clockwise
driftX    = −dir · rate            // CW (−1) → +x → stars move RIGHT
                                   // CCW (+1) → −x → stars move LEFT
```

One variable. The trail, the chevrons and the drift cannot disagree because there
is nothing for them to disagree with.

### 4.2 Rate — tied to the orbit, not to the wall clock

```
ω(t)     the planet's instantaneous Keplerian angular rate (already computed)
rate     = ω(t) · pxPerRadian · depthFactor
pxPerRadian ≈ 46 px at reference zoom, scaled with the camera's field width
```

Because `ω` is Keplerian, the backdrop **speeds up at periapsis and slows at
apoapsis**. That is the effect doing real work: eccentricity becomes something
you can feel, in a view where the ellipse alone barely shows it.

### 4.3 Three parallax layers

| layer | count | depth | size | alpha | drift |
|---|---|---|---|---|---|
| far | 220 | 1.0 | 0.6–1.0 px | 0.16–0.34 | `rate × 0.28` |
| mid | 110 | 0.55 | 0.9–1.5 px | 0.30–0.55 | `rate × 0.62` |
| near | 34 | 0.25 | 1.4–2.2 px | 0.45–0.80 | `rate × 1.00` |

```
colour     #dfe6ff base, 18% of stars tinted #ffd9b0 or #c8d8ff
twinkle    alpha × (0.86 + 0.14·sin(t·f + φ)), f ∈ [0.25, 0.7] Hz, per star
           — slow enough to be atmosphere, never a sparkle
wrap       x = ((x + drift·dt) mod (W + 40)) − 20 , seamless, no regeneration
vertical   none. The field drifts on ONE axis. A two-axis drift reads as the
           camera tumbling, which contradicts §3.1.
```

The starfield does **not** rotate. Rotation of the backdrop would imply the
camera is rolling; linear drift implies the *world* is moving past — which is
what revolution actually looks like from a fixed viewpoint.

### 4.4 Cost

One `Float32Array(n·4)` (`x, y, r, phase`) per layer, allocated once. One
`fillRect` per star, no `arc`, no `shadowBlur`, no per-star `save/restore`, sorted
into three `fillStyle` groups by alpha bucket. 364 stars ≈ 0.25 ms. It draws into
the system view's existing canvas as the first pass — not a second canvas, not
DOM.

---

## 5. THE PLANET — TEXTURE

Everything here is procedural and is already named as such in the disclosure
block (`SURFACE // PROCEDURAL · NOT OBSERVED`). The texture's job is to make
rotation legible; it must never imply an observation.

### 5.1 Four classes, chosen from archive values

| class | condition | treatment |
|---|---|---|
| **BANDED** | `rade ≥ 6` | 7–11 latitude bands, widths from a seeded noise walk, adjacent bands ±6% lightness, one darker equatorial belt at 1.6× width, band edges softened 3 px |
| **ICE** | `rade 2–6`, `teq < 300 K` | 3 broad bands, very low contrast (±3%), a brighter polar cap above \|lat\| 62° |
| **ROCK** | `rade < 2`, `teq < 900 K` | 40–70 seeded craters, radius 2–9 px, rim 1 px lighter, floor 6% darker; a faint mottle at 2 octaves |
| **LAVA** | `teq ≥ 900 K` | dark crust with a fracture network (3 seeded great-circle arcs, 2 px, `#ff7a3c` at 0.5), glow strictly inside the disc |

Seed is `hash(pl_name)`, so a planet looks the same on every visit — a texture
that re-randomises reads as noise, not as a world.

### 5.2 Rotation

```
period      illustrative, 24 s per revolution at ×1 time scale
motion      the texture is drawn in planet-local longitude; longitude advances,
            the disc does not spin as a bitmap
sub-solar   the terminator is computed from the star's true direction each frame
            (HOTSPOT.md), so features cross the terminator correctly
```

Features must pass **into and out of** shadow. That crossing is the whole reason
the texture exists; a texture that is uniformly lit conveys nothing about
rotation.

### 5.3 Lighting contract (from `HOTSPOT.md`, unchanged)

Texture multiplies the existing limb/terminator solution. It never adds light,
never lightens the night side, and never draws inside the shadow beyond the
ambient floor. Texture contrast is scaled by local illumination, so the day side
carries the detail and the terminator carries the drama.

---

## 6. THE STAR

The existing effect is right in kind and too soft in execution. Three changes,
all about **edge**.

### 6.1 Temperature → colour

```
teff (K)    2500    3400    4500    5200    5800    6600    8000   12000+
disc        #ff8a4c #ffa864 #ffc27e #ffe0b0 #fff6e8 #f6f2ff #dde6ff #bccdff
corona      the disc colour at 0.55 saturation, never white
```

Interpolate in Oklch between stops, not in sRGB — sRGB interpolation of these
ramps goes through a muddy grey around 5200 K. If `st_teff` is null: neutral
`#e8ecf5` and the panel says `TEFF // NOT IN ARCHIVE`. Never guess a colour from
the spectral letter alone.

### 6.2 Making it clear — a disc with a limb, not a blob

```
1  corona sprite   ONE offscreen radial-gradient sprite, generated once per
                   star colour, drawn scaled. Never a per-frame gradient,
                   never shadowBlur.
2  the disc        HARD-EDGED fill at exactly the apparent radius. This is the
                   change: the current version fades into its own glow, so the
                   star has no size, and without size the scale of the system
                   cannot be read.
3  limb darkening  a second radial fill inside the disc, 1.0 centre → 0.82 edge
4  chromatic rim   0.8 px stroke of the disc colour at 1.5× brightness
5  the halo        two concentric rings at 1.9× and 3.4× the disc radius,
                   alpha 0.12 / 0.05 — structure, not haze
```

The panel gains one line: `{teff} K · {spectral}` with a 10 px swatch of the disc
colour, so the colour is stated as data rather than left as decoration.

### 6.3 The orbit, coloured by temperature — made explicit

The orbit ring carries the planet's **equilibrium temperature along the path**,
which varies with distance from the star on an eccentric orbit. The current
version is a subtle tint; it needs to be a stated scale.

```
gradient    along the ellipse, keyed to instantaneous separation:
            periapsis end  → the hot colour (#ff7a4c)
            apoapsis end   → the cool colour (#5c9bff)
            interpolated in Oklch, applied as a per-segment stroke colour over
            96 segments (a canvas linear gradient cannot follow a curve)
width       1.4 px, alpha 0.7 at the hot end → 0.45 at the cool end
legend      bottom-left of the shell, two 8 px chips and their values:
            ` TEQ  1,180 K ●———● 640 K `      hot chip left, cool chip right
circular    if e < 0.02 the gradient is suppressed entirely and the ring is drawn
            at one flat colour with a single `TEQ 640 K` chip. A gradient with
            nothing to show is a lie about eccentricity.
```

Teq is derived, not archived — the disclosure block already names it, and the
legend chip carries a 1 px dotted underline marking it as computed.

---

## 7. ORBIT POINTS, TRAIL AND DIRECTION

### 7.1 Time ticks — the points on the orbit

```
count     24 marks, placed at EQUAL TIME intervals (equal mean anomaly), which
          means unequal spacing on the ellipse
size      1.6 px dots, rgba(150,170,255,0.34); every 6th is 2.4 px at 0.55
```

Equal-time spacing is the point. The marks bunch at apoapsis and spread at
periapsis, so **Kepler's second law is visible as a pattern of dots** without a
word of explanation. Equal-angle marks would have said nothing.

### 7.2 Direction chevrons

```
count     4, at 0° / 90° / 180° / 270° of true anomaly
shape     7 px chevron, tangent to the ellipse, apex pointing ALONG dir
alpha     0.28, rising to 0.5 within 40° ahead of the planet
```

### 7.3 The trail

```
geometry  drawn along the ellipse path BEHIND the planet — never a straight
          line, never a screen-space smear
length    38° of true anomaly, or 0.09 of the period, whichever is shorter
build     18 segments, alpha 0.55 at the planet → 0 at the tail, width 2.2 → 0.6
colour    the planet's own class colour at 0.8 saturation
head      a 3 px dot at the planet's position for the frame the planet is
          smaller than 3 px (far zoom), so the trail always has an origin
```

The trail is the primary read of direction at overview zoom, where the planet is
a few pixels and its own motion is slow. **`dir` drives it, and `dir` drives the
starfield.** They are the same variable, so at any zoom the backdrop and the
trail state the same rotation — that consistency is the effect. If the trail
sweeps counter-clockwise, the stars drift left. Always.

### 7.4 The planet marker at overview zoom

Below 4 px apparent radius the planet is drawn as a 4 px dot with a 1 px ring at
`rgba(232,236,255,0.8)`, so it never disappears into the orbit line. Above it,
the real disc with its texture.

---

## 8. TIMING TABLE

| effect | duration | easing | clock |
|---|---|---|---|
| projection morph (points + tapes) | 900 ms | easeInOut | shared driver |
| HUD title cross-fade | 315 / 315 ms | linear | morph clock, 0–35% / 65–100% |
| method filter fade | 420 ms | easeInOut | shared driver |
| envelope settle | ~160 ms | exponential k=0.055 | per frame |
| dive | 720 ms (veil 400–720) | accelerating | shared driver |
| system approach | 1150 ms | easeOut | system rAF |
| surfacing (return) | 620 ms | decelerating | shared driver |
| focus change | 700 ms | easeInOutCubic | system rAF |
| orbit scale change | 480 ms | easeInOut | system rAF |
| starfield drift | continuous | — | Keplerian ω |
| planet rotation | 24 s / rev | linear | time scale |

All field-side tweens live in the one tween set (`SOLUTION.md` Contract C) and
retarget from current values. All system-side tweens live in the system's own
loop, which runs only while the system view is mounted.

---

## 9. REDUCED MOTION

`prefers-reduced-motion: reduce` — the picture stays correct, the transitions do
not happen:

```
morph            instant, positions swap; tapes swap with no travel
dive / surfacing skipped; the veil is a 120 ms fade
starfield        static — drawn once, no drift. Direction is then carried by the
                 chevrons and a `↻ / ↺` glyph in the legend, which is why those
                 exist as furniture and not as animation.
planet rotation  stopped at phase 0; the terminator is still correct
trail            drawn at full length, static
HUD tape         still scrolls with the drag — it is a direct response to the
                 user's own gesture, not an autonomous animation
```

The rule: reduced motion removes motion the user did not cause. It never removes
information, and it never removes the response to a gesture.

---

## 10. WHAT MUST NEVER MOVE

A short list, and the reason each one is on it:

- The camera, unless the user moved it or asked for focus (§3.1).
- Pan and zoom during a projection change (§1.1).
- The starfield on the vertical axis (§4.3) — it would read as tumbling.
- Tick *labels* as words during a morph — they cross-fade, they do not slide
  (§2.2).
- The HUD tape scale under rotation (§2.3) — a heading tape has a constant
  scale.
- Anything at all while the veil is opaque (`SOLUTION.md` step 6): the veil is a
  hand-off, not a curtain, and nothing worth seeing happens behind it.
