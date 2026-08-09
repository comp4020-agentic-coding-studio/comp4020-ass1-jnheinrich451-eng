// HOTSPOT.md — the limb hot spot, as a 2D canvas overlay above the WebGL canvas.
//
// §5 splits the reference composite in two: the globe, its fresnel shell and the
// starfield stay in WebGL, and only the LENS artifacts move here — layers 2, 3,
// 8, 9, 10 (halo, ghosts, streak, spikes, core). The disc stamp (4), the forward
// scatter (5), the terminator wash (6) and the rim bands (7) are all deleted by
// that split: the real globe already occludes, and buildLimbGlow()'s shader
// already draws the sharp rim and the lit-side falloff on the actual silhouette.
//
// Two things the reference does that this cannot, and does not try to:
//
//   - §1's geometry (R = W*1.15, centre off-canvas left) exists to make the limb
//     read as a shallow arc. Our globe is a whole disc at a measured radius, so
//     that geometry is replaced by the projected light point hero.ts already
//     computes. `elevation` is subsumed: the sun's own orbit moves the point
//     around the limb, which is strictly more than the reference's one degree of
//     freedom.
//   - The reference paints on an opaque frame, so `lighter` really is additive.
//     A transparent overlay composited source-over would wash the fan toward
//     white instead of adding to it, so the canvas element carries
//     `mix-blend-mode: screen` — that is what restores additive behaviour
//     against the layers below.
//
// Everything sized from `W` in the reference is sized here from U = px / 1.15,
// the reference's own R = W*1.15 solved for W. That keeps every published
// constant verbatim rather than re-deriving a "cleaner" set.

// §4's working preset, and the only place these numbers live.
const BLOOM = 1.15;
const STREAK = 1.4;
const SPIKES = 6;

// §4 tone: cold — the project default. Three RGB triples, nothing else.
const CORE: RGB = [255, 255, 255];
const HALO: RGB = [206, 226, 255]; // #cee2ff
const ATMOS: RGB = [129, 178, 255]; // #81b2ff

// Length of the anamorphic streak at STREAK = 1. HOTSPOT.md specifies the
// streak's thicknesses and gradient stops but not its length, so this is chosen,
// not ported: at the preset 1.4 it spans ~1.5 frame-widths, which is what makes
// it read as anamorphic rather than as a lens glint.
const STREAK_LEN = 1.1;
// Same — §3.3 gives the spikes' thickness, rotation offset and alpha but no
// length.
const SPIKE_LEN = 0.52;

// Retina costs a lot here: the halo alone is a radial fill of radius 1.25 U, so
// at DPR 3 the composite is filling tens of megapixels every frame. Glows carry
// no high-frequency detail, so 1.5 is indistinguishable and roughly a quarter of
// the fill.
const MAX_DPR = 1.5;

type RGB = readonly [number, number, number];
type Stop = readonly [number, number];

