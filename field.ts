// LOAD_DATA.md §7 — the render pass. One canvas, ordered.
//
// This file draws; data.ts decides where. Keeping the split means the
// transforms are testable without a canvas, and it is why spec/data.test.ts can
// assert §5's contract in CI where no browser exists.

import {
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
  positionOf,
  verifySkyTransform,
} from "./data";
import { type Env, approach, drawAxes } from "./axes";
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

  // LOAD_DATA.md §9 / LEFT-OBSERVE.md §4: a filter change is ANIMATED, not
  // switched. Radius and alpha interpolate between the previous filter's
  // targets and the new ones on one clock, so the excluded population dims in
  // place. No record is ever removed from the draw loop.
  // CONTRACT C: never early-return on the handle; early-return only when the
  // tween set is empty. `pending` is that set, and one loop advances all of it.
  let rafId = 0;
  const pending = new Set<string>();
  function drive(): void {
    if (rafId) return; // a loop is already running — do NOT start a second
    const tick = (): void => {
      rafId = 0;
      paint();
      if (pending.size) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
  }

  // FIX.md #7a: 420ms easeInOut, one clock for both directions.
  const FILTER_MS = 420;
  let ftStart = 0;
  let prevIn: boolean[] = [];
  let nowIn: boolean[] = [];

  // AXES.md §3: the envelope is approached exponentially, never snapped.
  let env: Env | null = null;
  let envSettled = true;
  let lastFrame = 0;

  function sizeCanvas(): { w: number; h: number } {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // §7 step 1
    const w = box!.clientWidth;
    const h = box!.clientHeight;
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    canvas!.style.width = `${w}px`;
    canvas!.style.height = `${h}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function computeTargets(): void {
    if (!archive || !ext) return;
    target = archive.rows.map((r) => positionOf(r, projectionOf(), ext!, cam));
    fitRight = target.some((p) => !p.resolved) ? 1.26 : 1;
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
    const map = mapping(view, w, h, pad, fitRight);
    const sx = map.sx;
    const sy = map.sy;

    const p = morphing
      ? Math.min(1, (performance.now() - morphStart) / MORPH_MS)
      : 1;
    const e = p < 1 ? easeInOut(p) : 1;

    // §7 step 2 — furniture UNDER the points.
    ctx!.strokeStyle = "rgba(150,170,255,0.12)";
    ctx!.lineWidth = 1;
    ctx!.strokeRect(sx(0.06), sy(0.06), sx(0.94) - sx(0.06), sy(0.94) - sy(0.06));
    if (fitRight > 1) {
      // The holding cloud's own ellipse, so the region reads as deliberate
      // rather than as points that escaped the plot.
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
    }

    // §7 step 3 — every row.
    const zg = 1; // zoom gain; wheel zoom is not wired yet
    const ft = Math.min(1, (performance.now() - ftStart) / FILTER_MS);
    for (let i = 0; i < archive.rows.length; i++) {
      const from = drawn[i] ?? target[i];
      const to = target[i];
      if (!to || to.behind) continue; // behind the eye: not drawable this frame
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      const bucket = archive.bucketOf[archive.rows[i][C.method] as number];

      // Interpolate between the two filter states rather than branching on the
      // current one: mid-transition a point is genuinely between them.
      const wasIn = prevIn[i] ?? true;
      const isIn = nowIn[i] ?? true;
      const w = (wasIn ? 1 : 0) + ((isIn ? 1 : 0) - (wasIn ? 1 : 0)) * ft;
      let r = (1.2 + 0.8 * w) * zg;
      let a = 0.1 + 0.7 * w;
      if (!to.resolved) {
        // Unresolved records are drawn — §2 — but dimmed, so the cloud reads as
        // "not measured" rather than as a dense cluster of findings.
        r = (1.0 + 0.2 * w) * zg;
        a = (0.1 + 0.25 * w);
      }
      if (projectionOf() === "spatial" && to.depth) {
        // §7's depth cue, SPATIAL only.
        const cue = Math.min(1.5, Math.max(0.45, cam.dist / to.depth));
        r *= cue;
        a *= Math.min(1, cue);
      }

      ctx!.globalAlpha = a;
      ctx!.fillStyle = BUCKET_COLOUR[bucket];
      ctx!.beginPath();
      ctx!.arc(sx(x), sy(y), r, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;

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
      );
    }

    // CONTRACT C: report what is still pending; the driver owns the rAF.
    if (p < 1) pending.add("morph");
    else pending.delete("morph");
    if (ft < 1) pending.add("filter");
    else pending.delete("filter");
    if (envSettled) pending.delete("envelope");
    else pending.add("envelope");
    if (pending.size) drive();
    else if (morphing) {
      morphing = false;
      drawn = target.map((t) => ({ ...t }));
    }
  }

  function setProjection(next: Projection): void {
    if (next === projectionOf()) return;
    // Freeze what is on screen right now as the morph's origin (§8).
    drawn = target.length ? target.map((t) => ({ ...t })) : [];
    state.projection = next;
    computeTargets();
    if (drawn.length && !reduceMotion()) {
      morphing = true;
      morphStart = performance.now();
      pending.add("morph");
    } else {
      drawn = target.map((t) => ({ ...t }));
    }
    // #7b: the view is NOT interpolated. Clamp it into the new fit rect, which
    // is a correction; interpolating toward the new centre would be a hijack.
    clampView(viewFor(next, fitRight), fitRight);
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
    const map = mapping(viewFor(projectionOf(), fitRight), w, h, 26, fitRight);
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
        paint();
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
    const view = viewFor(projectionOf(), fitRight);
    if (dragButton === 2 && projectionOf() === "spatial") {
      // §2: RIGHT = ROTATE, and only where an orientation exists. The verb that
      // costs the most is the one you must ask for.
      cam.yaw -= dx * 0.006;
      cam.pitch = Math.min(1.45, Math.max(-1.45, cam.pitch + dy * 0.006));
      computeTargets();
    } else if (box) {
      // §2: LEFT = TRANSLATE, in every projection, so muscle memory carries.
      view.cx -= (dx / (box.clientWidth - 52)) * (fitRight / view.zoom);
      view.cy -= dy / (box.clientHeight - 52) / view.zoom;
    }
    paint();
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
    state.selectedIdx = nearest(e.clientX - r.left, e.clientY - r.top, HIT.click);
    state.previewIdx = null;
    renderTarget();
    paint();
  });
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    endDrag();
    if (state.previewIdx !== null) {
      state.previewIdx = null;
      renderTarget();
      paint();
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
          viewFor(projectionOf(), fitRight),
          e.deltaY,
          e.clientX - r.left,
          e.clientY - r.top,
          box.clientWidth,
          box.clientHeight,
          26,
          fitRight,
        );
      }
      paint();
    },
    { passive: false },
  );

  // §5: CENTER TARGET moves the VIEW, never the point, and stops at a moderate
  // zoom so the record keeps its neighbourhood — a target alone in an empty
  // frame tells you nothing about where it sits.
  function centreTarget(): void {
    const i = state.selectedIdx;
    if (i === null) return;
    const t = target[i];
    if (!t || !t.resolved) return;
    const view = viewFor(projectionOf(), fitRight);
    const from = { ...view };
    const to: View = {
      cx: t.x,
      cy: t.y,
      zoom: Math.min(3.2, Math.max(2.4, view.zoom)),
    };
    if (reduceMotion()) {
      Object.assign(view, to); // §8: skip, not shorten
      paint();
      return;
    }
    const t0 = performance.now();
    const step = (): void => {
      const p = Math.min(1, (performance.now() - t0) / MS.centre);
      const e = easeInOut(p);
      view.cx = from.cx + (to.cx - from.cx) * e;
      view.cy = from.cy + (to.cy - from.cy) * e;
      view.zoom = from.zoom + (to.zoom - from.zoom) * e;
      paint();
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
    paint();
  });
  document.querySelector("#expand-field")?.addEventListener("click", () => {
    document.body.classList.toggle("focus-mode");
    // FIELD.md §4: the canvas resizes after the layout commits and the HUD
    // reserves are measured from the DOM, so redraw once it has settled.
    for (const d of [0, 40, 160]) window.setTimeout(paint, d);
  });
  document.querySelector("#fit-field")?.addEventListener("click", () => {
    resetView(projectionOf(), fitRight);
    paint();
  });

  document
    .querySelectorAll<HTMLButtonElement>(".field-projection .pick")
    .forEach((b, i) => {
      b.addEventListener("click", () => {
        const next = PROJECTIONS[i];
        if (next) setProjection(next.id);
      });
    });

  window.addEventListener("resize", paint);

  void loadArchive()
    .then((a) => {
      archive = a;
      ext = extentsOf(a.rows);
      cam.dist = fitCameraDist(ext.dist[1]);
      prevIn = a.rows.map(() => true);
      nowIn = a.rows.map((r) => inPool(a, r));
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
        const view = viewFor(projectionOf(), fitRight);
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
