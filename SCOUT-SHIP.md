# SCOUT-SHIP.md — the moving scouts

Two ships cross the hero on fixed routes, dragging a streak behind them. They
are the only continuous motion on the page and the only thing that establishes
scale: the globe is still, the fan is still, and these say the frame is live.

They are **pure DOM** — no canvas, no three.js. A zero-size anchor translates
across the viewport; everything visible hangs off it at negative offsets, so the
ship is at `x = 0` and its trail extends backwards.

---

## 1. Routes

Both routes are computed from the *measured* title box (`titleTop`,
`titleBottom` from a `getBoundingClientRect` on the `BLINDSPOTS` element, re-run
on resize and on `document.fonts.ready`), so the passes bracket the word at any
size:

```
topY = titleTop    − titleTop/18       // 1/18 of the gap out from the cap edge
botY = titleBottom + titleTop/18       // same offset, mirrored
```

Fallback before measurement (fonts still loading):

```
top:    calc(earthCy*0.94% − halfCap*0.94px)
bottom: calc((earthCy*0.94 + 5.6)% + halfCap*0.94px)
halfCap = max(28, earthPx*0.36) * 0.62
```

Anchor style, both routes:

```
position:absolute; left:0; width:0; height:0;
z-index:3; pointer-events:none; will-change:transform
```

---

## 2. Timing

One shared 60 s cycle, `linear`, infinite. The two ships share the cycle but
occupy different halves of it, so **only one is ever on screen**:

```css
@keyframes scoutRTL {                     /* upper route, right → left */
  0%             { transform: translateX(100vw) }
  41.67%, 100%   { transform: translateX(-66vw) }
}
@keyframes scoutLTR {                     /* lower route, left → right */
  0%, 49.8%      { transform: translateX(-80vw) scaleX(-1) }
  50%            { transform: translateX(0vw)   scaleX(-1) }
  91.67%, 100%   { transform: translateX(166vw) scaleX(-1) }
}
```

- `41.67 %` of 60 s = **25 s per crossing**, then a 35 s hold off-screen. The
  long empty stretch is the point: a scout is an event.
- The lower ship is the *same markup mirrored* by `scaleX(-1)` on the anchor, so
  the trail correctly extends behind it in the other direction.
- Its keyframes hold at `-80vw` until 49.8 %, jump to the start of its run at
  50 %, and travel to `166vw` — the jump happens off-screen and is invisible.
- Motion is `linear`. These have no engines to accelerate; easing would make
  them look like UI.

---

## 3. Anatomy of one ship

Five layers, all absolutely positioned relative to the anchor, listed back to
front. `66vw` trails, `22vw` core flash — viewport-relative so the streak scales
with the window.

| # | element | geometry | treatment |
|---|---|---|---|
| 1 | glow trail | `left:-2 top:-3`, `66vw × 7px`, radius 4 | `linear-gradient(180deg, rgba(199,33,56,.55) 0%, rgba(255,217,102,.6) 52%, rgba(129,216,255,.55) 100%)`, `blur(2.6px)`, `opacity .55` |
| 2 | core trail | `left:-2 top:-1.1`, `66vw × 2.2px`, radius 2 | `linear-gradient(180deg, #ff3b55 0%, #ffb765 38%, #ffe89a 60%, #a9e8ff 100%)`, `blur(.5px)` |
| 3 | hot flash | `left:-2 top:-.4`, `22vw × .8px` | `linear-gradient(90deg, rgba(255,252,245,1), rgba(255,240,215,0))`, `blur(.3px)` |
| 4 | ship | `left:-26 top:-1.1`, `26 × 2.1px` | `scout-ship.png`, `drop-shadow(0 0 2px rgba(255,250,242,.55))` |
| 5 | spark | `left:-17 top:-.9`, `1.6px` circle | `#fff`, `0 0 3px rgba(255,255,255,.95), 0 0 8px rgba(255,240,220,.65)` |

### 3.1 The two gradients

Both trails run **vertically** (`180deg`) across a 2–7 px height. That is the
whole trick: the streak is red at its top edge and cyan at its bottom, so a
2 px line carries a full spectral spread and reads as incandescent gas rather
than a coloured rule. The glow layer is the same ramp, wider, blurred and
desaturated.

### 3.2 The fade mask

Both trails carry a horizontal mask so they dissolve behind the ship instead of
ending:

```
glow:  linear-gradient(90deg, 1 0%, .7 8%,  .32 30%, .1 58–60%, 0 100%)
core:  linear-gradient(90deg, 1 0%, .92 6%, .55 26%, .2  58%,   0 100%)
```

The core holds its brightness ~3× longer than the glow in the first quarter,
which is why the head looks sharp and the tail looks like vapour. Set both
`-webkit-mask-image` and `mask-image`.

---

## 4. The globe cut-out

The lower route passes behind the globe. Rather than z-ordering it, its wrapper
is masked with a hole:

```
mr   = earthPx * 1.04
mask = radial-gradient(circle at earthCx% earthCy%,
         transparent 0, transparent mr px, #000 (mr+2) px)
wrapper: position:absolute; inset:0; z-index:3; overflow:hidden
```

The 2 px ramp is the only softness — a hard stop aliases badly at the terminator.
`1.04` (rather than 1.00) leaves a hairline of clearance so the trail never
grazes the silhouette.

The upper route takes no mask — but not because it misses the globe. At this
build's scale it does not: Mars fills most of the frame, and §1's routes bracket
a title that is itself centred on Mars, so the upper pass necessarily crosses the
disc. It crosses **in front of** it, and that is the point. The two passes are
meant to read as opposites — one over the world, one behind it — and the contrast
is what makes the second crossing land as a different event rather than a repeat.
Masking the upper route would throw that away.

So the rule is: mask the lower route, never the upper one. If the globe is ever
made small enough that the upper route genuinely clears it, nothing here changes
— the pass is in front either way.

---

## 5. Relationship to the fan

The scouts and the stripes are the same fiction: **the ships fly, the fan is the
record of where they went.** Keep them consistent —

- The trail gradient's three stops (red / amber / cyan) are the warm half of the
  fan palette plus its cold accent. Do not introduce a colour here that is not
  already in `STRIPE.md`.
- Trail thickness (2.2 px) and the fan's hairline furniture (1 px) are the same
  family; nothing in the hero is thicker than 7 px except type.
- Ships travel **horizontally** while the fan falls **vertically**. That
  contradiction is intentional and load-bearing: it stops the hero reading as one
  perspective scene.

---

## 6. Rules

- Two ships, never more. Never simultaneous.
- 60 s cycle, linear, no hover or scroll reaction — they are indifferent to the
  viewer.
- Routes are measured from the title, never hard-coded; if the title reflows the
  routes must move with it.
- `scout-ship.png` is a 26 × 2.1 px silhouette. Do not replace it with an SVG
  drawing or scale it up — at this size it is a suggestion, and it should stay
  one.
- Under `prefers-reduced-motion`, park both ships off-screen; do not slow them.
