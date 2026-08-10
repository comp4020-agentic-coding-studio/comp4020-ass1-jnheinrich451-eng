// AXES.md — the HUD tapes.
//
// §1 is the whole design: **a tape reads the exact expression that placed the
// points.** So this file never derives a scale. It calls data.ts's logNorm /
// linNorm to ask where a value goes, and logDenorm / linDenorm to ask what sits
// at a position — the same functions field.ts positions points with. If a tape
// ever needed its own copy of the mapping, the two could drift, and "the axis
// is a decoration that lies".
//
// §6's budget is the second idea: four projections get four DIFFERENT amounts
// of axis, because the amount of axis must equal the amount of science. The
// DISCOVERY TIME y is a display spread, so it gets a bracket and a disclosure
// and never a tick.

import {
  type Extent,
  type Projection,
  linDenorm,
  linNorm,
  logDenorm,
  logNorm,
} from "./data";

const LINE = "rgba(150,170,255,0.42)";
const DIM = "rgba(150,170,255,0.22)";
const TEXT = "#8f9ad4";
const FONT = '9.5px "IBM Plex Mono", monospace';

export interface Frame {
  /** Normalised → screen, the same pair field.ts paints points through. */
  sx: (x: number) => number;
  sy: (y: number) => number;
  /** Their exact inverses. Passed in rather than reconstructed here: a tape that
   *  rebuilt the inverse could drift from the mapping (§1). */
  inv: { x: (px: number) => number; y: (py: number) => number };
  w: number;
  h: number;
  /** §3: measured from the DOM, never hard-coded. */
  topReserve: number;
  bottomReserve: number;
  narrow: boolean;
}

/** §4's label rollover. The period domain really does reach ~4x10^8 days, so
 *  without this the tape prints nine digits and the pitch guard gives up. */
