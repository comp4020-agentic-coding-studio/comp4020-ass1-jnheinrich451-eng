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

const reduceMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initField(): void {
  const box = document.querySelector<HTMLElement>(".field-box");
  const canvas = document.querySelector<HTMLCanvasElement>("#field-canvas");
  if (!box || !canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let archive: Archive | null = null;
  let ext: Extent | null = null;
  let projection: Projection = "orbit";
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
  const MORPH_MS = 720;

  // §4: the fit rect widens to 1.26 ONLY when a projection actually has
  // unresolved records, so a complete projection is not squeezed to leave room
  // for a cloud that is not there.
  let fitRight = 1;

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
    target = archive.rows.map((r) => positionOf(r, projection, ext!, cam));
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
    const sx = (x: number): number => pad + (x / fitRight) * (w - pad * 2);
    const sy = (y: number): number => pad + y * (h - pad * 2);

    const p = morphing
      ? Math.min(1, (performance.now() - morphStart) / MORPH_MS)
      : 1;
    const e = p < 1 ? 1 - (1 - p) ** 3 : 1;

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
    for (let i = 0; i < archive.rows.length; i++) {
      const from = drawn[i] ?? target[i];
      const to = target[i];
      if (!to || to.behind) continue; // behind the eye: not drawable this frame
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      const bucket = archive.bucketOf[archive.rows[i][C.method] as number];

      let r = 2.0 * zg;
      let a = 0.8;
      if (!to.resolved) {
        // Unresolved records are drawn — §2 — but dimmed, so the cloud reads as
        // "not measured" rather than as a dense cluster of findings.
        r = 1.2 * zg;
        a = 0.35;
      }
      if (projection === "spatial" && to.depth) {
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

    if (p < 1) requestAnimationFrame(paint);
    else if (morphing) {
      morphing = false;
      drawn = target.map((t) => ({ ...t }));
    }
  }

  function setProjection(next: Projection): void {
    if (next === projection) return;
    // Freeze what is on screen right now as the morph's origin (§8).
    drawn = target.length ? target.map((t) => ({ ...t })) : [];
    projection = next;
    computeTargets();
    if (drawn.length && !reduceMotion()) {
      morphing = true;
      morphStart = performance.now();
    } else {
      drawn = target.map((t) => ({ ...t }));
    }
    syncChrome();
    paint();
  }

  function syncChrome(): void {
    const meta = PROJECTIONS.find((x) => x.id === projection);
    if (!meta || !archive) return;
    for (const [i, b] of Array.from(
      document.querySelectorAll<HTMLButtonElement>(".field-projection .pick"),
    ).entries()) {
      b.classList.toggle("is-active", PROJECTIONS[i]?.id === projection);
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
    set(".field-caption", `${n(archive.rows.length)} confirmed worlds`);
    set(".strip-header .dim", `${n(archive.rows.length)} confirmed worlds`);
    set("#footer-view", `${meta.label}`);
    set("#footer-axes", meta.axes);
    set("#footer-visible", n(visible));
    // §5 rule 2: an absent value is UNRESOLVED, never 0 and never hidden.
    set("#footer-unresolved", unresolved === 0 ? "None" : n(unresolved));
  }

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
      computeTargets();
      drawn = target.map((t) => ({ ...t }));
      syncChrome();
      paint();

      // §5: "Keep them: they are the contract." They also run in spec/, which
      // is where a failure actually stops a push — this pair is for a human
      // looking at the console on the deployed page.
      const checks = verifySkyTransform();
      const bad = checks.filter((c) => !c.pass);
      if (bad.length) console.error("verifySkyTransform FAILED", bad);
      else console.info("verifySkyTransform: %d/%d pass", checks.length, checks.length);
      const audit = auditSky3D(a, projection, ext, cam);
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
