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

import { drawAxisStubs, drawSkyTapes } from "./sky";
import {
  type Camera,
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

/** PROJECTIONS.md's per-projection furniture needs three things the tape formula
 *  never did: the camera (SPATIAL's strips are a heading, so they read the
 *  camera and not the data), the target (DISCOVERY TIME's cursor), and the
 *  holding cloud's own count. Passed as one object so adding the fourth does not
 *  mean threading another positional argument through every call. */
export interface AxisExtras {
  cam: Camera | null;
  cursor: { year: number; locked: boolean } | null;
  cloud: {
    label: string;
    count: number;
    frame: { cx: number; rx: number; ry: number };
  } | null;
}

/** §5.3's chevron is the ONE piece of field furniture that takes a pointer, so
 *  its position has to escape the draw. Published rather than returned because
 *  drawAxes is called for its side effects and every other caller wants nothing
 *  back; field.ts reads this when a click lands. Null whenever SOL is in frame
 *  or the projection has no origin to point at. */
let solArrow: { x: number; y: number } | null = null;
export const solArrowAt = (): { x: number; y: number } | null => solArrow;

/** §5.1's ring values: 1-2-5 per decade in pc, inside the visible domain. Same
 *  generator as the log tape, which is the point — a ring and a tick are the
 *  same statement drawn two ways, so they must not come from two sources. */
export function ringValues(lo: number, hi: number): Tick[] {
  return logTicks(Math.max(lo, 0.5), hi);
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

/** CONTRACT D. The tape belongs to the DATA, not to the unresolved cloud: the
 *  annotation may push the tape left but must never pull it right of
 *  env.x1 + 26, and the rect can neither collapse nor flee. */
export function plotRect(f: Frame, env: Env): { l: number; r: number; t: number; b: number } {
  const l = Math.max(env.x0, 16);
  const b = Math.min(env.y1 + 26, f.bottomReserve);
  const r = Math.min(
    Math.max(Math.min(env.x1 + 26, f.w - 14), l + 140),
    f.w - 14,
  );
  const tp = Math.max(env.y0, f.topReserve);
  return { l, r, t: Math.min(tp, b - 120), b };
}

/** ONE rule for both titles, in every projection.
 *
 *  They were each written where their own tape happened to end: the horizontal
 *  title right-aligned at env.x1, which IS the vertical tape's x, so the two
 *  overlapped; and the vertical title rotated along its own axis line, so at
 *  some zooms it sat under the ticks and could not be read at all.
 *
 *  The rule the author asked for, and it is the right one because it is stated
 *  in terms of the OTHER axis rather than in terms of offsets:
 *    horizontal — right-aligned, ending CLEAR of the vertical tape
 *    vertical   — on top, above the axis, so it never crosses the line it names
 *  Both are still inside the plot's span, so neither tape needs outer
 *  clearance, which is what §2 was protecting. */
function axisTitles(
  ctx: CanvasRenderingContext2D,
  ay: number,
  ax: number,
  top: number,
  xTitle: string | null,
  yTitle: string | null,
): void {
  ctx.save();
  ctx.fillStyle = DIM;
  if (xTitle) {
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(xTitle, ax - 10, ay - 6);
  }
  if (yTitle) {
    // Right-aligned to the axis it names, sitting above its top end.
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(yTitle, ax + 8, top - 6);
  }
  ctx.restore();
}

/** Draw the tapes for a projection. Returns nothing: it is furniture. */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  env: Env,
  projection: Projection,
  ext: Extent,
  alpha: number,
  x: AxisExtras = { cam: null, cursor: null, cloud: null },
): void {
  solArrow = null; // recomputed per frame; a stale one would stay clickable
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = FONT;
  ctx.lineWidth = 1;

  // FIX.md CONTRACT D: ONE rect per frame, and every tape, tick and bracket
  // reads it. The four extents used to be computed independently, which is why
  // the tapes never met: ax was pulled to the unresolved cloud's edge, ay and
  // top came from different clamps, and the brackets used a third set of
  // numbers. Corner connection is structural now, not coincidental.
  const rect = plotRect(f, env);

  // "No tape without a span." A five-tick stub is worse than no axis.
  if (rect.r - rect.l < 140 || rect.b - rect.t < 120) {
    ctx.restore();
    return;
  }

  const ax = rect.r;
  const ay = rect.b;
  const top = rect.t;
  const box: Env = { x0: rect.l, y0: rect.t, x1: rect.r, y1: rect.b };

  corners(ctx, f, box);

  if (projection === "orbit") {
    // PROJECTIONS.md §3: references BEFORE the tapes, so a tick never has to
    // compete with a rule drawn over it.
    orbitReferences(ctx, f, ext, box);
    horizontalLog(ctx, f, ext.orbper, box, ay, f.narrow ? "PERIOD [D]" : "ORBITAL PERIOD [D]");
    verticalLog(ctx, f, ext.rade, top, ay, ax, f.narrow ? "R⊕" : "PLANET RADIUS [R⊕]");
    axisTitles(
      ctx,
      ay,
      ax,
      top,
      f.narrow ? "PERIOD [D]" : "ORBITAL PERIOD [D]",
      f.narrow ? "R⊕" : "PLANET RADIUS [R⊕]",
    );
  } else if (projection === "time") {
    horizontalYear(ctx, f, ext.year, box, ay);
    // §6: the right side is the rule made visible. y here is a display spread,
    // so it gets a SHAPE AND A DISCLOSURE, never a scale — ticks would invent a
    // measurement that does not exist.
    bracket(ctx, f, top, ay, ax);
    axisTitles(ctx, ay, ax, top, "T // DISCOVERY YEAR", bracketCaption(ctx, ax - rect.l));
    if (x.cursor) timeCursor(ctx, f, ext.year, box, x.cursor);
  } else if (projection === "distance") {
    rings(ctx, f, ext.dist, box);
    // EARTH DISTANCE has no tapes — its index is the rings — so the only title
    // it can honestly carry is the radial one.
    axisTitles(ctx, ay, ax, top, null, "R // LOG DISTANCE [PC]");
    solMarker(ctx, f, box, "0 PC");
  } else {
    // SPATIAL.md supersedes PROJECTIONS.md §6.1 for this projection: the scale
    // is plotWidth / (48° · dist/2.75), which IS the camera's field width, and
    // the interval comes from a ladder rather than the scale changing. My
    // earlier reading — a constant px/deg — was the right instinct against the
    // wrong formula, and this file settles it.
    if (x.cam) {
      drawSkyTapes(ctx, box, ay, ax, x.cam, f.narrow, alpha, performance.now());
      drawAxisStubs(ctx, f, x.cam, alpha);
    }
    solMarker(ctx, f, box, "0 PC · ORIGIN OF THE TRANSFORM");
  }

  // §7: the cloud's annotation names the field that is actually missing, so it
  // belongs to the projection and not to a generic empty state.
  if (x.cloud) cloudAnnotation(ctx, f, x.cloud);

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

  void title; // drawn by axisTitles, under one rule for all four
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

  // The caption is this projection's y-axis label, so it takes the same
  // placement as every other one rather than running down the bracket, where it
  // crossed the ticks at some zooms and could not be read. The BRACKET still
  // carries the shape; the words are just legible now.
  return;
}

/** §6's caption, longest that fits the width the title slot allows. If none
 *  fits, none is drawn — the footer already says Y: DISPLAY DISTRIBUTION. */
function bracketCaption(ctx: CanvasRenderingContext2D, room: number): string | null {
  return (
    [
      "Y // DISPLAY SPREAD · NO DATA AXIS",
      "Y // DISPLAY SPREAD",
      "DISPLAY SPREAD",
      "SPREAD",
    ].find((s) => ctx.measureText(s).width <= room) ?? null
  );
}

/** §5.1: constant-distance loci. Under FIX.md #5 Option B they are drawn through
 *  the SAME anisotropic transform the points get, so a ring and the records on
 *  it coincide exactly — the points are placed at 0.5 + r·cos/sin in normalised
 *  space and then scaled by sx and sy independently, so a locus of constant
 *  distance IS an ellipse of ratio sy/sx on screen. A circle here was furniture
 *  disagreeing with the thing it measures. */
function rings(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  span: [number, number],
  env: Env,
): void {
  const cx = f.sx(0.5);
  const cy = f.sy(0.5);
  // The ring VALUES come from the data's domain, not the view's — §1.2's rule
  // that the domain tracks the whole archive. Zooming reveals and hides rings;
  // it never renames them.
  const drawn: number[] = [];
  const rNorm = (pc: number): number =>
    0.46 * logNorm(1 + pc, 1 + span[0], 1 + span[1]);

  for (const t of ringValues(span[0] + 1, span[1])) {
    const rn = rNorm(t.v);
    if (rn <= 0 || rn > 0.52) continue;
    const rx = Math.abs(f.sx(0.5 + rn) - cx);
    const ry = Math.abs(f.sy(0.5 + rn) - cy);
    if (rx < 8) continue;
    // §5.1's pitch guard: at low zoom the inner decades collapse, and a stack of
    // rings 3 px apart is a smudge that reads as noise rather than as a scale.
    if (drawn.length && rx - drawn[drawn.length - 1] < 26) continue;
    // "Never draw rings out to the fit rect" — furniture must not claim space
    // the data does not occupy.
    if (rx > (env.x1 - env.x0) * 0.75 + 26) break;
    drawn.push(rx);

    const label = ` ${t.v >= 1000 ? `${trim(t.v / 1000)} KPC` : `${tickLabel(t.v)} PC`} `;
    const gap = ctx.measureText(label).width + 14;
    // §5.1's label gap: no plates anywhere in this design, so the ring BREAKS
    // for its own label rather than being painted over. Every gap is on the same
    // bearing, so the breaks line up as one radial corridor and read as a
    // deliberate index line rather than as damage.
    const bearing = (-38 * Math.PI) / 180;
    // The gap is an angular span, and on an ellipse that span is not constant —
    // derive it from the arc length at the label's own bearing.
    const tangent = Math.hypot(rx * Math.sin(bearing), ry * Math.cos(bearing));
    const half = tangent > 1 ? gap / 2 / tangent : 0.2;

    ctx.strokeStyle = t.major ? "rgba(150,170,255,0.30)" : "rgba(150,170,255,0.16)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, bearing + half, bearing - half + Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx + rx * Math.cos(bearing), cy + ry * Math.sin(bearing));
    // Rotate to the ring's local tangent only when the tilt is worth it — below
    // 12 degrees a rotated label just looks like a mistake.
    const tilt = Math.atan2(ry * Math.cos(bearing), -rx * Math.sin(bearing));
    if (Math.abs(tilt) > (12 * Math.PI) / 180) ctx.rotate(tilt);
    ctx.fillStyle = TEXT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** §5.2 / §6.3: the one fixed point in the archive, and the only marker in
 *  section 2 that is not a record. An instrument origin, not a star. */
function solMarker(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  env: Env,
  sub: string,
): void {
  const x = f.sx(0.5);
  const y = f.sy(0.5);
  const inset = 22;
  if (
    x < env.x0 + inset ||
    x > env.x1 - inset ||
    y < env.y0 + inset ||
    y > env.y1 - inset
  ) {
    offscreenArrow(ctx, env, x, y);
    return;
  }

  // Every number here is a SCREEN pixel at every zoom. A marker that grows is a
  // data point; a marker that holds is an instrument.
  ctx.fillStyle = "#e8eaf5";
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(232,234,245,0.55)";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = LINE;
  ctx.beginPath();
  for (const a of [45, 135, 225, 315]) {
    const r = (a * Math.PI) / 180;
    ctx.moveTo(x + Math.cos(r) * 10, y + Math.sin(r) * 10);
    ctx.lineTo(x + Math.cos(r) * 15, y + Math.sin(r) * 15);
  }
  ctx.stroke();

  // Flip rather than overflow: the label leaving the box would be the marker
  // damaging the frame it is the origin of.
  const flip = x + 14 + 110 > env.x1;
  const lx = flip ? x - 14 : x + 14;
  tracked(ctx, "OBSERVER // SOL", lx, y + 4, TEXT, flip);
  ctx.textAlign = flip ? "right" : "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(150,170,255,0.30)";
  ctx.fillText(sub, lx, y + 17);
  ctx.textAlign = "left";
}

/** §5.3: pan the origin off frame and a radial projection loses the thing that
 *  makes it readable, so the origin gets an edge indicator. The same code runs
 *  in SPATIAL (§6.4). */
function offscreenArrow(
  ctx: CanvasRenderingContext2D,
  env: Env,
  sx: number,
  sy: number,
): void {
  const inset = 22;
  const cx = (env.x0 + env.x1) / 2;
  const cy = (env.y0 + env.y1) / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  if (!dx && !dy) return;
  // Sit on the segment from the box centre to SOL, clamped to the inner rect —
  // so the chevron lands on the edge NEAREST the origin rather than on a corner
  // chosen by whichever axis overflowed first.
  const kx = dx !== 0 ? (env.x1 - env.x0) / 2 / Math.abs(dx) : Infinity;
  const ky = dy !== 0 ? (env.y1 - env.y0) / 2 / Math.abs(dy) : Infinity;
  const k = Math.min(kx, ky, 1);
  const ax = clamp(cx + dx * k, env.x0 + inset, env.x1 - inset);
  const ay = clamp(cy + dy * k, env.y0 + inset, env.y1 - inset);
  const bearing = Math.atan2(dy, dx);
  solArrow = { x: ax, y: ay };

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(bearing);
  ctx.strokeStyle = "rgba(232,234,245,0.72)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.lineTo(0, 0);
  ctx.lineTo(-9, 9);
  ctx.stroke();
  // A tail, not a second chevron: it reads as direction rather than as a cursor.
  ctx.globalAlpha *= 0.3;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(-23, 0);
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 1;

  ctx.fillStyle = TEXT;
  ctx.textAlign = dx > 0 ? "right" : "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    " OBSERVER // SOL ",
    clamp(ax - Math.cos(bearing) * 13, env.x0 + 4, env.x1 - 4),
    clamp(ay - Math.sin(bearing) * 13, env.y0 + 6, env.y1 - 6),
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/** §2's wide tracking, drawn per character because canvas has no letter-spacing.
 *  Only used where the spec asks for it — every other label is set solid. */
function tracked(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  fill: string,
  rtl: boolean,
): void {
  ctx.fillStyle = fill;
  const sp = 1.33; // .14em at 9.5px
  const w = ctx.measureText(s).width + sp * (s.length - 1);
  let cx = rtl ? x - w : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const ch of s) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
  ctx.textAlign = prev;
}

/** §3's two references. Both are lines the reader already knows — Earth's radius
 *  and Earth's year — which is why the cloud's shape is legible at a glance. A
 *  grid would have said less and cost more ink. */
function orbitReferences(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  ext: Extent,
  env: Env,
): void {
  ctx.strokeStyle = "rgba(150,170,255,0.10)";
  ctx.fillStyle = DIM;
  ctx.textBaseline = "middle";

  const yr = f.sy(1 - logNorm(1, ext.rade[0], ext.rade[1]));
  if (yr > env.y0 && yr < env.y1) {
    ctx.beginPath();
    ctx.moveTo(env.x0, yr);
    ctx.lineTo(env.x1, yr);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillText(" 1 R⊕ ", env.x0 + 2, yr - 6);
  }

  const xr = f.sx(logNorm(365.25, ext.orbper[0], ext.orbper[1]));
  if (xr > env.x0 && xr < env.x1) {
    ctx.beginPath();
    ctx.moveTo(xr, env.y0);
    ctx.lineTo(xr, env.y1);
    ctx.stroke();
    ctx.save();
    ctx.translate(xr + 3, env.y0 + 4);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = "left";
    ctx.fillText(" 1 YR ", 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";
}

/** §4's target cursor. A vertical line at the target's own year — the one place
 *  in DISCOVERY TIME where a screen position is a measurement, so it is the only
 *  thing allowed to point at the horizontal axis. */
function timeCursor(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  span: [number, number],
  env: Env,
  cur: { year: number; locked: boolean },
): void {
  const x = f.sx(linNorm(cur.year, span[0], span[1]));
  if (x < env.x0 || x > env.x1) return;
  ctx.save();
  if (cur.locked) {
    ctx.strokeStyle = "rgba(214,224,255,0.55)";
  } else {
    ctx.strokeStyle = "rgba(150,170,255,0.40)";
    ctx.setLineDash([3, 4]);
  }
  ctx.beginPath();
  ctx.moveTo(x, env.y0);
  ctx.lineTo(x, env.y1);
  ctx.stroke();
  ctx.restore();

  if (cur.locked) {
    ctx.fillStyle = "#e6e9fb";
    ctx.beginPath();
    ctx.moveTo(x, env.y1 - 9);
    ctx.lineTo(x - 4.5, env.y1);
    ctx.lineTo(x + 4.5, env.y1);
    ctx.closePath();
    ctx.fill();
  }

  const label = `DISCOVERED // ${Math.round(cur.year)}`;
  const w = ctx.measureText(label).width;
  ctx.fillStyle = TEXT;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  // Clamped inside the tape's span: a label that runs past the axis is claiming
  // a year the axis does not show.
  ctx.fillText(label, clamp(x + 5, env.x0, env.x1 - w), env.y0 + 2);
  ctx.textBaseline = "alphabetic";
}

/** §7's disclosure. Two lines, and the first names the ACTUAL missing field —
 *  never a generic "no data", because which value is absent is the finding. */
function cloudAnnotation(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  cloud: { label: string; count: number; frame: { cx: number; rx: number; ry: number } },
): void {
  // BENEATH the ellipse, centred on it, rather than floating off its left edge.
  // Beside it, the two lines read as a label for whatever they happened to sit
  // next to — which at some zooms was the scientific region. Under the boundary
  // they can only be about the thing they are under.
  const left = f.sx(cloud.frame.cx);
  const y = f.sy(0.5) + Math.abs(f.sy(cloud.frame.ry) - f.sy(0)) + 18;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = TEXT;
  ctx.fillText("UNRESOLVED", left, y - 7);
  ctx.fillStyle = "rgba(150,170,255,0.30)";
  // §7's disclosure survives as the detail line: which field is absent is the
  // finding, and "no data" would throw away the only interesting part of it.
  ctx.fillText(
    `NO ${cloud.label.toUpperCase()} · ${cloud.count.toLocaleString("en-AU")} RECORDS`,
    left,
    y + 7,
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// Screen → normalised, via the inverses the frame was built with.
const invX = (f: Frame, px: number): number => f.inv.x(px);
const invY = (f: Frame, py: number): number => f.inv.y(py);
