// SPATIAL.md — SPATIAL // RA + DEC, the reference furniture and the HUD tapes.
//
// §0 is why this projection alone gets a coordinate grid: the other three plot
// PROPERTIES, this one plots PLACES. There is a real sphere to reference, so
// referencing it is honest. The others get no grid because there is nothing to
// reference, and that asymmetry is the design rather than an inconsistency.
//
// Kept out of axes.ts because none of it is a tape formula: it is geometry
// projected through the camera, and mixing it in would put world-space maths in
// the one file whose whole guarantee is that it only ever asks the mapping where
// a value goes.

import { type Camera, project } from "./data";
import { referenceDist } from "./nav";
import type { Env, Frame } from "./axes";

const LINE = "rgba(150,170,255,0.42)";
const DIM = "rgba(150,170,255,0.22)";
const TEXT = "#8f9ad4";
const GRID = "rgba(150,170,255,0.13)";
/** §2.3: the Transit amber, borrowed deliberately. It is the only warm line in
 *  the field, so the ecliptic reads as "solar system" against a cold sky. */
const ECLIPTIC = "rgba(232,195,122,0.34)";

/** §2.1: the 1 kpc shell, which contains ~97% of the archive. The grid is a
 *  CONTAINER, not a backdrop at infinity — a sphere drawn out at infinity would
 *  say the archive fills the sky, and it does not. */
const R_SPHERE = Math.log(1 + 1000);
const TILT = (23.44 * Math.PI) / 180;
const D2R = Math.PI / 180;

type P3 = { x: number; y: number; z: number };

const onSphere = (raDeg: number, decDeg: number, r = R_SPHERE): P3 => {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  return {
    x: r * Math.cos(dec) * Math.cos(ra),
    y: r * Math.sin(dec),
    z: r * Math.cos(dec) * Math.sin(ra),
  };
};

/** The equator circle rotated 23.44° about +X — the vernal equinox direction,
 *  RA 0h. Because +X is both RA 0h and the ecliptic's ascending node, the axis
 *  stub, the equinox mark and this curve's node all agree: one direction, three
 *  pieces of furniture, no contradiction (§4). */
const eclipticPoint = (thetaDeg: number): P3 => {
  const t = thetaDeg * D2R;
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  return {
    x: R_SPHERE * Math.cos(t),
    y: -R_SPHERE * Math.sin(t) * s,
    z: R_SPHERE * Math.sin(t) * c,
  };
};

interface SP {
  x: number;
  y: number;
  /** Eye-space depth. §2.5 splits every family on this. */
  z: number;
}

const toScreen = (p: P3, f: Frame, cam: Camera): SP | null => {
  const q = project(p, cam);
  if (!q) return null;
  return { x: f.sx(q.x), y: f.sy(q.y), z: q.depth ?? cam.dist };
};

/** §2.5: two passes, split by segment-midpoint depth. Without the near/far alpha
 *  split the graticule is genuinely ambiguous — the eye cannot tell an inside
 *  from an outside and the whole 3D read collapses into a flat mandala. */
function polyline(
  ctx: CanvasRenderingContext2D,
  pts: (SP | null)[],
  cam: Camera,
  far: boolean,
): void {
  ctx.beginPath();
  let open = false;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) {
      open = false;
      continue;
    }
    const near = (a.z + b.z) / 2 < cam.dist;
    if (near === far) {
      open = false;
      continue;
    }
    if (!open) {
      ctx.moveTo(a.x, a.y);
      open = true;
    }
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

const arc = (
  f: Frame,
  cam: Camera,
  n: number,
  at: (t: number) => P3,
): (SP | null)[] => {
  const out: (SP | null)[] = [];
  for (let i = 0; i <= n; i++) out.push(toScreen(at(i / n), f, cam));
  return out;
};

/**
 * §2: the five families, all UNDER the points. Called before the draw loop, so
 * furniture never crosses over a record — the priority order is data first, and
 * the dotted patterns exist so the grid disappears the moment you look at a
 * point.
 */
