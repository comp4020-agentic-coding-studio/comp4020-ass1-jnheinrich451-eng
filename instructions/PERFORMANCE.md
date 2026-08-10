# PERFORMANCE.md — the field must feel like glass

Section 2 draws 6,336 records into one canvas and must stay smooth while
dragging, wheeling, morphing and hit-testing. It does, and not by accident: the
budget below is the design, and every technique in it exists because dropping it
made the field feel lagged.

Read with `SECTION2-DATA.md` (the render pass) and `SECTION2-INTERACTION.md`
(what runs when).

---

## 1. THE BUDGET

At 60 fps a frame is 16.7 ms, and the canvas is not the only thing in it.

| stage | budget | notes |
|---|---|---|
| `drawField()` whole | **< 4 ms** | 6,336 points, HUD, furniture, marks |
| per point | < 400 ns | ~2.5 ms for the cloud, leaving room for the HUD |
| hit-test (`findNearest`) | < 0.5 ms | one linear scan, squared distances |
| reprojection (SPATIAL only) | < 2 ms | once per **camera change**, not per frame |
| everything above the canvas | ~0 ms | no React render, no DOM mutation during drag |

If `drawField()` is under 4 ms and dragging still feels heavy, **the cost is not
in the canvas** — go to §5.

---

## 2. THE SEVEN TECHNIQUES

Ordered by how much each one matters. The first is worth more than the rest
combined.

### 2.1 Pointer state never touches React

Camera, per-projection view (`zoom, cx, cy`) and drag origin are **plain instance
fields**, mutated in place, followed by a direct `drawField()`:

```js
onFieldMove = (e) => {
  if (this._dragging) {
    const v = this.viewFor(this.state.layout);   // plain object, not state
    v.cx -= dx / t.sx;  v.cy -= dy / t.sy;
    this.clampView(v);
    this.drawField();                            // no setState anywhere
    return;
  }
  const idx = this.findNearest(px, py, 18);
  if (idx !== this.state.hoverIdx) this.setState({ hoverIdx: idx });   // only on CHANGE
}
```

A `setState` per `mousemove` means a full reconcile per pointer event — 10–30 ms
a frame on a tree this size, and pointer events fire faster than frames. The
hover index is the *only* pointer-driven value that enters React, and only when
it actually changes.

**Rule: view state is not application state.** Anything that changes on every
pointer sample lives outside the component's state.

### 2.2 Draw on demand, never on a permanent loop

There is no idle `requestAnimationFrame`. Drag and wheel draw synchronously; the
rAF loop exists only while the tween set is non-empty and stops the moment it
empties. A permanently running loop burns a frame's budget doing nothing and
makes every real transition compete with itself.

```js
startFieldAnim() {
  if (this._fieldRaf) return;         // see FIX.md Contract C — must check the
  ...                                 // TWEEN SET, not the handle
}
```

### 2.3 DPR capped at 2, backing store resized only on change

```js
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const tw = Math.round(w * dpr), th = Math.round(h * dpr);
if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; }
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

On a 3× display, uncapped DPR is 2.25× the fill area for no visible gain on 2 px
dots. And assigning `canvas.width` **clears and reallocates the buffer** — doing
it unconditionally every frame is a hidden full-surface cost.

### 2.4 Typed arrays, zero per-frame allocation

Positions are one `Float32Array(n*2)`; `resolved` is a `Uint8Array`; the morph
target buffer is allocated once and reused:

```js
if (!this._drawPoints || this._drawPoints.length !== b.length)
  this._drawPoints = new Float32Array(b.length);