const rgba = (c: RGB, a: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.max(0, Math.min(1, a))})`;

export interface Hotspot {
  canvas: HTMLCanvasElement;
  resize(w: number, h: number): void;
  /** `angle` is the long axis in radians, `phase` the lit fraction. See draw(). */
  draw(
    sx: number,
    sy: number,
    px: number,
    angle: number,
    phase: number,
  ): void;
}

export function createHotspot(canvas: HTMLCanvasElement): Hotspot | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize(nextW: number, nextH: number): void {
    if (!ctx) return;
    w = nextW;
    h = nextH;
    dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  // A radial gradient at (x, y) with an explicit stop list, filled over the
  // whole frame. Filling the frame rather than an arc is deliberate: the
  // gradient's own falloff is the shape, and a clipped arc would put a hard
  // circular edge on something that is supposed to have none.
  function glow(x: number, y: number, r: number, stops: Stop[], c: RGB): void {
    if (!ctx || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (const [at, alpha] of stops) g.addColorStop(at, rgba(c, alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // §3.2's trick, reused by §3.3: squash a RADIAL gradient rather than draw a
  // linear one in a rectangle. The radial falloff is what tapers the ends to a
  // point; a linear gradient gives blunt ends and reads as a UI divider.
  function squashed(
    x: number,
    y: number,
    len: number,
    thickness: number,
    angle: number,
    stops: Stop[],
    c: RGB,
  ): void {
    if (!ctx || len <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, thickness);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
    for (const [at, alpha] of stops) g.addColorStop(at, rgba(c, alpha));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, len, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Deterministic per-index jitter, the same sin-hash the reference uses for its
  // grain. Math.random() here would make the spikes crawl between frames.
  const jitter = (i: number) => {
    const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // `angle` orients the whole lens: the streak's long axis, with the spikes
  // carried around with it so the artifact stays one coherent object rather
  // than a rotating streak over a fixed starburst.
  //
  // `phase` is §3.7's p: the fraction of the disc that is lit, 0 = a razor
  // crescent, 1 = fully lit. Five quantities hang off it so the composite moves
  // as one physical state rather than as a brightness slider.
  function draw(
    sx: number,
    sy: number,
    px: number,
    angle: number,
    phase: number,
  ): void {
    if (!ctx || !w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (px <= 0) return;

    // R = W * 1.15 (§1), solved for the reference's frame unit.
    const U = px / 1.15;

    // §3.7's derivations, verbatim.
    const p = Math.max(0, Math.min(1, phase));
    const lit = Math.pow(p, 1.5); // the dim end falls away fast
    const I = 0.05 + 0.95 * lit; // illumination driver, never quite zero
    const SL = 1.7 - 1.45 * Math.pow(p, 0.7); // streak length — INVERSE
    // The two remaining rows of §3.7's table, read off their endpoints: halo
    // radius W*0.75 -> W*1.35 against a base of W*1.25, core radius 0.55x -> 1x,
    // spike length 1.15x -> 0.70x.
    const haloScale = (0.75 + 0.6 * p) / 1.25;
    const coreScale = 0.55 + 0.45 * p;
    const spikeScale = 1.15 - 0.45 * p;

    ctx.globalCompositeOperation = "lighter";

    // --- layer 2: halo (§3.1) -----------------------------------------------
    // Three-stop falloff 0 -> 0.35 -> 1, not a linear ramp: brightness collapses
    // fast near the core and lingers far out, which is what scattering does.
    const falloff = (a: number): Stop[] => [
      [0, a * BLOOM * I],
      [0.35, a * BLOOM * I * 0.22],
      [1, 0],
    ];
    // All three scale together. §3.7 lists one "halo radius", and 1.25 is the
    // outermost's base, so driving the group from it keeps §3.1's internal
    // proportions rather than letting the outer ring slide over fixed inner ones.
    glow(sx, sy, U * 1.25 * haloScale, falloff(0.3), ATMOS);
    glow(sx, sy, U * 0.42 * haloScale, falloff(0.4), HALO);
    glow(sx, sy, U * 0.11 * haloScale, falloff(0.55), CORE);

    // --- layer 3: lens ghosts (§3.6) ----------------------------------------
    // Along the line from S through the frame centre. Rings, not discs: bright
    // at .94 of the radius, transparent in the middle.
    const gx = w / 2 - sx;
    const gy = h / 2 - sy;
    for (const [i, t] of [0.45, 0.85, 1.25].entries()) {
      const r = U * (0.07 + i * 0.035);
      // Ghosts are images of the source, so they follow the source (× I) even
      // though §3.7's table does not list them — it lists halo, core and spikes,
      // and a ghost outliving the thing casting it would read as a bug.
      const a = 0.014 * BLOOM * I;
      const g = ctx.createRadialGradient(
        sx + gx * t,
        sy + gy * t,
        0,
        sx + gx * t,
        sy + gy * t,
        r,
      );
      g.addColorStop(0, rgba(HALO, 0));
      g.addColorStop(0.82, rgba(HALO, a * 0.35));
      g.addColorStop(0.94, rgba(HALO, a));
      g.addColorStop(1, rgba(HALO, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx + gx * t, sy + gy * t, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- layer 8: anamorphic streak (§3.2) ----------------------------------
    // Three passes, wide+dim to thin+bright. The .06 stop holds the centre hot
    // over the first 6% of the length — the anamorphic signature.
    // SL runs backwards on purpose (§3.7): a sun barely clearing the limb is a
    // point source seen through the deepest slice of atmosphere, which is the
    // condition that makes a long smear. As the face opens the source goes broad
    // and high and the smear collapses into the core. The dimmest frame is the
    // widest one — that inversion is what makes this an event rather than a
    // brightness control.
    const len = U * STREAK_LEN * STREAK * SL;
    const streakStops = (a: number): Stop[] => [
      [0, a * BLOOM],
      [0.06, a * BLOOM],
      [0.4, a * BLOOM * 0.25],
      [1, 0],
    ];
    squashed(sx, sy, len, 0.055, angle, streakStops(0.3), ATMOS);
    squashed(sx, sy, len, 0.018, angle, streakStops(0.55), HALO);
    squashed(sx, sy, len, 0.006, angle, streakStops(1), CORE);

    // --- layer 9: spikes (§3.3) ---------------------------------------------
    // +0.22 rad so no spike is axis-aligned, which is what stops it reading as
    // a stock flare. Nearly subliminal by design: if you can count them, they
    // are too bright.
    for (let i = 0; i < SPIKES; i++) {
      const spikeAngle = angle + (i / SPIKES) * Math.PI * 2 + 0.22;
      const spikeLen = U * SPIKE_LEN * spikeScale * (0.7 + jitter(i) * 0.6);
      squashed(sx, sy, spikeLen, 0.006, spikeAngle, streakStops(0.3 * I), CORE);
    }

    // --- layer 10: core (§2) ------------------------------------------------
    // Last, and the only hard-edged thing in the overlay. Drawn after the streak
    // and spikes so the point they emanate from is brighter than they are.
    glow(
      sx,
      sy,
      U * 0.035 * coreScale,
      [
        [0, I],
        [0.5, 0.85 * I],
        [1, 0],
      ],
      CORE,
    );

    ctx.globalCompositeOperation = "source-over";
  }

  return { canvas, resize, draw };
}
