# FIX.md — Section 2 defect report and repair scheme

Seven observed anomalies, diagnosed against the shipped design in `SECTION2.md`
and its companion documents. **Nothing in those documents is retracted here**;
where the intended behaviour itself changes, it is marked **INTENT CHANGE** and
the superseded line is named so it can be folded back afterwards.

Each item is: symptom → root cause → minimal fix → reconstruction scheme if the
minimal fix does not hold → how to verify.

---

## 0. FOUR SHARED ROOT CAUSES

Five of the seven defects are the same four contracts being broken. Fix these
first and #1, #3, #6 and #7 largely fall out.

### CONTRACT A — the definite-height chain

Every link must be present or the page becomes content-driven and grows:

```
frame box      height: calc(100vh - 52px)      ← definite, NOT min-height
grid           grid-template-rows: minmax(0,1fr)
each column    min-height: 0                   ← on the column itself
scroll owner   overflow-y: auto  +  min-height: 0
inner list     flex: 0 0 auto                  ← never flex:1, never shrinkable
```
**One scroll owner per column.** The column scrolls; the list inside is plain
flow. If the list is the scroller it becomes the only shrinkable child of a
definite-height column, absorbs the whole overflow deficit, and collapses.

Diagnostic, paste in console:
```js
const box = document.querySelector('[data-frame-box]');
console.log(getComputedStyle(box).height, box.scrollHeight, box.clientHeight);
// scrollHeight must equal clientHeight. If it is larger, a link is missing.
[...box.querySelectorAll('*')].filter(el => {
  const s = getComputedStyle(el);
  return s.display.includes('flex') && s.minHeight === 'auto';
}).forEach(el => console.warn('missing min-height:0', el));
```

### CONTRACT B — the layer order

One explicit stacking scale; no implicit ordering, no `z-index` outside it:

```
0   section ground        #03040a
5   starfield
10  fan ring pass
11  fan inner pass        (masked out of the centre column)
12  fan header patch      (only while the cut exists)
13  fan apex patch        (only while the cut exists)
20  frame box             transparent
25  rails                 outline only
30  field box             OPAQUE #03040a in SOLID
31  canvas
32  field overlays
39  dive veil
40  system shell
```
Nothing paints between 30 and 39 except the field's own content.

### CONTRACT C — one animation driver

A single rAF loop owns a **set** of active tweens and runs while any is pending:

