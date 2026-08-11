// INTERACTION.md — the input grammar and the view state it moves.
//
// §1's three verbs, each keeping its meaning everywhere: hover previews, click
// locks, drag moves the VIEW and never the data. §9 is the rule under all of
// it — motion either explains a change or it is noise.
//
// The view lives here rather than in field.ts because FIELD.md §3 requires each
// projection to keep its OWN pan/zoom: "switching away and back returns to the
// frame you left it in". One shared view would quietly discard that.

import type { Projection } from "./data";

export interface View {
  cx: number;
  cy: number;
  zoom: number;
}

/** §3's one curve. "Values change instantly; frames change with mass." */
export const easeInOut = (p: number): number =>
  p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;

export const reduceMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** §3's transition table, in one place so the documents can reference rather
 *  than restate — which is what stops two of them drifting apart. */
export const MS = {
  morph: 900,
  centre: 650,
  dive: 720,
  approach: 1150,
  exit: 560,
  orbitScale: 600,
} as const;

/** §1's hit radii. Hover is generous because scanning should be easy; click is
 *  tighter because committing should be deliberate. */
export const HIT = { hover: 18, click: 16 } as const;

/** ONE zoom range for all four projections.
 *
 *  The 2D views were clamped to [1, 6] — 1 being "fitted", so they could not
 *  zoom OUT at all — while SPATIAL dollied 1.25→7 in distance, which is a
 *  factor of 2.2 in and 0.39 out. Three projections that stopped where the
 *  fourth kept going is the field contradicting itself about what zoom means.
 *
 *  SPATIAL's dolly is expressed as the same number: dist = 2.75 / zoom, so the
 *  reference dolly IS zoom 1 and both ends match by construction. This widens
 *  SPATIAL.md §6's clamp of [1.25, 7]; the author asked for parity explicitly
 *  and parity is not reachable while one projection keeps its own bounds. */
export const ZOOM = { min: 0.4, max: 6 } as const;

/** Zoom 1 means "fitted" in the 2D projections, so it must mean fitted in
 *  SPATIAL too — and SPATIAL's fitted distance is DERIVED FROM THE ARCHIVE
 *  (fitCameraDist), not the spec's nominal 2.75. Measured: this archive fits at
 *  ~29.8, so clamping the dolly around 2.75 snapped the first wheel click
 *  inward by 4x and then buried the camera inside the cloud. The reference is
 *  set once at load, and everything asking "how far out are we, relative to
 *  fitted" reads it — the tape's px/deg included. */
let refDist = 2.75;
export const setReferenceDist = (d: number): void => void (refDist = d);
export const referenceDist = (): number => refDist;
/** Wrap to (−π, π]. SPATIAL's pitch is now a full rotation, so the raw value
 *  would otherwise grow without bound across a long drag and lose precision. */
export const wrapPi = (a: number): number => {
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
};

export const distForZoom = (zoom: number): number => refDist / zoom;

const defaults = (fitRight: number): View => ({
  cx: fitRight / 2,
  cy: 0.5,
  zoom: 1,
});

// FIX.md #7b, an INTENT CHANGE that supersedes FIELD.md §3's "each projection
// keeps its own pan/zoom": ONE view, shared across projections. A projection
// change is a change of representation, not of camera, and swapping the view
// underneath the user was the camera being taken away from them.
let shared: View | null = null;

export function viewFor(_p: Projection, fitRight: number): View {
  if (!shared) shared = defaults(fitRight);
  return shared;
}

export function resetView(_p: Projection, fitRight: number): View {
  shared = defaults(fitRight);
  return shared;
}

/** #7b: when the fit rect differs between projections, CLAMP the existing view
 *  into the new rect rather than interpolating toward its centre. "A clamp is a
 *  correction, an interpolation is a hijack." */
export function clampView(v: View, fitRight: number): void {
  const half = fitRight / (2 * v.zoom);
  v.cx = Math.min(fitRight - half, Math.max(half, v.cx));
  const halfY = 1 / (2 * v.zoom);
  v.cy = Math.min(1 - halfY, Math.max(halfY, v.cy));
}

export interface Mapping {
  sx: (x: number) => number;
  sy: (y: number) => number;
  ix: (px: number) => number;
  iy: (py: number) => number;
}

/** The one place normalised space becomes pixels. Both directions are built
 *  together so they cannot drift — the same reason AXES.md §1 makes the tape
 *  import the inverse rather than write its own. */
export function mapping(
  v: View,
  w: number,
  h: number,
  pad: number,
  fitRight: number,
): Mapping {
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  return {
    sx: (x) => pad + iw * (0.5 + ((x - v.cx) * v.zoom) / fitRight),
    sy: (y) => pad + ih * (0.5 + (y - v.cy) * v.zoom),
    ix: (px) => v.cx + ((px - pad) / iw - 0.5) * (fitRight / v.zoom),
    iy: (py) => v.cy + ((py - pad) / ih - 0.5) / v.zoom,
  };
}

/** FIELD.md §3: zoom is anchored at the cursor — the world point under the
 *  pointer is re-solved and cx,cy set so it stays put. Zooming that drifts the
 *  thing you are pointing at is the single most disorienting thing a field can
 *  do. */
export function zoomAt(
  v: View,
  deltaY: number,
  px: number,
  py: number,
  w: number,
  h: number,
  pad: number,
  fitRight: number,
): void {
  const before = mapping(v, w, h, pad, fitRight);
  const wx = before.ix(px);
  const wy = before.iy(py);
  v.zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, v.zoom * Math.exp(-deltaY * 0.0015)));
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  v.cx = wx - ((px - pad) / iw - 0.5) * (fitRight / v.zoom);
  v.cy = wy - ((py - pad) / ih - 0.5) / v.zoom;
}