export function tickLabel(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${trim(v / 1e9)}B`;
  if (abs >= 1e6) return `${trim(v / 1e6)}M`;
  if (abs >= 1e3) return `${trim(v / 1e3)}K`;
  if (abs < 1) return v.toFixed(2);
  return String(Math.round(v));
}

const trim = (v: number): string =>
  (Math.round(v * 10) / 10).toString().replace(/\.0$/, "");

export interface Tick {
  v: number;
  major: boolean;
}

/** §4's log tape: 1-2-5 per decade, major when the mantissa is 1, emitted only
 *  inside the visible domain. */
export function logTicks(lo: number, hi: number): Tick[] {
  const out: Tick[] = [];
  if (!(lo > 0) || !(hi > lo)) return out;
  const first = Math.floor(Math.log10(lo));
  const last = Math.ceil(Math.log10(hi));
  for (let e = first; e <= last; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v < lo || v > hi) continue;
      out.push({ v, major: m === 1 });
    }
  }
  return out;
}

/** §4's linear tape: the first step whose pixel pitch clears the guard. ONLY
 *  WHOLE YEARS are ever emitted — no 2018.5 can exist, so the step list holds
 *  integers and the loop walks integers. */
export function yearStep(lo: number, hi: number, px: number, narrow: boolean): number {
  const min = narrow ? 74 : 58;
  for (const s of [1, 2, 5, 10, 25, 50]) {
    if ((px * s) / Math.max(hi - lo, 1) >= min) return s;
  }
  return 50;
}

export function yearTicks(lo: number, hi: number, step: number): Tick[] {
  const out: Tick[] = [];
  for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) {
    out.push({ v: y, major: true });
  }
  return out;
}

/** §3's envelope: approached exponentially, never snapped — "it reads like an
 *  instrument acquiring a field, not a box jumping". */
export interface Env {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function approach(cur: Env, target: Env, dt: number): { env: Env; settled: boolean } {
  const k = 1 - Math.exp(-dt / 0.055);
  const next: Env = {
    x0: cur.x0 + (target.x0 - cur.x0) * k,
    y0: cur.y0 + (target.y0 - cur.y0) * k,
    x1: cur.x1 + (target.x1 - cur.x1) * k,
    y1: cur.y1 + (target.y1 - cur.y1) * k,
  };
  const d = Math.max(
    Math.abs(next.x0 - target.x0),
    Math.abs(next.y0 - target.y0),
    Math.abs(next.x1 - target.x1),
    Math.abs(next.y1 - target.y1),
  );
  return { env: next, settled: d < 0.4 };
}

function corners(ctx: CanvasRenderingContext2D, f: Frame, env: Env): void {
  // §7: L-marks at the three unused corners imply the plot box without closing
  // it. A closed box would read as a chart frame, and the field is not a chart.
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 1;
  const L = 12;
  const marks: [number, number, number, number][] = [
    [env.x0, env.y0, 1, 1],
    [env.x1, env.y0, -1, 1],
    [env.x0, env.y1, 1, -1],
  ];
  for (const [x, y, dx, dy] of marks) {
    ctx.beginPath();
    ctx.moveTo(x + dx * L, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * L);
    ctx.stroke();
  }
}

/** Draw the tapes for a projection. Returns nothing: it is furniture. */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  env: Env,
  projection: Projection,
  ext: Extent,
  alpha: number,
): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = FONT;
  ctx.lineWidth = 1;

  // §3: the tape yields to the caption strip and the projection overlay.
  const ax = Math.min(env.x1 + 26, f.w - 14);
  const ay = Math.min(env.y1 + 26, f.bottomReserve);
  const top = Math.max(env.y0, f.topReserve);

  corners(ctx, f, env);

  if (projection === "orbit") {
    horizontalLog(ctx, f, ext.orbper, env, ay, f.narrow ? "PERIOD [D]" : "ORBITAL PERIOD [D]");
    verticalLog(ctx, f, ext.rade, top, ay, ax, f.narrow ? "R⊕" : "PLANET RADIUS [R⊕]");
  } else if (projection === "time") {
    horizontalYear(ctx, f, ext.year, env, ay);
    // §6: the right side is the rule made visible. y here is a display spread,
    // so it gets a SHAPE AND A DISCLOSURE, never a scale — ticks would invent a
    // measurement that does not exist.
    bracket(ctx, f, top, ay, ax);
  } else if (projection === "distance") {
    rings(ctx, f, ext.dist, env);
  } else {
    degreeStrips(ctx, f, env, ay, ax);
  }

  ctx.restore();
}

function horizontalLog(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  span: [number, number],
  env: Env,
  ay: number,
  title: string,
): void {
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(env.x0, ay);
  ctx.lineTo(env.x1, ay);
  ctx.stroke();

  // The domain actually visible, obtained by asking the MAPPING what sits at
  // the tape's two ends — not by rescaling to the envelope (§1, §2).
  const lo = logDenorm(invX(f, env.x0), span[0], span[1]);
  const hi = logDenorm(invX(f, env.x1), span[0], span[1]);
  const pitch = f.narrow ? 84 : 64;
  let lastLabel = -Infinity;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const t of logTicks(Math.min(lo, hi), Math.max(lo, hi))) {
    const x = f.sx(logNorm(t.v, span[0], span[1]));
    if (x < env.x0 - 1 || x > env.x1 + 1) continue;
    ctx.strokeStyle = t.major ? LINE : DIM;
    ctx.beginPath();
    ctx.moveTo(x, ay);
    ctx.lineTo(x, ay + (t.major ? 8 : 4));
    ctx.stroke();
    if (t.major && x - lastLabel >= pitch) {
      ctx.fillStyle = TEXT;
      ctx.fillText(tickLabel(t.v), x, ay + 10);
      lastLabel = x;
    }
  }

  // §5: the title sits INSIDE the tape, so the tape needs no outer clearance.
  ctx.fillStyle = DIM;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(title, env.x1, ay - 4);
}

function verticalLog(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  span: [number, number],
  top: number,
  ay: number,
  ax: number,
  title: string,
): void {
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(ax, top);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  const lo = logDenorm(1 - invY(f, ay), span[0], span[1]);
  const hi = logDenorm(1 - invY(f, top), span[0], span[1]);
  const pitch = (f.narrow ? 84 : 64) * 0.55; // §4: vertical uses 55% of it
  let lastLabel = -Infinity;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const t of logTicks(Math.min(lo, hi), Math.max(lo, hi))) {
    const y = f.sy(1 - logNorm(t.v, span[0], span[1]));
    if (y < top - 1 || y > ay + 1) continue;
    ctx.strokeStyle = t.major ? LINE : DIM;
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(ax + (t.major ? 8 : 4), y);
    ctx.stroke();
    if (t.major && Math.abs(y - lastLabel) >= pitch) {
      ctx.fillStyle = TEXT;
      ctx.fillText(tickLabel(t.v), ax + 10, y);
      lastLabel = y;
    }
  }

  ctx.save();
  ctx.translate(ax - 4, top);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(title, 0, 0);
  ctx.restore();
}

function horizontalYear(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  span: [number, number],
  env: Env,
  ay: number,
): void {
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(env.x0, ay);
  ctx.lineTo(env.x1, ay);
  ctx.stroke();

  const lo = linDenorm(invX(f, env.x0), span[0], span[1]);
  const hi = linDenorm(invX(f, env.x1), span[0], span[1]);
  const step = yearStep(lo, hi, env.x1 - env.x0, f.narrow);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const t of yearTicks(Math.min(lo, hi), Math.max(lo, hi), step)) {
    const x = f.sx(linNorm(t.v, span[0], span[1]));
    if (x < env.x0 - 1 || x > env.x1 + 1) continue;
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(x, ay);
    ctx.lineTo(x, ay + 8);
    ctx.stroke();
    ctx.fillStyle = TEXT;
    // Whole years only — the step list is integers and this prints an integer,
    // so a 2018.5 cannot be constructed.
    ctx.fillText(String(Math.round(t.v)), x, ay + 10);
    if (step >= 5) {
      // §4: a reference guide, not a grid.
      ctx.strokeStyle = "rgba(150,170,255,0.07)";
      ctx.beginPath();
      ctx.moveTo(x, ay);
      ctx.lineTo(x, env.y0);
      ctx.stroke();
    }
  }

  ctx.fillStyle = DIM;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("T // DISCOVERY YEAR", env.x1, ay - 4);
}

/** §6's unnumbered bracket: a shape and a disclosure for an axis that carries
 *  no measurement. The caption picks the longest string that FITS; if none fits,
 *  none is drawn, because the footer already says Y: DISPLAY DISTRIBUTION. */
function bracket(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  top: number,
  ay: number,
  ax: number,
): void {
  ctx.strokeStyle = DIM;
  ctx.beginPath();
  ctx.moveTo(ax - 6, top);
  ctx.lineTo(ax, top);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax - 6, ay);
  ctx.stroke();

  const height = ay - top;
  const options = [
    "Y // DISPLAY SPREAD · NO DATA AXIS",
    "Y // DISPLAY SPREAD",
    "DISPLAY SPREAD",
    "SPREAD",
  ];
  const fits = options.find((s) => ctx.measureText(s).width <= height - 8);
  if (!fits) return;
  ctx.save();
  ctx.translate(ax - 4, ay);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(fits, 0, 0);
  ctx.restore();
}

/** §6: EARTH DISTANCE gets radial range rings and no tape — origin SOL, radius
 *  only, because the angle is a display distribution. */
function rings(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  span: [number, number],
  env: Env,
): void {
  const cx = f.sx(0.5);
  const cy = f.sy(0.5);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (const frac of [0.25, 0.5, 0.75, 1]) {
    const t = 0.06 + 0.88 * frac;
    const pc = logDenorm(t, 1 + span[0], 1 + span[1]) - 1;
    const r = Math.abs(f.sx(0.5 + frac * 0.46) - cx);
    ctx.strokeStyle = frac === 1 ? LINE : DIM;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.fillText(`${tickLabel(pc)} PC`, cx, cy - r - 3);
  }
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("ORIGIN // SOL", env.x0, env.y0);
}

/** §6: SPATIAL gets fixed px/deg HUD strips rather than a data scale — the
 *  camera decides what a degree is worth on screen, so the strip is a heading
 *  reference, not a domain. */
function degreeStrips(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  env: Env,
  ay: number,
  ax: number,
): void {
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(env.x0, ay);
  ctx.lineTo(env.x1, ay);
  ctx.moveTo(ax, env.y0);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  ctx.fillStyle = DIM;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("RA // HEADING", env.x1, ay - 4);
  ctx.save();
  ctx.translate(ax - 4, env.y0);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = "left";
  ctx.fillText("DEC // ELEVATION", 0, 0);
  ctx.restore();
}

// Screen → normalised, via the inverses the frame was built with.
const invX = (f: Frame, px: number): number => f.inv.x(px);
const invY = (f: Frame, py: number): number => f.inv.y(py);
