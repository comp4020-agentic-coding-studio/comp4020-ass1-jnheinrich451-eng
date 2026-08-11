// LOAD_DATA.md §7 — the render pass. One canvas, ordered.
//
// This file draws; data.ts decides where. Keeping the split means the
// transforms are testable without a canvas, and it is why spec/data.test.ts can
// assert §5's contract in CI where no browser exists.

import {
  BUCKETS,
  BUCKET_COLOUR,
  C,
  type Archive,
  type Camera,
  type Extent,
  type Pos,
  type Projection,
  type Row,
  auditSky3D,
  extentsOf,
  fitCameraDist,
  loadArchive,
  missingFor,
  positionOf,
  verifySkyTransform,
} from "./data";
import { type Env, approach, drawAxes, solArrowAt } from "./axes";
import { initPanels } from "./panels";
import {
  HIT,
  MS,
  type View,
  clampView,
  easeInOut,
  mapping,
  reduceMotion,
  resetView,
  viewFor,
  zoomAt,
} from "./nav";
import { initTarget, renderTarget, setCentreTarget, setFieldSnapshotter } from "./target";
import { inPool, state, subscribe } from "./store";

const PROJECTIONS: { id: Projection; label: string; axes: string }[] = [
  {
    id: "orbit",
    label: "Orbit × Size",
    axes: "X: Orbital period [d]   Y: Radius [R⊕]",
  },
  {
    id: "distance",
    label: "Earth Distance",
    axes: "Origin: Sol   R: Log distance [pc]   Angle: Display distribution",
  },
  {
    id: "time",
    label: "Discovery Time",
    axes: "T: Discovery year   Y: Display distribution",
  },
  {
    id: "spatial",
    label: "Spatial // RA + Dec",
    axes: "Origin: Sol   Direction: RA + Dec   R: Log distance [pc]",
  },
];