export function drawSkyFurniture(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  cam: Camera,
  alpha: number,
): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.lineWidth = 1;

  // Far first, then near, each family in turn. Both under the data.
  for (const far of [true, false]) {
    const k = far ? 0.45 : 1;

    // §2.1 meridians — 12 half-great-circles every 2h of RA.
    ctx.globalAlpha = alpha * k;
    ctx.strokeStyle = GRID;
    // The dash pattern is SCREEN space, so it does not stretch with
    // perspective. A perspective-correct dash bunches at the far side of the
    // sphere and reads as an error rather than as depth.
    ctx.setLineDash([1, 6]);
    for (let h = 0; h < 12; h++) {
      const ra = h * 30;
      polyline(ctx, arc(f, cam, 48, (t) => onSphere(ra, -90 + 180 * t)), cam, far);
    }

    // §2.1 parallels.
    ctx.setLineDash([1, 5]);
    for (const dec of [-60, -30, 0, 30, 60]) {
      polyline(ctx, arc(f, cam, 72, (t) => onSphere(360 * t, dec)), cam, far);
    }

    // §2.2 the celestial equator — the ONE solid ring. It is solid because it is
    // the reference plane of the coordinate system the tapes are labelled in.
    // Exactly one circle may be solid, or "solid" stops meaning anything.
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(150,170,255,0.30)";
    polyline(ctx, arc(f, cam, 96, (t) => onSphere(360 * t, 0)), cam, far);

    // §2.3 the ecliptic — its own third weight, so it can never be confused
    // with the equator or the graticule.
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = ECLIPTIC;
    polyline(ctx, arc(f, cam, 96, (t) => eclipticPoint(360 * t)), cam, far);
    ctx.lineWidth = 1;
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = alpha;
  ctx.font = '9.5px "IBM Plex Mono", monospace';

  // §2.3's node marks. Drawn only on the near hemisphere — a node label showing
  // through the far side of the sphere would contradict the alpha split that
  // makes the sphere a sphere.
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const [ra, label] of [
    [0, " ♈ VERNAL EQUINOX "],
    [180, " ♎ AUTUMNAL EQUINOX "],
  ] as [number, string][]) {
    const s = toScreen(onSphere(ra, 0), f, cam);
    if (!s || s.z >= cam.dist) continue;
    ctx.strokeStyle = "rgba(232,195,122,0.55)";
    ctx.beginPath();
    ctx.moveTo(s.x - 5, s.y - 5);
    ctx.lineTo(s.x + 5, s.y + 5);
    ctx.moveTo(s.x + 5, s.y - 5);
    ctx.lineTo(s.x - 5, s.y + 5);
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.fillText(label, s.x + 10, s.y);
  }

  const pole = toScreen(onSphere(270, 66.56), f, cam);
  if (pole && pole.z < cam.dist) {
    ctx.save();
    ctx.globalAlpha *= 0.3;
    ctx.strokeStyle = "rgba(232,195,122,0.55)";
    ctx.beginPath();
    ctx.moveTo(pole.x - 3, pole.y - 3);
    ctx.lineTo(pole.x + 3, pole.y + 3);
    ctx.moveTo(pole.x + 3, pole.y - 3);
    ctx.lineTo(pole.x - 3, pole.y + 3);
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.fillText(" ECLIPTIC POLE ", pole.x + 7, pole.y);
    ctx.restore();
  }

  // §2.2 / §2.3's labels, placed away from the nodes so the three do not stack.
  labelOnCurve(ctx, f, cam, 90, (t) => onSphere(360 * t, 0), " CELESTIAL EQUATOR ", TEXT);
  labelOnCurve(ctx, f, cam, 90, (t) => eclipticPoint(360 * t), " ECLIPTIC · 23.44° ", "rgba(232,195,122,0.75)");

  ctx.restore();
}

