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

const defaults = (fitRight: number): View => ({
  cx: fitRight / 2,
  cy: 0.5,
  zoom: 1,
});

const views = new Map<Projection, View>();

export function viewFor(p: Projection, fitRight: number): View {
  let v = views.get(p);
  if (!v) {
    v = defaults(fitRight);
    views.set(p, v);
  }
  return v;
}

export function resetView(p: Projection, fitRight: number): View {
  const v = defaults(fitRight);
  views.set(p, v);
  return v;
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
  v.zoom = Math.min(6, Math.max(1, v.zoom * Math.exp(-deltaY * 0.0015)));
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  v.cx = wx - ((px - pad) / iw - 0.5) * (fitRight / v.zoom);
  v.cy = wy - ((py - pad) / ih - 0.5) / v.zoom;
}