export function initField(): void {
  const box = document.querySelector<HTMLElement>(".field-box");
  const canvas = document.querySelector<HTMLCanvasElement>("#field-canvas");
  if (!box || !canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let archive: Archive | null = null;
  let ext: Extent | null = null;
  const projectionOf = (): Projection => state.projection;
  // Distance is derived from the archive at load (see fitCameraDist), not
  // guessed: at the 2.75 the holding-cloud formula references, the eye sits
  // deep INSIDE a cloud whose radius runs to 9.05, so a third of the archive
  // was behind the camera.
  const cam: Camera = { yaw: 0.6, pitch: 0.35, dist: 2.75 };

  // §8 morphs from the CURRENTLY DRAWN positions, not from the previous
  // projection's targets — that is what stops rapid switching teleporting or
  // duplicating a record. So the drawn state is kept, not recomputed.
  let drawn: Pos[] = [];
  let target: Pos[] = [];
  let morphStart = 0;
  let morphing = false;
  const MORPH_MS = MS.morph; // INTERACTION.md §3

  // §4: the fit rect widens to 1.26 ONLY when a projection actually has
  // unresolved records, so a complete projection is not squeezed to leave room
  // for a cloud that is not there.
  let fitRight = 1;
  // The fit rect the morph STARTS from. fitRight widens to 1.26 only when a
  // projection has unresolved records, and DISCOVERY TIME is the only one with
  // none — so switching to or from it changed the divisor in the mapping, and
  // every point's screen x rescaled in a single frame BEFORE the tween began.
  // Interpolated on the morph's own clock, so the rect and the points move
  // together. That was necessary and NOT sufficient — the clamp that reads the
  // rect had to move with it too, which is the note in paint().
  let fitFrom = 1;

  /** The fit rect ACTUALLY ON SCREEN this instant, interpolated on the morph's
   *  own clock. Everything that maps normalised space to pixels — the draw, the
   *  hit test, the drag, the wheel, the dive — must read this and not
   *  `fitRight`, or it computes against a rect the user is not looking at. */
  function fitLive(): number {
    if (!morphing) return fitRight;
    const p = Math.min(1, (performance.now() - morphStart) / MORPH_MS);
    return fitFrom + (fitRight - fitFrom) * easeInOut(p);
  }

  // LOAD_DATA.md §9 / LEFT-OBSERVE.md §4: a filter change is ANIMATED, not
  // switched. Radius and alpha interpolate between the previous filter's
  // targets and the new ones on one clock, so the excluded population dims in
  // place. No record is ever removed from the draw loop.
  // CONTRACT C: never early-return on the handle; early-return only when the
  // tween set is empty. `pending` is that set, and one loop advances all of it.
  let rafId = 0;
  const pending = new Set<string>();
  /** Coalesce input-driven repaints onto the next frame. Painting straight from
   *  a pointermove handler means several full repaints per displayed frame —
   *  the work is thrown away and the input queue backs up, which is what a drag
   *  feels like when it lags. */
  let queued = false;
  function schedulePaint(): void {
    if (queued || rafId) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
      // An input-driven paint may have left tweens pending (the envelope moves
      // whenever the view does), so hand over to the driver — from OUTSIDE
      // paint, which is the distinction that matters.
      if (pending.size) drive();
    });
  }

  function drive(): void {
    if (rafId) return; // a loop is already running — do NOT start a second
    const tick = (): void => {
      // rafId stays SET across paint(). It used to be cleared first, which made
      // drive()'s guard see a falsy handle when paint() re-entered it — so each
      // frame scheduled one callback from inside paint and another from this
      // tail, and the count doubled every frame. Measured: 5,067 callbacks
      // scheduled against 20 real frames, each one a full 6,336-point repaint.
      paint();
      if (pending.size) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };
    rafId = requestAnimationFrame(tick);
  }

  // FIX.md #7a: 420ms easeInOut, one clock for both directions.
  const FILTER_MS = 420;
  let ftStart = 0;
  let prevIn: boolean[] = [];
  let nowIn: boolean[] = [];
  // §2.4: allocated once and reused, so the draw loop creates no garbage. A
  // sawtooth heap shows up as periodic hitches rather than steady slowness.
  let methodIdx: Int32Array = new Int32Array(0);
  const groups: {
    colour: string;
    wasIn: number;
    isIn: number;
    resolved: boolean;
    xs: Float64Array;
    ys: Float64Array;
    n: number;
  }[] = [];

  // AXES.md §3: the envelope is approached exponentially, never snapped.
  let env: Env | null = null;
  let envSettled = true;
  let lastFrame = 0;

  function sizeCanvas(): { w: number; h: number } {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // §7 step 1
    const w = box!.clientWidth;
    const h = box!.clientHeight;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    // Assigning canvas.width ALWAYS reallocates and clears the backing store,
    // even when the value is unchanged — so doing it unconditionally meant a
    // fresh 1352x925 surface every frame of every drag. Only touch it when the
    // size actually changed; the transform still has to be reset because the
    // reallocation is what used to reset it.
    if (canvas!.width !== bw || canvas!.height !== bh) {
      canvas!.width = bw;
      canvas!.height = bh;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
    }
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  // EFFECT.md §1.3 — warming. Law III: nothing is computed on frame 0. The
  // destination positions used to be built synchronously inside the click, so
  // the first frame of a 900ms tween did ~25ms of layout work exactly where the
  // eye is most sensitive, and read as "lag and stuck".
  //
  // Each 2D projection's positions are a pure function of the archive and its
  // extents, so they are computed ONCE PER LAYOUT, EVER, and cached. SPATIAL is
  // excluded: it depends on the camera, so it is recomputed when the camera
  // moves and cached only for the current camera.
  const layoutCache = new Map<Projection, Pos[]>();

  function buildLayout(p: Projection): Pos[] {
    return archive!.rows.map((r) => positionOf(r, p, ext!, cam));
  }

  /** Compute a projection's destination positions if they are cold. */
  function warm(p: Projection): void {
    if (!archive || !ext) return;
    if (p === "spatial") return; // camera-dependent; see syncSpatial below
    if (!layoutCache.has(p)) layoutCache.set(p, buildLayout(p));
  }

  const idle = (fn: () => void): void => {
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void })
      .requestIdleCallback;
    if (ric) ric(fn);
    else window.setTimeout(fn, 0);
  };

  function computeTargets(): void {
    if (!archive || !ext) return;
    const p = projectionOf();
    if (p === "spatial") {
      target = buildLayout(p); // the camera decides it, so it is never cached
    } else {
      warm(p);
      target = layoutCache.get(p)!;
    }
    fitRight = target.some((q) => !q.resolved) ? 1.26 : 1;
  }

  function paint(): void {
    if (!archive || !ext) return;
    const { w, h } = sizeCanvas();
    ctx!.clearRect(0, 0, w, h);
    if (w < 2 || h < 2) return;

    // Normalised space maps into the box with the fit rect, so the holding
    // cloud at x≈1.15 is visible without moving the scientific 0–1 region.
    const pad = 26;
    const view = viewFor(projectionOf(), fitRight);
    // §4: interpolate the MAPPING too. Switching the fit rect at morph start
    // made the field jump before any point had moved.
    const p = morphing
      ? Math.min(1, (performance.now() - morphStart) / MORPH_MS)
      : 1;
    const e = p < 1 ? easeInOut(p) : 1;

    let probeSum = 0;
    let probeN = 0;
    const fitNow = fitLive();
    // THE CLAMP MOVES WITH THE RECT.
    //
    // Interpolating the rect alone was not enough, and the author was right
    // that the align-to-centre survived it. #7b clamps the view into the new
    // rect on the projection change, and at zoom 1 clampView pins cx to exactly
    // fitRight/2 — so switching to DISCOVERY TIME, the only projection with no
    // unresolved records and therefore the only one whose rect is 1 rather than
    // 1.26, moved cx from 0.63 to 0.5 in a single frame BEFORE the tween began.
    // The cloud snapped to the centre, then slid. That is the whole effect: the
    // rect was interpolated, the centre it was measured from was not.
    //
    // Clamping here, against the LIVE rect, keeps #7b's meaning exactly — it is
    // still a clamp, never an interpolation toward the new centre — while
    // making the correction land over the same 900 ms the rect takes. The other
    // three projections share a rect, so their clamp is a no-op and they were
    // always smooth; that is why this was exclusive to DISCOVERY TIME, and why
    // the author's "look at how the other three transit to each other" was the
    // right place to look.
    // ONLY WHILE MORPHING. Unconditionally was a regression, and an obvious one
    // in hindsight: at zoom 1 clampView pins cx to exactly fitNow/2, so running
    // it every frame nailed the view to the centre and killed the pan entirely.
    // Zoom and rotate survived because above zoom 1 the clamp has a range to
    // move inside, which is exactly the shape of the author's report.
    //
    // The clamp is a projection-change correction, so it belongs to the
    // projection change. Bounding a free pan is a different decision and is not
    // one this fix gets to make on the way past.
    if (morphing) clampView(view, fitNow);
    const map = mapping(view, w, h, pad, fitNow);
    const sx = map.sx;
    const sy = map.sy;

    // A MARKER, not a feature (CLAUDE.md §6). The transition bug survived one
    // fix because the only instrument available was a pixel centroid, and that
    // number moves when the HUD furniture changes as well as when the cloud
    // does — so it could not say WHICH had jumped. This publishes the mapping
    // itself, so a probe can read the frame the user is actually looking at.
    // DEV only: it never reaches the deployed bundle.


    // §7 step 2 — furniture UNDER the points.
    // No bounding box. It was drawn from the envelope, so it tracked the cloud
    // and read as a second frame inside the field box — AXES.md §7's own
    // argument against a closed rect applies to it exactly. The corner brackets
    // carry the same job without enclosing anything.
    ctx!.strokeStyle = "rgba(150,170,255,0.12)";
    ctx!.lineWidth = 1;
    if (fitRight > 1) {
      // PROJECTIONS.md §7: dashed [2,5] at 0.18. Solid would read as a plot
      // boundary; dashed reads as the edge of a PLACE, which is what it is —
      // records live here, they have not escaped from anywhere.
      ctx!.save();
      ctx!.strokeStyle = "rgba(150,170,255,0.18)";
      ctx!.setLineDash([2, 5]);
      ctx!.beginPath();
      ctx!.ellipse(
        sx(1.15),
        sy(0.5),
        Math.abs(sx(0.072) - sx(0)),
        Math.abs(sy(0.15) - sy(0)),
        0,
        0,
        Math.PI * 2,
      );
      ctx!.stroke();
      ctx!.restore();
    }

    // §7 step 3 — every row.
    //
    // PERFORMANCE.md §2.6 and §6, written after measuring 115ms a frame here.
    // The cost was never the NUMBER of points, it was the per-point canvas
    // state: the old loop set fillStyle and globalAlpha and built a fresh arc
    // path 6,336 times a frame. Every fillStyle assignment parses a colour
    // string; every beginPath/arc/fill allocates and rasterises its own path.
    //
    // Three changes, all from the document:
    //   §2.6  cull first — off-screen points cost nothing
    //   §6.1  bucket the loop — ~20 state changes a frame instead of 12,672
    //   §6.2  fillRect for the dots — at 2px the visual difference is nil and
    //         rects are markedly cheaper than arcs
    const zg = 1; // zoom gain; wheel zoom is not wired yet
    const ft = Math.min(1, (performance.now() - ftStart) / FILTER_MS);
    const fe = easeInOut(ft);

    // Buckets are (method x wasIn x isIn), so every point in a bucket shares
    // one radius and one alpha for the whole frame — including mid-transition,
    // where a point is genuinely between the two filter states. Reused across
    // frames, so the draw loop allocates nothing (§2.4).
    for (const g of groups) g.n = 0;
    for (let i = 0; i < archive.rows.length; i++) {
      const to = target[i];
      if (!to || to.behind) continue;
      const from = drawn[i] ?? to;
      const x = sx(from.x + (to.x - from.x) * e);
      const y = sy(from.y + (to.y - from.y) * e);
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue; // §2.6
      const g =
        groups[
          methodIdx[i] * 8 +
            (prevIn[i] === false ? 4 : 0) +
            (nowIn[i] === false ? 2 : 0) +
            (to.resolved ? 0 : 1)
        ];
      if (import.meta.env.DEV) {
        probeSum += x;
        probeN++;
      }
      g.xs[g.n] = x;
      g.ys[g.n] = y;
      g.n++;
    }

    for (const g of groups) {
      if (!g.n) continue;
      // One interpolated weight for the whole bucket, set once.
      const weight = g.wasIn + (g.isIn - g.wasIn) * fe;
      // Unresolved records keep their dimmer, smaller treatment: §2 draws them
      // but must not let the holding cloud read as a dense cluster of findings.
      const r = (g.resolved ? 1.2 + 0.8 * weight : 1.0 + 0.2 * weight) * zg;
      ctx!.globalAlpha = g.resolved ? 0.1 + 0.7 * weight : 0.1 + 0.25 * weight;
      ctx!.fillStyle = g.colour;
      const d = r * 2;
      for (let k = 0; k < g.n; k++) {
        ctx!.fillRect(g.xs[k] - r, g.ys[k] - r, d, d);
      }
    }
    ctx!.globalAlpha = 1;

    if (import.meta.env.DEV) {
      (window as unknown as { __field?: unknown }).__field = {
        fitNow,
        fitFrom,
        fitRight,
        cx: view.cx,
        cy: view.cy,
        zoom: view.zoom,
        e,
        morphing,
        // where normalised x=0 and x=1 actually land this frame
        x0: sx(0),
        x1: sx(1),
        // the CLOUD alone, in pixels — no HUD, no furniture, no tapes
        cloud: probeN ? probeSum / probeN : 0,
        n: probeN,
      };
    }

    // §7 step 5: marked records are held back and painted LAST. In a dense
    // region the selected point was being overpainted by every later index —
    // exactly where CENTER TARGET sends you.
    for (const [i, kind] of [
      [state.previewIdx, "hover"] as const,
      [state.selectedIdx, "sel"] as const,
    ]) {
      if (i === null) continue;
      const t = target[i];
      if (!t || t.behind) continue;
      const x = sx(t.x);
      const y = sy(t.y);
      const r = kind === "sel" ? 3.8 : 3.2;
      ctx!.fillStyle = "rgba(3,4,10,0.82)";
      ctx!.beginPath();
      ctx!.arc(x, y, r + (kind === "sel" ? 15 : 7), 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle =
        BUCKET_COLOUR[archive.bucketOf[archive.rows[i][C.method] as number]];
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.strokeStyle = kind === "sel" ? "#fff" : ctx!.fillStyle;
      ctx!.lineWidth = kind === "sel" ? 1.3 : 1;
      ctx!.beginPath();
      ctx!.arc(x, y, r + (kind === "sel" ? 6 : 5), 0, Math.PI * 2);
      ctx!.stroke();
      if (kind === "sel") {
        ctx!.strokeStyle = "rgba(255,255,255,.32)";
        ctx!.beginPath();
        ctx!.arc(x, y, r + 13, 0, Math.PI * 2);
        ctx!.stroke();
      }
    }

    // §7 step 4 — the HUD tapes, after the points.
    // FIELD.md §2: the reserves are MEASURED from the overlays' live geometry
    // every frame. They change height with content and viewport (the NAV hint
    // wraps on a narrow field), and hard-coding either prints tick labels over
    // the text — "the one thing that must not be a magic number".
    const panel = box!.querySelector<HTMLElement>(".field-projection");
    const caption = box!.querySelector<HTMLElement>(".field-caption");
    const topReserve = panel ? panel.offsetTop + panel.offsetHeight + 10 : 145;
    const bottomReserve = caption ? caption.offsetTop - 26 : h - 26;

    // The envelope's target is the bounding box of the visible RESOLVED points.
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < target.length; i++) {
      const t = target[i];
      if (!t || t.behind || !t.resolved) continue;
      if (!(nowIn[i] ?? true)) continue;
      const px = sx(t.x);
      const py = sy(t.y);
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
    }
    if (Number.isFinite(x0)) {
      const wanted: Env = { x0, y0, x1, y1 };
      const now = performance.now();
      const dt = Math.min(0.05, lastFrame ? (now - lastFrame) / 1000 : 0.016);
      lastFrame = now;
      if (env) {
        const r = approach(env, wanted, dt);
        env = r.env;
        envSettled = r.settled;
      } else {
        env = wanted;
        envSettled = true;
      }
      // §9: the tapes are alpha-mixed on the morph clock rather than switched —
      // source out over the first 35%, destination in over the last 35%, so the
      // POINTS own the middle of the move.
      const axisAlpha = morphing ? Math.max(0, (p - 0.65) / 0.35) : 1;

      // PROJECTIONS.md's per-projection furniture. All three are derived here
      // rather than inside axes.ts, because axes.ts must not reach into the
      // archive — its whole guarantee is that it only ever asks the MAPPING
      // where something goes (§1).
      const curIdx = state.selectedIdx ?? state.previewIdx;
      const curRow = curIdx !== null ? archive.rows[curIdx] : null;
      const curYear = curRow && typeof curRow[C.year] === "number"
        ? (curRow[C.year] as number)
        : null;
      const unresolvedNow = target.reduce((n, q) => (q && !q.resolved ? n + 1 : n), 0);
      const extras = {
        cam: projectionOf() === "spatial" ? cam : null,
        cursor:
          curYear !== null
            ? { year: curYear, locked: state.selectedIdx !== null }
            : null,
        // §7's first line names the field that is actually absent, taken from
        // the same missingFor() that decided the record was unresolved. A
        // generic "no data" would throw away the only interesting part.
        cloud:
          unresolvedNow > 0 && archive.rows.length
            ? {
                label:
                  missingFor(
                    archive.rows.find((r, i) => target[i] && !target[i].resolved) ??
                      archive.rows[0],
                    projectionOf(),
                  )[0] ?? "unresolved",
                count: unresolvedNow,
              }
            : null,
      };
      drawAxes(
        ctx!,
        {
          sx,
          sy,
          inv: { x: map.ix, y: map.iy },
          w,
          h,
          topReserve,
          bottomReserve,
          narrow: w < 640,
        },
        env,
        projectionOf(),
        ext,
        axisAlpha,
        extras,
      );
    }

    // CONTRACT C: report what is still pending; the driver owns the rAF.
    if (p < 1) pending.add("morph");
    else pending.delete("morph");
    if (ft < 1) pending.add("filter");
    else pending.delete("filter");
    if (envSettled) pending.delete("envelope");
    else pending.add("envelope");
    // paint() does NOT schedule. Re-entering the driver from inside the thing
    // the driver called is what created the runaway; the tail of tick() is the
    // one place a frame is queued.

    // The morph has landed: adopt the destination as the new drawn state, so
    // the next morph retargets from where these points actually are (§4).
    if (p >= 1 && morphing) {
      morphing = false;
      drawn = target.map((t) => ({ ...t }));
      fitFrom = fitRight;
    }
  }

  function setProjection(next: Projection): void {
    if (next === projectionOf()) return;
    // Freeze what is on screen right now as the morph's origin (§8) — both the
    // positions AND the rect they are being drawn through.
    // Both of these were reading the DESTINATION, not the screen. Mid-morph
    // `target` is where the points are going and `fitRight` is the rect they
    // are going into, so switching projections during a morph restarted from a
    // state that had never been drawn — the comment above already claimed
    // "currently drawn", and the code did not do it.
    const me = morphing
      ? easeInOut(Math.min(1, (performance.now() - morphStart) / MORPH_MS))
      : 1;
    fitFrom = fitLive();
    drawn = target.map((t, i) => {
      const f = drawn[i] ?? t;
      return { ...t, x: f.x + (t.x - f.x) * me, y: f.y + (t.y - f.y) * me };
    });
    state.projection = next;
    computeTargets();
    if (drawn.length && !reduceMotion()) {
      morphing = true;
      morphStart = performance.now();
      pending.add("morph");
    } else {
      drawn = target.map((t) => ({ ...t }));
    }
    // #7b's clamp now lives in paint(), against the live rect — see the note
    // there. Clamping to the destination rect here is what produced the jump.
    syncChrome();
    renderTarget(); // §4's note names the CURRENT projection, so it must follow
    drive();
  }

  function syncChrome(): void {
    const meta = PROJECTIONS.find((x) => x.id === projectionOf());
    if (!meta || !archive) return;
    for (const [i, b] of Array.from(
      document.querySelectorAll<HTMLButtonElement>(".field-projection .pick"),
    ).entries()) {
      b.classList.toggle("is-active", PROJECTIONS[i]?.id === projectionOf());
    }
    // VISIBLE counts records with the data this projection needs; UNRESOLVED
    // counts those without it. A record behind the camera is neither missing
    // nor mis-measured, so it never lands in the UNRESOLVED tally.
    const visible = target.filter((t) => t.resolved).length;
    const unresolved = target.length - visible;
    const n = (v: number): string => v.toLocaleString("en-AU");
    const set = (sel: string, text: string): void => {
      const el = document.querySelector(sel);
      if (el) el.textContent = text;
    };
    // FIELD.md §2c: sentence case, and it names the filter when one is on —
    // it is the author speaking, not the instrument.
    const arc = archive;
    const inPoolCount = arc.rows.filter((r) => inPool(arc, r)).length;
    set(
      ".field-caption",
      state.methodFilter === "all"
        ? `${n(archive.rows.length)} confirmed worlds`
        : `${n(inPoolCount)} of ${n(archive.rows.length)} found by ${state.methodFilter}`,
    );
    set(".strip-header .dim", `${n(archive.rows.length)} confirmed worlds`);
    set("#footer-view", `${meta.label}`);
    set("#footer-axes", meta.axes);
    set("#footer-visible", n(visible));
    // §5 rule 2: an absent value is UNRESOLVED, never 0 and never hidden.
    set("#footer-unresolved", unresolved === 0 ? "None" : n(unresolved));
  }

  // ---- INTERACTION.md §1's grammar -----------------------------------------
  // findNearest RESPECTS THE METHOD FILTER: a dimmed record cannot be picked by
  // accident. "What you cannot see, you cannot hit."
  function nearest(px: number, py: number, radius: number): number | null {
    if (!archive || !box) return null;
    const { clientWidth: w, clientHeight: h } = box;
    const f = fitLive();
    const map = mapping(viewFor(projectionOf(), f), w, h, 26, f);
    let best: number | null = null;
    let bestD = radius * radius;
    for (let i = 0; i < target.length; i++) {
      const t = target[i];
      if (!t || t.behind) continue;
      if (!(nowIn[i] ?? true)) continue; // the filter, enforced at the hit test
      const dx = map.sx(t.x) - px;
      const dy = map.sy(t.y) - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  let dragging = false;
  let dragMoved = false;
  let dragButton = 0;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragMoved = false;
    dragButton = e.button;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    if (!dragging) {
      // §1: hover PREVIEWS. It writes previewIdx — the same field a FIND row
      // hover writes, so the two can never disagree about what is previewed.
      const hit = nearest(e.clientX - r.left, e.clientY - r.top, HIT.hover);
      if (hit !== state.previewIdx) {
        state.previewIdx = hit;
        renderTarget();
        schedulePaint();
      }
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    // §1: a drag exceeding 3px swallows the click that follows. Panning can
    // never select.
    if (Math.hypot(e.clientX - lastX, e.clientY - lastY) > 0)
      dragMoved = dragMoved || Math.hypot(dx, dy) > 3;
    lastX = e.clientX;
    lastY = e.clientY;
    const view = viewFor(projectionOf(), fitLive());
    if (dragButton === 2 && projectionOf() === "spatial") {
      // §2: RIGHT = ROTATE, and only where an orientation exists. The verb that
      // costs the most is the one you must ask for.
      cam.yaw -= dx * 0.006;
      cam.pitch = Math.min(1.45, Math.max(-1.45, cam.pitch + dy * 0.006));
      computeTargets();
    } else if (box) {
      // §2: LEFT = TRANSLATE, in every projection, so muscle memory carries.
      view.cx -= (dx / (box.clientWidth - 52)) * (fitLive() / view.zoom);
      view.cy -= dy / (box.clientHeight - 52) / view.zoom;
    }
    schedulePaint();
  });

  const endDrag = (): void => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", (e) => {
    endDrag();
    if (dragMoved) return; // the swallowed click
    const r = canvas.getBoundingClientRect();
    // §1: click LOCKS. Outside the radius it clears, rather than keeping a
    // selection the user has just aimed away from.
    // §5.3: the chevron is a 32x32 hit area, and it is checked BEFORE the
    // records — it sits on the box edge where no point can be, and a click that
    // recentred the origin must not also select whatever was underneath.
    const arrow = solArrowAt();
    if (arrow) {
      const ax = e.clientX - r.left;
      const ay = e.clientY - r.top;
      if (Math.abs(ax - arrow.x) <= 16 && Math.abs(ay - arrow.y) <= 16) {
        recentreOnSol();
        return;
      }
    }
    state.selectedIdx = nearest(e.clientX - r.left, e.clientY - r.top, HIT.click);
    state.previewIdx = null;
    renderTarget();
    schedulePaint();
  });
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    endDrag();
    if (state.previewIdx !== null) {
      state.previewIdx = null;
      renderTarget();
      schedulePaint();
    }
  });

  // §2: contextmenu is prevented in SPATIAL and NOWHERE ELSE — the browser menu
  // stays available in every other projection and over every rail.
  canvas.addEventListener("contextmenu", (e) => {
    if (projectionOf() === "spatial") e.preventDefault();
  });

  // §2: bound with {passive:false} on the CANVAS, never the window — the page
  // must still scroll everywhere else.
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      if (projectionOf() === "spatial") {
        cam.dist = Math.min(60, Math.max(1.25, cam.dist * Math.exp(e.deltaY * 0.0012)));
        computeTargets();
      } else if (box) {
        zoomAt(
          viewFor(projectionOf(), fitLive()),
          e.deltaY,
          e.clientX - r.left,
          e.clientY - r.top,
          box.clientWidth,
          box.clientHeight,
          26,
          fitLive(),
        );
      }
      schedulePaint();
    },
    { passive: false },
  );

  /** §5.3: click the chevron and the origin comes back — 420 ms easeInOut,
   *  ZOOM UNCHANGED. Recentring that also zoomed would be answering a question
   *  the user did not ask. */
  function recentreOnSol(): void {
    const view = viewFor(projectionOf(), fitLive());
    const from = { cx: view.cx, cy: view.cy };
    if (reduceMotion()) {
      view.cx = 0.5;
      view.cy = 0.5;
      schedulePaint();
      return;
    }
    const t0 = performance.now();
    const step = (): void => {
      const q = Math.min(1, (performance.now() - t0) / 420);
      const e2 = easeInOut(q);
      view.cx = from.cx + (0.5 - from.cx) * e2;
      view.cy = from.cy + (0.5 - from.cy) * e2;
      schedulePaint();
      if (q < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // §5: CENTER TARGET moves the VIEW, never the point, and stops at a moderate
  // zoom so the record keeps its neighbourhood — a target alone in an empty
  // frame tells you nothing about where it sits.
  function centreTarget(): void {
    const i = state.selectedIdx;
    if (i === null) return;
    const t = target[i];
    if (!t || !t.resolved) return;
    const view = viewFor(projectionOf(), fitLive());
    const from = { ...view };
    const to: View = {
      cx: t.x,
      cy: t.y,
      zoom: Math.min(3.2, Math.max(2.4, view.zoom)),
    };
    if (reduceMotion()) {
      Object.assign(view, to); // §8: skip, not shorten
      schedulePaint();
      return;
    }
    const t0 = performance.now();
    const step = (): void => {
      const p = Math.min(1, (performance.now() - t0) / MS.centre);
      const e = easeInOut(p);
      view.cx = from.cx + (to.cx - from.cx) * e;
      view.cy = from.cy + (to.cy - from.cy) * e;
      view.zoom = from.zoom + (to.zoom - from.zoom) * e;
      schedulePaint();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  setCentreTarget(centreTarget);

  // FIELD.md §5 and §4 — the two footer controls that change reading, not data.
  document.querySelector("#ground-toggle")?.addEventListener("click", (e) => {
    const on = document.body.classList.toggle("ground-clear");
    const b = e.currentTarget as HTMLElement;
    b.textContent = on ? "Clear" : "Solid";
    schedulePaint();
  });
  document.querySelector("#expand-field")?.addEventListener("click", (e) => {
    const expanded = document.body.classList.toggle("focus-mode");
    // FIELD.md line 141: the label states the state, not the action taken to
    // reach it — EXPAND FIELD while fitted, FIT FIELD once expanded. A control
    // that reads the same in both states cannot tell you which one you are in.
    (e.currentTarget as HTMLElement).textContent = expanded ? "Fit field" : "Expand field";
    // FIELD.md §4: the canvas resizes after the layout commits and the HUD
    // reserves are measured from the DOM, so redraw once it has settled.
    for (const d of [0, 40, 160]) window.setTimeout(paint, d);
  });
  document.querySelector("#fit-field")?.addEventListener("click", () => {
    resetView(projectionOf(), fitRight);
    schedulePaint();
  });

  document
    .querySelectorAll<HTMLButtonElement>(".field-projection .pick")
    .forEach((b, i) => {
      // §1.3: the cursor's ~200ms travel to the button is the compute window,
      // and it is free.
      b.addEventListener("pointerenter", () => {
        const next = PROJECTIONS[i];
        if (next) idle(() => warm(next.id));
      });
      b.addEventListener("click", () => {
        const next = PROJECTIONS[i];
        if (!next) return;
        // Last chance: compute synchronously if still cold, so the work lands in
        // the click rather than in the first frame of the tween.
        warm(next.id);
        setProjection(next.id);
      });
    });

  window.addEventListener("resize", paint);

  void loadArchive()
    .then((a) => {
      archive = a;
      ext = extentsOf(a.rows);
      cam.dist = fitCameraDist(ext.dist[1]);
      // §1.3: the default and DISCOVERY TIME are warmed at load, the rest in
      // idle time once the first paint is out of the way.
      warm("orbit");
      warm("time");
      idle(() => warm("distance"));
      prevIn = a.rows.map(() => true);
      nowIn = a.rows.map((r) => inPool(a, r));
      methodIdx = Int32Array.from(a.rows, (r) =>
        BUCKETS.indexOf(a.bucketOf[r[C.method] as number]),
      );
      for (const b of BUCKETS) {
        for (const wasIn of [1, 0]) {
          for (const isIn of [1, 0]) {
            for (const resolved of [true, false]) {
            groups.push({
              colour: BUCKET_COLOUR[b],
              wasIn,
              isIn,
              resolved,
              xs: new Float64Array(a.rows.length),
              ys: new Float64Array(a.rows.length),
              n: 0,
            });
            }
          }
        }
      }
      ftStart = performance.now() - FILTER_MS;
      computeTargets();
      drawn = target.map((t) => ({ ...t }));
      initPanels(a);
      initTarget(a);
      // OPEN-SYSTEM.md §1: save { layout, cx, cy, zoom } before the dive and
      // replay it at 720ms behind the veil, so RETURN lands on exactly the
      // frame the user left. Pan and zoom are not wired yet (INTERACTION.md
      // owns them), so today the snapshot carries the projection and the
      // envelope — the two things that would otherwise be re-derived on the way
      // back and land the user somewhere new.
      setFieldSnapshotter(() => {
        // FIX.md #4: the dive happens IN THE FIELD, and it must be visible.
        // Save { cx, cy, zoom } before anything moves, tween into the point at
        // zoom x11 over 720ms accelerating, and hand the same saved view back
        // on the way out as a decelerating surfacing tween.
        const view = viewFor(projectionOf(), fitLive());
        const saved = { ...view, projection: projectionOf() };
        const i = state.selectedIdx;
        const pt = i !== null ? target[i] : null;
        const runTween = (to: View, ms: number, accel: boolean): void => {
          const from = { ...view };
          const t0 = performance.now();
          const step = (): void => {
            const p = Math.min(1, (performance.now() - t0) / ms);
            // Accelerating in reads as gravity; decelerating out reads as
            // surfacing. Neither is the symmetric easeInOut used elsewhere.
            const e = accel ? p * p * p : 1 - (1 - p) ** 3;
            view.cx = from.cx + (to.cx - from.cx) * e;
            view.cy = from.cy + (to.cy - from.cy) * e;
            view.zoom = from.zoom + (to.zoom - from.zoom) * e;
            paint();
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        };
        if (pt && !pt.behind && !reduceMotion()) {
          runTween({ cx: pt.x, cy: pt.y, zoom: view.zoom * 11 }, MS.dive, true);
        }
        return {
          restore: () => {
            state.projection = saved.projection;
            computeTargets();
            syncChrome();
            if (reduceMotion()) {
              Object.assign(view, { cx: saved.cx, cy: saved.cy, zoom: saved.zoom });
              paint();
              return;
            }
            runTween({ cx: saved.cx, cy: saved.cy, zoom: saved.zoom }, 620, false);
          },
        };
      });
      subscribe(() => {
        // A filter change starts the transition from wherever the last one got
        // to, so rapid clicking never snaps.
        // #7a: retarget from the CURRENT values so rapid filter clicks do not
        // pop, and no record leaves the draw loop at any point — this is a dim,
        // not a removal.
        prevIn = nowIn;
        nowIn = a.rows.map((r) => inPool(a, r));
        ftStart = performance.now();
        pending.add("filter");
        syncChrome();
        renderTarget();
        drive();
      });
      syncChrome();
      paint();

      // §5: "Keep them: they are the contract." They also run in spec/, which
      // is where a failure actually stops a push — this pair is for a human
      // looking at the console on the deployed page.
      const checks = verifySkyTransform();
      const bad = checks.filter((c) => !c.pass);
      if (bad.length) console.error("verifySkyTransform FAILED", bad);
      else console.info("verifySkyTransform: %d/%d pass", checks.length, checks.length);
      const audit = auditSky3D(a, projectionOf(), ext, cam);
      console.info(
        "auditSky3D: %d rows, %d drawn, %d unresolved",
        audit.rows,
        audit.drawn,
        audit.unresolved,
        audit.byBucket,
      );
    })
    .catch((err: unknown) => {
      console.error("archive failed to load", err);
      const cap = document.querySelector(".field-caption");
      if (cap) cap.textContent = "Archive unresolved";
    });
}

export { PROJECTIONS };
export type { Row };