```js
tweens = { morph?, filter?, center?, dive?, surface?, envelope? }
tick(): for each present tween → advance, apply; drawField(); if any remain → rAF
```
The current `startFieldAnim()` returns early when `_fieldRaf` is already set, so
a tween started while another is running is never advanced — that is why the
filter fade (#7) does not appear. **Never early-return on the handle; early-return
only when the tween set is empty.**

### CONTRACT D — one plot rect per frame

The HUD is not four independent tapes. Compute one rect, and every tape, tick
and bracket reads it:

```js
plotRect(t) {
  const env = this.envelope(t);                    // resolved, filtered points only
  const l = Math.max(env.x0, 16);
  const b = Math.min(env.y1 + 26, this.bottomReserve(t));
  const r = clamp(Math.min(env.x1 + 26, this.annoLeftEdge(t) - 10, t.w - 14),
                  l + 140, t.w - 14);              // never collapse, never flee
  const tp = Math.max(env.y0, this.topReserve());
  return { l, r, t: Math.min(tp, b - 120), b };
}
```
Corner connection is then structural: the bottom tape spans `l→r` at `y=b`, the
vertical tape spans `t→b` at `x=r`, and they meet at `(r,b)` by construction, not
by coincidence.

---

## 1. FIND IS DISABLED — no scroller, frame grows, cloud leaks

**Symptom** (screenshot 2): with FIND open the left rail renders the full result
list at natural height; the frame box, the section and the page all grow with it;
the field's points and axis furniture paint outside the field box; the field
border runs off screen. The rail has no scrollbar, so FIND is effectively
unusable.

**Root cause** — Contract A is broken, and Contract B with it:
1. the rail is missing `min-height: 0`, or the grid row is not `minmax(0,1fr)`,
   or the frame box is on `min-height` instead of `height`;
2. the result list is the flex child that grew, so the column never overflowed
   and `overflow-y:auto` had nothing to do;
3. the field box has lost `overflow: hidden`, so the canvas — which is sized to
   its *client* box but drawn in CSS pixels of the grown row — paints beyond it.

**Minimal fix**
```css
[data-frame-box]  { height: calc(100vh - 52px); }        /* not min-height */
[data-grid]       { grid-template-rows: minmax(0,1fr); }
[data-rail]       { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
[data-find-list]  { flex: 0 0 auto; }                     /* plain flow */
[data-field-box]  { overflow: hidden; min-height: 0; contain: paint; }
```
`contain: paint` is the belt to `overflow:hidden`'s braces: it guarantees the
canvas cannot paint outside the box even if a descendant escapes the clip.

**Reconstruction scheme** (if the rail still grows — do this rather than hunt)

Rebuild the FIND rail as three explicit rows instead of one flex column:
```
rail: display:grid; grid-template-rows: auto 1fr auto; min-height:0; height:100%
  row 1  controls   (tabs, search, presets, requirements, sort, count)  auto
  row 2  results    min-height:0; overflow-y:auto; overscroll-behavior:contain
  row 3  SHOWING x OF y                                                 auto
```
A grid row of `1fr` with `min-height:0` cannot be inflated by its content, which
removes the failure mode entirely. The scroller is row 2 and only row 2. Keep the
purple scrollbar rule (10px, thumb `#7a5cc4`, radius 6, 2px `rgba(3,4,10,.9)`
border, glow `0 0 7px rgba(154,116,255,.75)`, hover `#a184f0`).

Cap the rendered rows at the existing 80 + `[ SHOW 120 MORE ]`. If the list ever
needs to be uncapped, virtualise — but do not remove the cap as a fix for
scrolling.

**Verify** — open FIND with 1,197 results: `document.scrollingElement.scrollHeight`
must equal `innerHeight`; the rail must show a scrollbar; no point may render
outside the field box (`getBoundingClientRect()` of the canvas must equal the
field box's).

---

## 2. THE BACKGROUND IS NOT PURE DARK

**Symptom** (all three screenshots): the fan bleeds across the whole section
including the plot area; corners read maroon and orange; the footer says
`FIELD GROUND: SOLID` while the fan is clearly visible behind the points.

**Root cause** — three independent contributors, all present:
1. section ground is `#070812`, not `#03040a`;
2. the centre-cut mask is not applying — either only `mask-image` is set without
   `-webkit-mask-image`, or it is set on a wrapper rather than on the painting
   `<svg>`, or `mask-mode`/`mask-type` defaults are fighting it;
3. the field box's background is transparent while the state says SOLID — a
   label/state desync, or the fan passes are painting above the field box
   because Contract B is not explicit.

**Minimal fix**
```
section ground        #03040a
field box (SOLID)     background:#03040a  — opaque, at layer 30
fan inner pass        -webkit-mask-image AND mask-image, both on the <svg>
                      linear-gradient(90deg,#000 0 20%,transparent 30%,
                                            transparent 70%,#000 80%)
                      + -webkit-mask-repeat/mask-repeat: no-repeat
                      + -webkit-mask-size/mask-size: 100% 100%
```
Then assert the desync away: the field box background is derived from **one**
boolean, and the footer label reads the same boolean. Not two sources.

**If pure dark is wanted unconditionally** (recommended given the screenshots):
make SOLID stronger than it currently is — drop the fan's inner pass from `.3`
to `.18`, keep the cut, and let the ring pass carry the identity. The fan then
frames the instrument instead of tinting it. CLEAR is unchanged and remains the
composition view.

**Verify** — sample the canvas backdrop: with SOLID, pixels inside the field box
and outside the point cloud must be exactly `#03040a`. Toggle to CLEAR and back
twice; SOLID must return to pure.

---

## 3. THE AXES ARE DISCONNECTED AND MIS-BUILT

**Symptom** (screenshot 1): the bottom tape floats far below the cloud; the
vertical tape is a stranded tick ladder near the right edge with orphaned `1` and
`10` labels; corner brackets sit in mid-air, unattached to either tape; the two
tapes never meet.

**Root cause** — the four extents are computed independently:
- `ax` is pulled to `annoLeftEdge − 10` (the unresolved cloud's left edge), which
  in ORBIT × SIZE sits near the canvas edge — so the vertical tape flees the data;
- `ay` and `top` come from different clamps, so nothing shares a corner;
- brackets are drawn from `env.x0/top`, which is a third set of numbers;
- the ladder is drawn even when its span is degenerate.

**Fix — adopt Contract D.** One `plotRect` per frame; all four sides derive from
it. This makes the tapes corner-connected by construction and kills the stranded
ladder (the `l + 140` floor and the `b − 120` clamp guarantee a usable span or no
tape at all).

**Reconstruction scheme** (the "reboot", ~120 lines, and worth it)

Make the HUD a **pure function** of geometry, emitting primitives:
```js
buildHud(projection, plotRect, scale, state) -> {
  lines:  [{x1,y1,x2,y2,alpha}],
  ticks:  [{x,y,len,axis,major}],
  labels: [{x,y,text,align,baseline,alpha}],
  brackets:[{path}]
}
drawHud(ctx, hud)      // the only place that touches the canvas
```
Benefits: the HUD becomes testable without a canvas (assert that the bottom tape
ends exactly where the vertical tape begins); the cross-fade is one `alpha`
multiply on the whole set; and per-projection differences become four small
builders over one shared rect instead of four drawing routines with their own
clamps.

Keep unchanged, because they are correct: the tick generators (1-2-5 decades,
integer-snapped years), the domain caching over the whole archive, the
exponential envelope settle, and the no-plates rule.

Two extra rules the screenshots demand:
- **No tape without a span.** If `r − l < 140` or `b − t < 120`, emit nothing.
  A five-tick stub is worse than no axis.
- **The tape belongs to the data, not to the cloud.** The unresolved annotation
  may push the tape left but must never pull it right of `env.x1 + 26`.

**Verify** — in every projection, at 5 zoom levels and both rail states: the
bottom tape's right end and the vertical tape's bottom end must be the same
point to the pixel; no label may fall outside `plotRect`; no orphan ticks.

---

## 4. THE OPEN SYSTEM ZOOM IS MISSING ON THE FIELD SIDE

**Symptom**: pressing `[ OPEN SYSTEM ]` goes black and arrives; there is no
visible dive into the point. Returning is likewise instant on the field side. The
in-system approach and pull-back behave correctly.

**Root cause** — three, and all three must be fixed:
1. **The veil outruns the dive.** It ramps `0→1` over 600 ms on
   `cubic-bezier(.7,0,.9,.3)`, which is past 50 % black by ~250 ms of a 720 ms
   dive. The zoom happens behind an opaque veil.
2. **The dive tween is not being advanced** — Contract C: `startFieldAnim()`
   early-returns when a loop is already running, and the dive is also gated on
   `!this._tweenFrom`, so any in-flight morph silently cancels it.
3. **There is no return tween at all.** On exit the field is restored to its
   saved view *instantly, under the veil*. The zoom-out was never implemented —
   only the 3D camera pulls back.

**Fix**

*Enter — 720 ms, veil delayed:*
```
0    → 400 ms   field zooms toward the point, veil opacity 0        (visible dive)
400  → 720 ms   veil 0 → 1, ease-in                                 (the hand-off)
720            mount system; camera at yaw π ± 0.95, pitch 0.24
720  → 1870    the 1150 ms approach (already correct)
```
Keep zoom `× 11` and the accelerating position curve. The dive must run on the
shared driver and must **not** be gated on a morph: if a morph is in flight,
finish it into the dive by retargeting from the currently drawn positions —
exactly as a morph-to-morph switch already does.

*Leave — add the surfacing tween, 620 ms:*
```
0    → 260 ms   3D camera pulls back (already correct), shell fades
260            restore the field AT THE DIVE'S END STATE — zoomed into the
               point, not at the saved view
260  → 880     field tweens OUT from zoom×11 back to the saved {cx,cy,zoom},
               decelerating; veil lifts 0 over the first 380 ms of this
880            tween set empty; archive is exactly as it was
```
This is the missing half. The rule to hold on to: **the veil is a hand-off, not
a curtain.** It must be transparent while anything is moving that the user is
supposed to see, and opaque only across the instant where two different
renderers swap.

State to keep for it: `_diveSaved = {layout, cx, cy, zoom}` already exists — keep
it alive until the surfacing tween completes instead of clearing it at mount.

**INTENT CHANGE** — supersedes `SECTION2-INTERACTION.md` §14 and `SECTION2.md`
PART IV §14: the veil is delayed rather than co-timed, and a 620 ms surfacing
tween is added on exit. Reduced motion still skips both.

**Verify** — capture frames at 100/300/500/700 ms of the dive: the point must be
visibly larger and closer to centre in each, and the veil must still be
transparent at 300 ms. On return, capture at 300/600/900 ms: the field must be
zooming out, not already settled.

---

## 5. EARTH DISTANCE — CIRCLE / ELLIPSE MISMATCH

**Symptom**: the rings and the point cloud disagree about what a constant
distance looks like. In one frame the cloud is a wide ellipse while the rings are
near-circular; in another the rings extend well past the data. Either way the
furniture is not the same shape as the thing it measures.

**Root cause** — the projection is written in normalised space and then scaled by
`sx` and `sy` **independently**, so a locus of constant distance maps to an
ellipse with ratio `sy/sx`, while the ring furniture applies its own aspect
handling. Two different aspect treatments in one projection.

This is a design decision, not just a bug — so here are four coherent options.

### Option A — aspect-correct the projection (the "reboot")
Compute the radial layout in a **square world**, and apply one aspect factor at
draw time to points *and* rings alike:
```
u = 0.5 + r·cosθ ,  v = 0.5 + r·sinθ            in square space
screen = (u·s + ox , v·s + oy)  with  s = min(sx, sy)
```
Equal distance is then equal screen radius: true circles, points and rings
agreeing exactly. Cost: the projection no longer fills a wide viewport
edge-to-edge; you letterbox horizontally. **Recommended if the radial reading
matters more than filling the frame** — and for a distance projection it does.

### Option B — keep the anisotropy, make the furniture match (3-line fix)
Draw the rings with the same transform the points get:
```js
ctx.ellipse(cx, cy, r*sx, r*sy, 0, 0, 2π)
```
Points and rings then coincide by construction. The picture is an ellipse and
honestly so: the screen is not square, and the projection says so. Cheapest fix,
no architectural change, keeps the existing pan/zoom untouched.

### Option C — square the fit rect for this projection only
Force `sx = sy` by giving `distance` a square fit rect and centring it. Circles
everywhere, no per-primitive aspect code, at the cost of unused margin on wide
screens. Simplest to reason about; slightly wasteful.

### Option D — drop the radial metaphor
Replace with a **1-D distance ladder**: a single log axis with the population
stacked as a deterministic vertical spread. Nothing about the picture then
implies a direction that the data does not have — the honest option, and the one
that loses the most character. Worth prototyping alongside A before committing.

**Recommendation**: ship **B** now (it removes the contradiction today), and
prototype **A** as the intended end state. Whichever wins, the angle stays
labelled `ANGLE: DISPLAY DISTRIBUTION` — none of these options gives the angle
meaning.

**Verify** — pick three records at nearly equal `dist_pc` and different hashed
angles. Their screen distance from SOL must be equal to within a pixel, and each
must sit on the same ring.

---

## 6. THE RAILS DO NOT SCROLL UNDER THE CURSOR

**Symptom**: hovering the left or right rail and scrolling does nothing.

**Root cause** — two, usually together:
1. Contract A again: the rail grew to fit its content, so there is no overflow to
   scroll. `scrollHeight === clientHeight` means the wheel has nothing to do —
   this is #1 wearing a different hat.
2. A wheel listener registered non-passively above the canvas (on the section,
   the frame box, or the document) calls `preventDefault()` for events that
   originate in a rail.

**Fix**
```js
// Bind the field's wheel handler to the CANVAS ELEMENT only, non-passive.
canvas.addEventListener('wheel', onFieldWheel, { passive: false });
// Nothing else in section 2 registers a non-passive wheel listener.
// If a broader handler must exist, it exits early:
if (!e.target.closest('[data-field-box]')) return;   // before preventDefault
```
Then per Contract A the rails overflow and scroll natively. Keep
`overscroll-behavior: contain` so a rail at its end does not scroll the page —
that is the intended containment, not a bug.

**Verify** — with FIND open and the TARGET panel full: wheel over each rail
scrolls that rail and not the page; wheel over the field zooms and does not
scroll the page; wheel over the footer scrolls the page normally.

---

## 7. FILTER AND PROJECTION TRANSITIONS

### 7a. OBSERVATION METHOD must fade, not switch

**Symptom**: changing the method snaps.

**Root cause** — Contract C: `setMethodFilter` sets `_filterFrom` and calls
`startFieldAnim()`, but the loop is often already running (envelope settle), so
the call early-returns and `_filterProg` never advances. The values are correct;
the clock never starts.

**Fix** — one driver, a tween set, no early return on the handle. Then the
existing interpolation does the work:
```
matched:   r 1.2 → 2.0 px ,  α 0.1 → 0.8
unmatched: r 2.0 → 1.2 px ,  α 0.8 → 0.1
duration 420 ms, easeInOut, one clock for both directions
```
Two rules to add: the tween must **retarget from current values** (rapid filter
clicks must not pop), and no record leaves the draw loop at any point in it —
this is a dim, not a removal.

### 7b. FIELD PROJECTION must move positions only

**INTENT CHANGE** — this supersedes `SECTION2.md` PART IV §13 and
`SECTION2-INTERACTION.md` §13, which specify that the morph also interpolates the
fit rect, pan and zoom.

New behaviour: **the morph interpolates point positions and nothing else.** The
user's pan and zoom are theirs; a projection change must not take the camera
away from them.

```
morph:   points  from currently-drawn  →  destination        900 ms easeInOut
keep:    zoom, cx, cy, and the SPATIAL camera — untouched
keep:    HUD cross-fade (source out over first 35%, destination in over last 35%)
keep:    after-image (last 14% of path, 22px cap, sin(πp) envelope)
drop:    fit-rect / pan / zoom interpolation
```

Two edge cases, and their answers:
- **The destination cloud lands entirely outside the current view.** Do not
  silently re-frame. Finish the morph, then show one line in the field caption:
  `TARGET POPULATION OFF-FRAME · FIT FIELD` — the user re-frames deliberately.
  (Optional refinement if this proves annoying in use: re-centre *only* when zero
  resolved points are on screen, on a separate 400 ms tween that starts after the
  morph completes, so the two motions are never confused.)
- **The fit rect differs between projections** (only `sky3d` and clouds with
  unresolved records differ). Clamp the *existing* view into the new rect rather
  than interpolating toward its centre — a clamp is a correction, an
  interpolation is a hijack.

**Verify** — pan to a corner, zoom to 3×, then cycle all four projections: the
zoom readout and the view centre must not change at any point, and points must
travel continuously with no jump on the first or last frame.

---

## FIX ORDER

Do it in this order; each step makes the next one observable.

1. **Contract A** (height chain) → fixes #1 and half of #6.
2. **Contract C** (one driver) → fixes #7a, un-breaks the dive in #4.
3. **Contract B + pure dark** → #2.
4. **Wheel scoping** → the rest of #6.
5. **Contract D / HUD rebuild** → #3.
6. **Dive retiming + surfacing tween** → #4.
7. **Morph scope change** → #7b.
8. **EARTH DISTANCE: Option B now, prototype A** → #5.

Nothing here requires touching the data layer, the mappings, the tick
generators, or the system view's internals. Every fix is in layout, layering,
the animation driver, or the HUD's geometry — which is what the symptoms
predicted.

---

## AFTERWARDS

Two INTENT CHANGES are recorded above (#4 veil timing + surfacing tween,
#7b morph scope), and one decision is open (#5, options A–D). Once #5 is chosen,
fold all three back into `SECTION2.md`, `SECTION2-INTERACTION.md`,
`SECTION2-AXES.md` (Option A or B changes the ring construction) and `CLAUDE.md`
§5b rule 6, and delete the corresponding sections here so this file stays a
record of what was wrong rather than a second source of truth.
