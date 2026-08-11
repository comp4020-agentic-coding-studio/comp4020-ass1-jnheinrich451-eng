# SOLUTION.md — one repair plan for the seven defects + the frame rate

Entry point for the repair. Depth lives in \`FIX.md\` (root causes, per-defect
reconstruction schemes) and \`PERFORMANCE.md\` (the frame budget and the seven
techniques). This file is the order of operations and the code that changes.

Read this top to bottom once. **Do not start at defect #1** — the frame rate and
the height chain are upstream of five of the seven symptoms, and fixing them
first makes the rest visible.

---

## PART 0 — WHY YOUR FRAME RATE IS SINGLE DIGITS

Single-digit fps on drag/zoom/rotate/CENTER TARGET is never "too many points."
6,336 points is ~2.5 ms of fill. If you are at 8 fps you are spending ~120 ms a
frame, i.e. **~50× the cloud's real cost**, so the cloud is not what you are
paying for. There are exactly four things that cost that much, and CENTER TARGET
lagging tells me you have at least two of them.

### Killer 1 — \`setState\` on every pointer sample (and every tween frame)

This is the one. Pointer events fire faster than frames; a \`setState\` per event
means a full React reconcile of the whole section per event, 10–30 ms each,
queued ahead of the paint. Same for a tween that advances by \`setState\` —
CENTER TARGET is a tween, which is why it lags exactly like a drag does.

**The rule: view state is not application state.** Camera, \`zoom/cx/cy\`, drag
origin and every tween's progress are plain instance fields, mutated in place,
followed by a direct \`drawField()\`.

\`\`\`js
// WRONG — what a laggy build looks like
onMove = (e) => {
  this.setState({ cx: this.state.cx - dx, cy: this.state.cy - dy });  // reconcile per event
}
animateCenter = () => {
  this.setState({ prog: p });                                          // reconcile per frame
  requestAnimationFrame(this.animateCenter);
}

// RIGHT
onFieldMove = (e) => {
  if (this._dragging) {
    const v = this.viewFor(this.state.layout);   // plain object on the instance
    v.cx -= dx / t.sx;  v.cy -= dy / t.sy;
    this.clampView(v);
    this.drawField();                            // synchronous, no state
    return;                                      // and NO hit-test while dragging
  }
  const idx = this.findNearest(px, py, 18);
  if (idx !== this.state.hoverIdx) this.setState({ hoverIdx: idx });   // only on CHANGE
}
\`\`\`

Only two pointer-driven values may ever enter React state: the hover index and
the selection — and only when they actually change value.

**Verify:** instrument \`render()\` with a counter, drag for two seconds. Expected:
**0 renders.** If you see hundreds, nothing else in this document will help yet.

### Killer 2 — the canvas is enormous because the height chain is broken

This is defect #1 wearing a performance mask. A content-driven row makes the
field several thousand pixels tall; fill cost scales with **area**, and the
browser is also resampling a CSS-scaled backing store every frame. Check this
before optimising anything:

\`\`\`js
canvas.clientHeight            // must be the field box's height, not 3000+
canvas.width / canvas.clientWidth   // must be <= 2  (DPR capped at 2)
\`\`\`

And resize the backing store **only on change** — assigning \`canvas.width\`
clears and reallocates the whole buffer:

\`\`\`js
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const tw = Math.round(w*dpr), th = Math.round(h*dpr);
if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; }
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
\`\`\`

### Killer 3 — per-point cost that has no business being per-point

In descending order of damage:

- **\`shadowBlur\` in the cloud loop.** ~50× a plain \`arc\` fill. The single most
  common cause of a laggy scatter canvas. Glow in this design is CSS
  \`text-shadow\` on static DOM — **never** canvas shadow.
- **\`ctx.save()/restore()\` per point.** Group state; wrap whole passes.
- **Gradients, \`ctx.filter\`, rounded paths per point.** None.
- **No cull.** Add it first: \`if (x<-20||y<-20||x>w+20||y>h+20) continue;\`
  At 3× zoom most of the archive then costs nothing.
- **\`sqrt\` in hit-testing.** Squared distances only.
- **Object allocation per frame.** Positions are one \`Float32Array(n*2)\`,
  \`resolved\` a \`Uint8Array\`, morph target buffer allocated once and reused.
  Per-frame objects show as *periodic hitches* and a sawtooth heap, not steady
  slowness.
- **Reprojecting per frame.** 2D projections cache positions per layout and never
  recompute on pan/zoom — pan and zoom live entirely in \`sx, sy, ox, oy\`.
  SPATIAL reprojects once per **camera change**, into a preallocated buffer, so
  rotation is one reprojection per event and then a pure affine map per frame.

### Killer 4 — a compositor fight above the canvas

\`backdrop-filter\`, \`filter\`, \`mix-blend-mode\` or a big \`box-shadow\` on any
ancestor of the moving canvas can cost more than the entire draw. There is none
in this design. The fan SVGs — \`mask-image\` + \`clip-path\`, both expensive to
repaint — sit **below** the field box, and the field box isolates them:

\`\`\`css
[data-field-box] { overflow: hidden; contain: paint; }
\`\`\`

Without \`contain: paint\`, every canvas invalidation dirties the masked fan and
you repaint the fan at pointer rate. Rendering panel → Paint flashing: while
dragging, **only the canvas may flash.**

### The draw loop must not be permanent

No idle \`requestAnimationFrame\`. Drag and wheel draw synchronously. The rAF loop
exists only while the tween set is non-empty, and stops the moment it empties. A
permanent loop burns budget doing nothing and makes every real transition
compete with itself.

### Budget to hold

| stage | budget |
|---|---|
| \`drawField()\` whole | **< 4 ms** |
| per point | < 400 ns |
| \`findNearest\` | < 0.5 ms |
| SPATIAL reprojection | < 2 ms, per camera change |
| anything above the canvas | ~0 ms |

Profile in the order in \`PERFORMANCE.md\` §4 — React first, then draw cost, then
backing store, then projection counter, then heap, then paint flashing. If
\`drawField()\` is under 4 ms and it still lags, the cost is not in the canvas.

---

## PART 1 — THE FOUR CONTRACTS

Five of the seven defects are these four contracts being broken. Full statements
in \`FIX.md\` §0; the short forms:

**A — definite-height chain.** \`height: calc(100vh - 52px)\` (not \`min-height\`) →
\`grid-template-rows: minmax(0,1fr)\` → \`min-height: 0\` on each column → one
scroll owner per column with \`overflow-y:auto\` → inner list \`flex: 0 0 auto\`.
One scroll owner per column, and the list is never it.

**B — one explicit stacking scale.** ground 0 · starfield 5 · fan 10–13 · frame
20 · rails 25 · field box **30, opaque** · canvas 31 · overlays 32 · veil 39 ·
system shell 40. Nothing paints between 30 and 39 except the field's content.

**C — one animation driver, a tween *set*.**

\`\`\`js
tweens = { morph?, filter?, center?, dive?, surface?, envelope? }
tick() { for each present tween → advance, apply; drawField();
         if (any remain) rAF; else this._fieldRaf = null; }
startFieldAnim() { if (this._fieldRaf) return; ... }   // ← THE BUG
\`\`\`

That early-return on the *handle* is why the method fade (#7a) never appears and
why the dive (#4) silently dies: a tween started while another runs is never
advanced. **Early-return only when the tween set is empty.** Every tween
retargets from currently-drawn values, so rapid clicks never pop.

**D — one plot rect per frame.** The HUD is not four independent tapes.

\`\`\`js
plotRect(t) {
  const env = this.envelope(t);                 // resolved, filtered points only
  const l = Math.max(env.x0, 16);
  const b = Math.min(env.y1 + 26, this.bottomReserve(t));
  const r = clamp(Math.min(env.x1 + 26, this.annoLeftEdge(t) - 10, t.w - 14),
                  l + 140, t.w - 14);
  const tp = Math.max(env.y0, this.topReserve());
  return { l, r, t: Math.min(tp, b - 120), b };
}
\`\`\`

Corners then meet by construction, not coincidence.

---

## PART 2 — THE SEVEN, IN REPAIR ORDER

Each step makes the next observable. Do not reorder.

### Step 1 · Contract A → fixes #1 (FIND) and half of #6 (rails)

\`\`\`css
[data-frame-box] { height: calc(100vh - 52px); }
[data-grid]      { grid-template-rows: minmax(0,1fr); }
[data-rail]      { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
[data-find-list] { flex: 0 0 auto; }
[data-field-box] { overflow: hidden; min-height: 0; contain: paint; }
\`\`\`

If the rail still grows, **rebuild it rather than hunt** — three explicit rows,
which removes the failure mode entirely:

\`\`\`
rail: display:grid; grid-template-rows: auto 1fr auto; min-height:0; height:100%
  row 1  controls  (tabs, search, presets, requirements, sort, count)   auto
  row 2  results   min-height:0; overflow-y:auto; overscroll-behavior:contain
  row 3  SHOWING x OF y                                                 auto
\`\`\`

Keep the 80-row cap + \`[ SHOW 120 MORE ]\`, and the purple scrollbar (10px, thumb
\`#7a5cc4\`, radius 6, 2px \`rgba(3,4,10,.9)\` border, glow
\`0 0 7px rgba(154,116,255,.75)\`, hover \`#a184f0\`). Removing the cap is not a fix
for scrolling; virtualise if it must be uncapped.

*Verify:* with 1,197 results, \`document.scrollingElement.scrollHeight === innerHeight\`;
the rail shows a scrollbar; the canvas's \`getBoundingClientRect()\` equals the
field box's — no point outside the frame.

### Step 2 · Contract C → fixes #7a (method fade), un-breaks #4 (dive)

One driver, tween set, no early-return on the handle. The method fade's values
are already right; only the clock was never starting:

\`\`\`
matched:   r 1.2 → 2.0 px ,  α 0.1 → 0.8
unmatched: r 2.0 → 1.2 px ,  α 0.8 → 0.1
420 ms easeInOut, one clock both directions, retarget from current
\`\`\`

No record leaves the draw loop at any point — this is a dim, not a removal.

### Step 3 · Contract B + pure dark → fixes #2

\`\`\`
section ground      #03040a           (was #070812)
field box (SOLID)   background:#03040a — OPAQUE, layer 30
fan inner pass      -webkit-mask-image AND mask-image, both on the <svg> itself
                    linear-gradient(90deg,#000 0 20%,transparent 30%,
                                          transparent 70%,#000 80%)
                    + mask-repeat/-webkit-mask-repeat: no-repeat
                    + mask-size/-webkit-mask-size: 100% 100%
\`\`\`

Then kill the label desync: the field box background and the footer's
\`FIELD GROUND\` label derive from **one** boolean, not two sources.

Recommended given the screenshots: make SOLID unconditionally strong — drop the
fan's inner pass from \`.3\` to \`.18\`, keep the cut, let the ring pass carry the
identity. The fan frames the instrument instead of tinting it. CLEAR unchanged.

*Verify:* in SOLID, pixels inside the field box and outside the cloud are exactly
\`#03040a\`. Toggle CLEAR→SOLID twice; it must return to pure.

### Step 4 · Wheel scoping → the rest of #6

\`\`\`js
canvas.addEventListener('wheel', onFieldWheel, { passive: false });  // canvas ONLY
// no other non-passive wheel listener exists in section 2. If a broader one must:
if (!e.target.closest('[data-field-box]')) return;   // BEFORE preventDefault
\`\`\`

Keep \`overscroll-behavior: contain\` on the rails — a rail at its end must not
scroll the page.

*Verify:* wheel over each rail scrolls that rail only; over the field zooms and
does not scroll; over the footer scrolls the page.

### Step 5 · Contract D / HUD rebuild → fixes #3 (axes)

The reboot, ~120 lines, and worth it: make the HUD a **pure function** of
geometry that emits primitives, with one place that touches the canvas.

\`\`\`js
buildHud(projection, plotRect, scale, state) -> {
  lines:[{x1,y1,x2,y2,alpha}], ticks:[{x,y,len,axis,major}],
  labels:[{x,y,text,align,baseline,alpha}], brackets:[{path}] }
drawHud(ctx, hud)
\`\`\`

Testable without a canvas; the cross-fade becomes one alpha multiply over the
whole set; four small per-projection builders over one shared rect replace four
drawing routines with their own clamps.

Two rules the screenshots demand:
- **No tape without a span.** \`r-l < 140\` or \`b-t < 120\` → emit nothing. A
  five-tick stub is worse than no axis.
- **The tape belongs to the data.** The unresolved annotation may push the
  vertical tape left, never pull it right of \`env.x1 + 26\`.

Keep as correct: 1-2-5 decade ticks, integer-snapped years, whole-archive domain
caching, exponential envelope settle, no-plates rule.

*Verify:* every projection × 5 zoom levels × both rail states — the bottom tape's
right end and the vertical tape's bottom end are the same pixel; no label outside
\`plotRect\`; no orphan ticks.

### Step 6 · Dive retiming + the missing surfacing tween → fixes #4

Three causes, all must go: the veil outran the dive (past 50% black by ~250 ms of
a 720 ms dive — you were zooming behind an opaque curtain); the dive tween was
never advanced (Contract C) and was additionally gated on \`!this._tweenFrom\`, so
any in-flight morph cancelled it; and **there was no return tween at all** — only
the 3D camera pulled back.

**Enter — 720 ms, veil delayed:**
\`\`\`
0   → 400   field zooms toward the point, veil opacity 0        ← the visible dive
400 → 720   veil 0 → 1, ease-in                                 ← the hand-off
720         mount system; camera yaw π ± 0.95, pitch 0.24
720 → 1870  the 1150 ms approach (already correct)
\`\`\`
Zoom ×11 and the accelerating position curve stay. The dive runs on the shared
driver and is **not** gated on a morph — if a morph is in flight, finish it into
the dive by retargeting from currently-drawn positions, exactly as morph-to-morph
already does.

**Leave — add the 620 ms surfacing tween:**
\`\`\`
0   → 260   3D camera pulls back (correct today), shell fades
260         restore the field AT THE DIVE'S END STATE — zoomed into the point,
            NOT at the saved view
260 → 880   field tweens from zoom×11 back to saved {cx,cy,zoom}, decelerating;
            veil lifts to 0 over the first 380 ms of this
880         tween set empty; the archive is exactly as it was
\`\`\`

Keep \`_diveSaved = {layout, cx, cy, zoom}\` alive until surfacing completes
instead of clearing it at mount.

**The rule worth remembering: the veil is a hand-off, not a curtain.** It is
transparent while anything the user should see is moving, and opaque only across
the instant two renderers swap.

*INTENT CHANGE* vs \`INTERACTION.md\` §14.
Reduced motion still skips both.

*Verify:* frames at 100/300/500/700 ms — the point is visibly larger and nearer
centre in each, veil still transparent at 300 ms. Return at 300/600/900 ms — the
field is zooming out, not already settled.

### Step 7 · Morph scope → fixes #7b (projection change)

**The morph interpolates point positions and nothing else.** Pan and zoom are the
user's; a projection change must not take the camera away from them.

\`\`\`
morph:  points  currently-drawn → destination      900 ms easeInOut
keep:   zoom, cx, cy, and the SPATIAL camera — untouched
keep:   HUD cross-fade (source out over first 35%, dest in over last 35%)
keep:   after-image (last 14% of path, 22px cap, sin(πp) envelope)
drop:   fit-rect / pan / zoom interpolation
\`\`\`

Two edge cases: if the destination cloud lands off-view, **do not silently
re-frame** — finish the morph and show one caption line,
\`TARGET POPULATION OFF-FRAME · FIT FIELD\`. If the fit rect differs between
projections, **clamp** the existing view into the new rect rather than
interpolating toward its centre — a clamp is a correction, an interpolation is a
hijack.

*INTENT CHANGE* vs \`INTERACTION.md\` §13.

*Verify:* pan to a corner, zoom 3×, cycle all four projections — the zoom readout
and view centre never change; points travel continuously with no first/last-frame
jump.

### Step 8 · EARTH DISTANCE circle-vs-ellipse → #5 · **your decision**

Root cause: the projection is computed in normalised space then scaled by \`sx\`
and \`sy\` **independently**, so constant distance maps to an ellipse of ratio
\`sy/sx\` — while the ring furniture applies its own aspect handling. Two aspect
treatments in one projection. Four coherent exits:

| | what it does | cost | |
|---|---|---|---|
| **A** | radial layout in a **square world**, one aspect factor at draw time for points *and* rings: \`u=.5+r·cosθ, v=.5+r·sinθ\`, \`s=min(sx,sy)\` | letterboxes a wide viewport | true circles, exact agreement — **intended end state** |
| **B** | keep the anisotropy, make the furniture match: \`ctx.ellipse(cx,cy,r*sx,r*sy,0,0,2π)\` | picture is an ellipse, honestly so | 3 lines, no architecture change — **ship today** |
| **C** | square fit rect for \`distance\` only, \`sx=sy\`, centred | unused margin on wide screens | circles, simplest to reason about |
| **D** | drop the radial metaphor for a **1-D log distance ladder** with deterministic vertical spread | loses the most character | the honest option; prototype before committing |

**Recommendation: B now, prototype A as the end state.** Either way the angle
stays labelled \`ANGLE: DISPLAY DISTRIBUTION\` — none of these gives the angle
meaning.

*Verify:* three records with near-equal \`dist_pc\` and different hashed angles sit
at equal screen distance from SOL, to the pixel, each on the same ring.

---

## WHAT THIS DOES NOT TOUCH

No data layer, no mappings, no tick generators, no system-view internals. Every
fix is in layout, layering, the animation driver, the HUD's geometry, or one
projection's aspect handling — which is what the symptoms predicted.

## AFTER THE REPAIR

Three intent changes are now on record (#4 veil timing + surfacing tween, #7b
morph scope, #2 SOLID strength) and one decision is open (#5). Once you pick #5,
fold all of them into \`INTERACTION.md\`,
\`AXES.md\`, \`FIELD.md\` and \`CLAUDE.md\` §5b rule 6 as
\`FIXES-APPLIED.md\`, and reduce \`FIX.md\` to a record of what was wrong rather
than a second source of truth.