for (let i = 0; i < b.length; i++) this._drawPoints[i] = a[i] + (b[i] - a[i]) * e;
```

6,336 objects per frame is GC pressure, which shows up as **periodic hitches**
rather than steady slowness — a sawtooth heap in the Performance panel is the
signature. Never build an array of point objects in the draw loop.

### 2.5 The projection is not recomputed per frame

SPATIAL reprojects into a preallocated buffer once per **camera change**
(`refreshSky()`), so the draw loop is a pure affine map:

```js
const x = pts[i*2] * t.sx + t.ox, y = pts[i*2+1] * t.sy + t.oy;
```

No trig, no matrix, no division per point. The 2D projections cache their
positions per layout (`_layoutCache[id]`) and never recompute on pan or zoom at
all — pan and zoom are entirely in `sx, sy, ox, oy`.

### 2.6 The per-point path is deliberately cheap

- **Cull first.** `if (x < -20 || y < -20 || x > w+20 || y > h+20) continue;`
  At 3× zoom most of the archive is off-screen and costs nothing.
- **No `ctx.save()/restore()` per point.** State is grouped; `withAlpha()` wraps
  whole passes, not individual marks.
- **No `shadowBlur`, ever, in the cloud.** It is roughly 50× the cost of a plain
  `arc` fill and is the single most common cause of a laggy scatter canvas. Glow
  in this design comes from CSS `text-shadow` on static DOM, not from the canvas.
- **No gradients, no rounded paths, no `ctx.filter`** per point.
- **Squared distances in hit-testing** — no `sqrt` in a 6,336-iteration scan.
- Marked records (2–3 of them) are the only marks allowed multiple strokes, and
  they are held back and drawn last in their own short pass.

One honest cost that remains: `colorWithAlpha()` builds an `rgba()` **string per
point**. It is measurable but small (~0.3 ms) and it buys the filter fade. If you
need the last millisecond, bucket the loop by (method × matched) and set
`fillStyle` five times instead of 6,336.

### 2.7 Nothing composites over the canvas while it moves

The four overlays are static DOM that does not re-render during interaction. The
fan SVGs — with `mask-image` and `clip-path`, both expensive to repaint — sit
*below* the field box, and the field box carries:

```css
overflow: hidden;
contain: paint;      /* canvas invalidation cannot force the masked SVGs to repaint */
```

No `backdrop-filter`, no `filter`, no `mix-blend-mode` anywhere over the canvas.
A single `backdrop-filter` above a moving canvas can cost more than the entire
draw.

---

## 3. WHAT IS ALLOWED TO BE SLOW

Not everything needs the budget, and pretending otherwise wastes effort:

- **First data load and bucketing** — once, ~30 ms, behind the streaming layout.
- **`orbitScales()` / `yearScale()` domain scans** — once per dataset, cached.
- **`skyPositions()`** — once, cached, and deliberately kept separate from the
  2D caches.
- **FIND result computation** — memoised on
  `methodFilter | query | requirements | sort`, so typing recomputes once per
  keystroke over at most 6,336 rows, and panning never recomputes it.
- **`verifySkyTransform()` / `auditSky3D()`** — console-only, never on a frame.

---

## 4. PROFILING — in this order

```js
// 1. Is React in the loop?
//    Instrument the component's render, then drag for 2 seconds.
//    Expected: 0 renders while dragging, 1 per hover-index change.

// 2. How expensive is one draw?
performance.mark('a'); drawField(); performance.mark('b');
performance.measure('draw','a','b');   // must be < 4 ms

// 3. Is the backing store sane?
canvas.width / canvas.clientWidth      // must be <= 2

// 4. Is the projection per-frame?
//    Counter inside computePositions / projectSky. Dragging must not increment
//    it at all in a 2D projection, and at most once per event in SPATIAL.

// 5. Allocation
//    Performance panel, 5 s drag: the JS heap must be flat, not a sawtooth.

// 6. Paint
//    Rendering panel -> "Paint flashing". Only the canvas may flash while
//    dragging. If the fan or a rail flashes, contain:paint is missing.
```

---

## 5. IF `drawField` IS FAST BUT THE DRAG STILL LAGS

In descending order of likelihood:

1. **`setState` on `mousemove`** — §2.1. By far the most common cause.
2. **A permanently running rAF** competing with the pointer stream — §2.2.
3. **The canvas is CSS-scaled rather than DPR-sized** — the browser resamples
   every frame. `canvas.width` must be `clientWidth × dpr`, not equal to
   `clientWidth`.
4. **A compositor fight above the canvas** — `backdrop-filter`, `filter`,
   `mix-blend-mode`, or a large `box-shadow` on an ancestor. Also a missing
   `contain: paint`, which lets canvas invalidation dirty the masked fan SVGs.
5. **Passive wheel listener** — the browser waits to see whether you will
   `preventDefault()`, then scroll-chains. Bind non-passive, on the canvas only
   (see `FIX.md` #6).
6. **Hit-testing on every raw pointer event** while also dragging — during a drag
   the hover scan should be skipped entirely; you are not hovering, you are
   panning.
7. **The height chain is broken** so the canvas is enormous — a content-driven
   row can make the field several thousand pixels tall, and the fill cost scales
   with area. This is `FIX.md` Contract A wearing a performance mask; check
   `canvas.clientHeight` before optimising anything else.

---

## 6. IF YOU EVER NEED MORE HEADROOM

Not needed at 6,336 records, in rough order of payoff-to-risk:

1. **Bucket the draw loop** by (method × matched) → 5–10 `fillStyle` assignments
   instead of one per point (§2.6).
2. **`ctx.fillRect` for 2 px dots** instead of `arc` — at this size the visual
   difference is nil and rects are markedly cheaper. Keep `arc` for marked
   records.
3. **Two canvases**: a static cloud layer redrawn only when layout/filter/view
   changes, and a small overlay layer for hover, selection and the target cursor.
   Hover then costs one tiny clear instead of a full redraw.
4. **Quadtree or a uniform grid for hit-testing** — only worth it past ~50k
   points; the linear scan is 0.3 ms today.
5. **WebGL / instanced points** — the honest answer past ~200k. It costs the
   canvas HUD's simplicity, so it is a last resort, not an upgrade.

**Do not** reach for any of these before §4 says where the time actually goes.
Every one of them adds a way for the picture to be wrong, and a wrong picture in
this project is worse than a slow one.
