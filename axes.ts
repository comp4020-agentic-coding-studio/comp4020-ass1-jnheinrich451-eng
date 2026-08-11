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
  cloud: { label: string; count: number } | null;
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
  } else if (projection === "time") {
    horizontalYear(ctx, f, ext.year, box, ay);
    // §6: the right side is the rule made visible. y here is a display spread,
    // so it gets a SHAPE AND A DISCLOSURE, never a scale — ticks would invent a
    // measurement that does not exist.
    bracket(ctx, f, top, ay, ax);
    if (x.cursor) timeCursor(ctx, f, ext.year, box, x.cursor);
  } else if (projection === "distance") {
    rings(ctx, f, ext.dist, box);
    solMarker(ctx, f, box, "0 PC");
  } else {
    raDecStrips(ctx, f, box, ay, ax, x.cam);
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

  const yr = f.sy(1 - (0.06 + 0.88 * logNorm(1, ext.rade[0], ext.rade[1])));
  if (yr > env.y0 && yr < env.y1) {
    ctx.beginPath();
    ctx.moveTo(env.x0, yr);
    ctx.lineTo(env.x1, yr);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillText(" 1 R⊕ ", env.x0 + 2, yr - 6);
  }

  const xr = f.sx(0.06 + 0.88 * logNorm(365.25, ext.orbper[0], ext.orbper[1]));
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
  const x = f.sx(0.06 + 0.88 * linNorm(cur.year, span[0], span[1]));
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
  cloud: { label: string; count: number },
): void {
  const left = f.sx(1.15) - Math.abs(f.sx(0.072) - f.sx(0)) - 12;
  const y = f.sy(0.5);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = TEXT;
  ctx.fillText(cloud.label.toUpperCase(), left, y - 7);
  ctx.fillStyle = "rgba(150,170,255,0.30)";
  ctx.fillText(`${cloud.count.toLocaleString("en-AU")} RECORDS`, left, y + 7);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** §6.1: NOT fitted tapes. A heading tape has a constant scale or it is not a
 *  heading tape (EFFECT.md §2.3) — so these read the CAMERA, tick at a fixed
 *  px/deg, and run off both ends rather than fitting the data. This is the index
 *  SPATIAL had no version of at all: two lines and two titles, with nothing on
 *  them to read. */
function raDecStrips(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  env: Env,
  ay: number,
  ax: number,
  cam: Camera | null,
): void {
  void f;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(env.x0, ay);
  ctx.lineTo(env.x1, ay);
  ctx.moveTo(ax, env.y0);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  if (cam) {
    // §6.1's 2.4 px/deg is "the whole sky across the strip": 360 × 2.4 = 864 px,
    // which is the plot's own width at the reference layout. So the scale is
    // derived from the span rather than pinned to a constant that would be
    // wrong at every other viewport.
    //
    // It does NOT scale with the dolly. Reading "scaled with the camera's field
    // width" as 2.4 × (2.75 / dist) gave 0.33 px/deg at the archive's actual
    // fitted distance — ticks every 3 px and labels in a solid smear. §6.1's own
    // headline is the tiebreak: a heading tape has a CONSTANT scale or it is not
    // a heading tape. A tape that rescaled on the wheel would be a data axis.
    const pxDeg = clamp((env.x1 - env.x0) / 360, 1.8, 4);
    const midX = (env.x0 + env.x1) / 2;
    const midY = (env.y0 + ay) / 2;
    const yawDeg = (cam.yaw * 180) / Math.PI;
    const pitchDeg = (cam.pitch * 180) / Math.PI;
    const spanX = (env.x1 - env.x0) / 2 / pxDeg + 30;

    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    // Cyclic: emitted in an UNWRAPPED space and labelled mod 360, so the strip
    // has no beginning and no end. Wrapping the positions instead would put a
    // seam in the sky at whatever angle happened to be zero.
    const from = Math.ceil((yawDeg - spanX) / 10) * 10;
    let lastRaLabel = -Infinity;
    for (let d = from; d <= yawDeg + spanX; d += 10) {
      const x = midX + (d - yawDeg) * pxDeg;
      if (x < env.x0 || x > env.x1) continue;
      const major = ((d % 30) + 30) % 30 === 0;
      // §6.1's fade zones: the outer 24 px go to nothing, so ticks arrive and
      // leave rather than popping at the ends of the strip.
      const edge = Math.min(x - env.x0, env.x1 - x);
      ctx.save();
      ctx.globalAlpha *= clamp(edge / 24, 0, 1);
      ctx.strokeStyle = major ? LINE : DIM;
      ctx.beginPath();
      ctx.moveTo(x, ay);
      ctx.lineTo(x, ay + (major ? 8 : 4));
      ctx.stroke();
      // §2's collision guard applies here too. It is belt and braces against the
      // pitch — but the smear that got through was a scale error, and a guard
      // that would have caught it regardless is worth its four lines.
      if (major && x - lastRaLabel >= 46) {
        // Hours, not degrees. RA is an hour angle, and printing it in degrees
        // would be the axis quietly changing units on the reader.
        const h = Math.round((((d % 360) + 360) % 360) / 15) % 24;
        ctx.fillStyle = TEXT;
        ctx.fillText(`${h}h`, x, ay + 10);
        lastRaLabel = x;
      }
      ctx.restore();
    }

    ctx.textAlign = "left";
    for (let d = -90; d <= 90; d += 10) {
      const y = midY - (d - pitchDeg) * pxDeg;
      if (y < env.y0 || y > ay) continue;
      const major = d % 30 === 0;
      const edge = Math.min(y - env.y0, ay - y);
      ctx.save();
      ctx.globalAlpha *= clamp(edge / 24, 0, 1);
      ctx.strokeStyle = major ? LINE : DIM;
      ctx.beginPath();
      ctx.moveTo(ax, y);
      ctx.lineTo(ax + (major ? 8 : 4), y);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = TEXT;
        ctx.textBaseline = "middle";
        ctx.fillText(`${d > 0 ? "+" : ""}${d}`, ax + 12, y);
        ctx.textBaseline = "top";
      }
      ctx.restore();
    }

    // The caret is the aiming reticle: FIXED at the strip's centre with a live
    // readout under it, so rotating flips the index past a stationary mark
    // rather than sliding a mark along a stationary index. That inversion is
    // the whole difference between a heading tape and a data axis.
    ctx.fillStyle = "#e6e9fb";
    ctx.beginPath();
    ctx.moveTo(midX, ay - 9);
    ctx.lineTo(midX - 4.5, ay - 1);
    ctx.lineTo(midX + 4.5, ay - 1);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const hh = (((yawDeg % 360) + 360) % 360) / 15;
    const mm = Math.floor((hh % 1) * 60);
    ctx.fillText(
      `${Math.floor(hh).toString().padStart(2, "0")}h ${mm.toString().padStart(2, "0")}m`,
      midX,
      ay - 12,
    );

    ctx.beginPath();
    ctx.moveTo(ax + 9, midY);
    ctx.lineTo(ax + 1, midY - 4.5);
    ctx.lineTo(ax + 1, midY + 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${pitchDeg >= 0 ? "+" : ""}${pitchDeg.toFixed(1)}°`, ax - 5, midY);
  }

  ctx.fillStyle = DIM;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("RA // HOURS", env.x1, ay - 4);
  ctx.save();
  ctx.translate(ax - 4, env.y0);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = "left";
  ctx.fillText("DEC // DEGREES", 0, 0);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// Screen → normalised, via the inverses the frame was built with.
const invX = (f: Frame, px: number): number => f.inv.x(px);
const invY = (f: Frame, py: number): number => f.inv.y(py);