/** No plates anywhere in this design, so a label goes at a vertex of its own
 *  curve — the same posture as the distance rings, which break their stroke
 *  instead of being painted over. */
function labelOnCurve(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  cam: Camera,
  atDeg: number,
  at: (t: number) => P3,
  label: string,
  fill: string,
): void {
  const s = toScreen(at(atDeg / 360), f, cam);
  if (!s || s.z >= cam.dist) return;
  ctx.fillStyle = fill;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, s.x + 6, s.y - 7);
}

/** §4's three stubs. They rotate with the camera, so they answer "which way am I
 *  looking" without a corner gizmo — and they are SCREEN-px lengths, because
 *  they are instruments rather than objects in the scene. */
export function drawAxisStubs(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  cam: Camera,
  alpha: number,
): void {
  const o = toScreen({ x: 0, y: 0, z: 0 }, f, cam);
  if (!o) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '9.5px "IBM Plex Mono", monospace';
  ctx.textBaseline = "middle";
  const axes: [P3, string][] = [
    [{ x: 1, y: 0, z: 0 }, " RA 0h "],
    [{ x: 0, y: 1, z: 0 }, " +DEC "],
    [{ x: 0, y: 0, z: 1 }, " RA 6h "],
  ];
  for (const [dir, label] of axes) {
    const tip = toScreen(
      { x: dir.x * R_SPHERE, y: dir.y * R_SPHERE, z: dir.z * R_SPHERE },
      f,
      cam,
    );
    if (!tip) continue;
    const dx = tip.x - o.x;
    const dy = tip.y - o.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ux = (dx / len) * 16;
    const uy = (dy / len) * 16;
    ctx.strokeStyle = DIM;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + ux, o.y + uy);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = TEXT;
    ctx.textAlign = ux < 0 ? "right" : "left";
    ctx.fillText(label, o.x + ux, o.y + uy);
    ctx.restore();
  }
  ctx.restore();
}

/** §2.6: the one dotted line that is not part of the sphere. Gated on selection
 *  because 6,336 drop lines is a hairball — and because the question it answers,
 *  "how far above the equator is THIS one", is a question about one record. */
export function drawDropLine(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  cam: Camera,
  world: P3,
  alpha: number,
): void {
  const top = toScreen(world, f, cam);
  const foot = toScreen({ x: world.x, y: 0, z: world.z }, f, cam);
  if (!top || !foot) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(214,224,255,0.35)";
  ctx.setLineDash([1, 4]);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(foot.x, foot.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(foot.x, foot.y, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// --- §3, the tapes ---------------------------------------------------------

/** §3.2 / §3.3: two ladders, in the units the coordinate is actually quoted in.
 *  RA is an HOUR ANGLE — labelling it in degrees is the single most common way
 *  an otherwise good sky view announces that nobody checked it. */
const RA_LADDER = [90, 30, 15, 7.5, 3.75, 1.25, 0.5, 0.25]; // 6h … 1m, in degrees
const DEC_LADDER = [30, 15, 10, 5, 2, 1, 0.5, 1 / 6];

/** §3.4's hysteresis. Promote at 58 px, demote at 44 px — a 14 px dead band,
 *  without which a slow dolly at the boundary flickers between two rungs every
 *  frame. Module state because it is a property of the instrument across frames,
 *  not of any one frame. */
const rung = { ra: 0, dec: 0, raFrom: 0, decFrom: 0, raT: 0, decT: 0 };
const FADE = 220;

function pickRung(
  ladder: number[],
  pxDeg: number,
  minPitch: number,
  cur: number,
): number {
  const pitch = (i: number): number => ladder[i] * pxDeg;
  // Promote while the current rung is too coarse to have earned its space...
  let i = cur;
  while (i + 1 < ladder.length && pitch(i) >= minPitch * 1.6) i++;
  // ...and demote only past the lower threshold, never at the same number.
  while (i > 0 && pitch(i) <= minPitch * 0.76) i--;
  return i;
}

const raLabel = (deg: number, rungDeg: number): string => {
  const d = ((deg % 360) + 360) % 360;
  const h = d / 15;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (rungDeg >= 15) return `${(hh + (mm === 60 ? 1 : 0)) % 24}h`;
  return `${hh % 24}h ${(mm % 60).toString().padStart(2, "0")}m`;
};

const decLabel = (deg: number, rungDeg: number): string => {
  // §3.3 says "always signed", and its own example writes the origin as `0°` —
  // a signed zero is a sign with nothing to distinguish.
  const sign = Math.abs(deg) < 1e-9 ? "" : deg < 0 ? "−" : "+";
  const a = Math.abs(deg);
  if (rungDeg >= 1) return `${sign}${Math.round(a)}°`;
  const d = Math.floor(a);
  return `${sign}${d}° ${Math.round((a - d) * 60)}'`;
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * §3: fixed-scale HUD strips. What changes with the dolly is not the
 * scale-to-data mapping but WHICH INTERVAL from a ladder is drawn — exactly as a
 * sky atlas changes from 30° to 1° gridlines as you zoom in.
 */
export function drawSkyTapes(
  ctx: CanvasRenderingContext2D,
  box: Env,
  ay: number,
  ax: number,
  cam: Camera,
  narrow: boolean,
  alpha: number,
  now: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '9.5px "IBM Plex Mono", monospace';
  ctx.lineWidth = 1;

  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(box.x0, ay);
  ctx.lineTo(box.x1, ay);
  ctx.moveTo(ax, box.y0);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  // §3.1. The 24° half-angle is the projection's own f, so this is not a
  // constant chosen for the tape — it is the camera's field width, and the
  // strip is quoting it.
  const plotW = box.x1 - box.x0;
  const pxDeg = plotW / (48 * (cam.dist / referenceDist()));
  const midX = (box.x0 + box.x1) / 2;
  const midY = (box.y0 + ay) / 2;
  const yawDeg = (cam.yaw * 180) / Math.PI;
  const pitchDeg = (cam.pitch * 180) / Math.PI;

  const nextRa = pickRung(RA_LADDER, pxDeg, narrow ? 74 : 58, rung.ra);
  if (nextRa !== rung.ra) {
    rung.raFrom = rung.ra;
    rung.raT = now;
    rung.ra = nextRa;
  }
  const nextDec = pickRung(DEC_LADDER, pxDeg, 32, rung.dec);
  if (nextDec !== rung.dec) {
    rung.decFrom = rung.dec;
    rung.decT = now;
    rung.dec = nextDec;
  }

  const raMix = clamp01((now - rung.raT) / FADE);
  const decMix = clamp01((now - rung.decT) / FADE);

  // §3.4's survivors: ticks are keyed by VALUE, so one present on both rungs
  // never fades — zooming ADDS subdivisions between the labels you were already
  // reading rather than replacing the tape. That is why a paper atlas feels
  // continuous across plate scales.
  const on = (v: number, step: number): boolean =>
    Math.abs(v / step - Math.round(v / step)) < 1e-6;

  const drawRa = (step: number, mix: number, labels: boolean): void => {
    const span = plotW / 2 / pxDeg + 30;
    // Cyclic in an UNWRAPPED space, labelled mod 24h — no beginning, no end.
    const from = Math.ceil((yawDeg - span) / step) * step;
    let last = -Infinity;
    for (let d = from; d <= yawDeg + span; d += step) {
      // Sub-pixel: never round a tick's position. Only lengths are rounded.
      const x = midX + (d - yawDeg) * pxDeg;
      if (x < box.x0 || x > box.x1) continue;
      const survivor = on(d, RA_LADDER[rung.raFrom]) && on(d, RA_LADDER[rung.ra]);
      const a = survivor ? 1 : mix;
      if (a <= 0.01) continue;
      const major = labels;
      ctx.save();
      ctx.globalAlpha *= a * clamp01(Math.min(x - box.x0, box.x1 - x) / 24);
      ctx.strokeStyle = major ? LINE : DIM;
      ctx.beginPath();
      ctx.moveTo(x, ay);
      ctx.lineTo(x, ay + (major ? 8 : 4));
      ctx.stroke();
      if (major && x - last >= (narrow ? 74 : 58) * 0.8) {
        ctx.fillStyle = TEXT;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(raLabel(d, step), x, ay + 10);
        last = x;
      }
      ctx.restore();
    }
  };

  const drawDec = (step: number, mix: number, labels: boolean): void => {
    let last = -Infinity;
    // Clamped at ±90 and never wrapped, because declination does not wrap. The
    // tape simply runs out of ticks and fades through its end zone.
    for (let d = -90; d <= 90; d += step) {
      const y = midY - (d - pitchDeg) * pxDeg;
      if (y < box.y0 || y > ay) continue;
      const survivor =
        on(d, DEC_LADDER[rung.decFrom]) && on(d, DEC_LADDER[rung.dec]);
      const a = survivor ? 1 : mix;
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha *= a * clamp01(Math.min(y - box.y0, ay - y) / 24);
      ctx.strokeStyle = labels ? LINE : DIM;
      ctx.beginPath();
      ctx.moveTo(ax, y);
      ctx.lineTo(ax + (labels ? 8 : 4), y);
      ctx.stroke();
      // ABS. The loop walks dec from −90 upward and the screen y therefore
      // DECREASES, so `y - last` was negative for every tick after the first and
      // exactly one label survived. A pitch guard is a distance, and a distance
      // has no sign — the horizontal version got away with it because x happens
      // to run the same way as its loop.
      if (labels && Math.abs(y - last) >= 26) {
        ctx.fillStyle = TEXT;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(decLabel(d, step), ax + 12, y);
        last = y;
      }
      ctx.restore();
    }
  };

  // Departing rung holds its positions while it fades; minors are the next rung
  // down, ticks only.
  if (raMix < 1 && rung.raFrom !== rung.ra) drawRa(RA_LADDER[rung.raFrom], 1 - raMix, true);
  if (rung.ra + 1 < RA_LADDER.length) drawRa(RA_LADDER[rung.ra + 1], raMix, false);
  drawRa(RA_LADDER[rung.ra], raMix, true);

  if (decMix < 1 && rung.decFrom !== rung.dec) drawDec(DEC_LADDER[rung.decFrom], 1 - decMix, true);
  if (rung.dec + 1 < DEC_LADDER.length) drawDec(DEC_LADDER[rung.dec + 1], decMix, false);
  drawDec(DEC_LADDER[rung.dec], decMix, true);

  // §3.6: the caret is FIXED and the index moves past it. That inversion is the
  // whole difference between a heading tape and a data axis — an aiming reticle
  // does not slide.
  ctx.fillStyle = "#e6e9fb";
  ctx.beginPath();
  ctx.moveTo(midX, ay - 9);
  ctx.lineTo(midX - 4.5, ay - 1);
  ctx.lineTo(midX + 4.5, ay - 1);
  ctx.closePath();
  ctx.fill();
  ctx.font = '10.5px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(raLabel(yawDeg, 1), midX, ay - 12);

  ctx.beginPath();
  ctx.moveTo(ax + 9, midY);
  ctx.lineTo(ax + 1, midY - 4.5);
  ctx.lineTo(ax + 1, midY + 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(decLabel(pitchDeg, 0.5), ax - 5, midY);

  // Same rule as the other three (axes.ts axisTitles): horizontal title clear
  // of the vertical tape, vertical title above the axis it names.
  ctx.font = '9.5px "IBM Plex Mono", monospace';
  ctx.fillStyle = DIM;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("RA // HOURS", ax - 10, ay - 6);
  ctx.fillText("DEC // DEGREES", ax + 8, box.y0 - 6);
  ctx.restore();
}
