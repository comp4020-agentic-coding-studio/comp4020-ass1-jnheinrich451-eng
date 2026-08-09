// The scout-trail fan — the site's one recurring graphic device, in two
// geometries. See STRIPE.md. Both are generated; never hand-tune path numbers.
//
//   heroTrails() — page 1 (§A): curved trails launched from the top edge as a
//                  tight near-vertical bundle, flaring to full width at the
//                  bottom. 12 paths, 6 per side, mirrored about the centre.
//   fanBands()   — page 2 (§B): the straight-line continuation. The trails have
//                  landed: a shared apex at (cx, H), spread across the TOP edge
//                  at exactly the x-values heroTrails() leaves at the bottom, so
//                  the two sections meet at the seam with no interpolation.

export const FAN_COLORS_OUT_TO_IN = [
  "#8A1538", // 0 outermost — deep maroon
  "#E86132", // 1 orange
  "#D11F3A", // 2 red
  "#345587", // 3 slate blue
  "#D9A83E", // 4 gold
  "#F1F1EE", // 5 centre — bone white
];

export interface FanBand {
  d: string;
  fill: string;
}

type Point = readonly [number, number];
type Cubic = readonly [Point, Point, Point, Point];

const n2 = (v: number) => Number(v.toFixed(2));

// ---------------------------------------------------------------------------
// §A — hero: curved trails
// ---------------------------------------------------------------------------

// Boundaries are indexed CENTRE-OUT: k=0 is the centre line, k=N the outermost
// trail edge. STRIPE.md §A.2 prints bottom_k with the exponent on (1 − k/N),
// which reverses the k ordering and contradicts both its own §A.4 table and
// §A.3's "0 = centre white". The table, the fill index in §A.5, and page 2's
// seam all agree on (k/N)^P, so that is what this uses.
//
// x(u) is exactly a cubic in u and y(u) is exactly linear in u, so each boundary
// is one exact cubic Bézier — no sampling, no polyline, no approximation error.
function heroBoundary(
  k: number,
  W: number,
  H: number,
  N: number,
  P: number,
  GAP: number,
  OV: number,
): Cubic {
  const cx = W / 2;
  const top = cx - GAP * k;
  const bottom = cx - cx * Math.pow(k / N, P);
  // Write x_k(u) = top_k + D_k*B(u) with D_k = bottom_k - top_k. Since top
  // spacing is the uniform GAP, the band gap is gap(u) = GAP + dD_k*B(u), so:
  //
  //   gap'(0)  = dD_k * B'(0)   -> zero iff B'(0)  = 0   (parallel at the top)
  //   gap''(0) = dD_k * B''(0)  -> zero iff B''(0) = 0   (CONSTANT THICKNESS)
  //
  // For the cubic Bézier, B'(0) = 3*p1 and B''(0) = 6*p2 - 12*p1, so both
  // conditions together force p1 = p2 = 0 and B(u) = u^3 exactly. p1 = 0 alone
  // made the boundaries parallel but left the bands thickening quadratically
  // from the very top; killing p2 as well is what holds their width.
  //
  // This is a shared easing, which STRIPE.md §A.2.1 warns reads as "a striped
  // curtain instead of a wake" — but that failure needs the bands to widen at
  // the SAME rate, and they do not: dD_k comes from the power-law bottom spread,
  // so each band still opens by its own amount. Both of §A.2.1's checks hold
  // exactly, and its 1:9.5 / 1:12.5 ratios are just GAP : bottom-spread.
  const p1 = 0;
  const p2 = 0;
  const y = (u: number) => u * (H + OV) - OV; // u=0 at y=−OV, u=1 at y=H
  const x = (b: number) => top + (bottom - top) * b;
  return [
    [top, y(0)],
    [x(p1), y(1 / 3)],
    [x(p2), y(2 / 3)],
    [bottom, y(1)],
  ];
}

const down = (c: Cubic) =>
  `C${n2(c[1][0])} ${n2(c[1][1])} ${n2(c[2][0])} ${n2(c[2][1])} ${n2(c[3][0])} ${n2(c[3][1])}`;

// The same curve traversed bottom-to-top: a Bézier reverses by swapping its
// two control points and ending at P0.
const up = (c: Cubic) =>
  `C${n2(c[2][0])} ${n2(c[2][1])} ${n2(c[1][0])} ${n2(c[1][1])} ${n2(c[0][0])} ${n2(c[0][1])}`;

const mirror = (c: Cubic, W: number): Cubic => [
  [W - c[0][0], c[0][1]],
  [W - c[1][0], c[1][1]],
  [W - c[2][0], c[2][1]],
  [W - c[3][0], c[3][1]],
];

// Returned outermost-first, each band as a (left, right) pair — 2N paths.
export function heroTrails(
  W = 1600,
  H = 1000,
  N = 6,
  P = 1.1,
  GAP = 70 / 6,
  OV = 40,
): FanBand[] {
  const boundaries = Array.from({ length: N + 1 }, (_, k) =>
    heroBoundary(k, W, H, N, P, GAP, OV),
  );
  const bands: FanBand[] = [];
  for (let k = N - 1; k >= 0; k--) {
    const fill = FAN_COLORS_OUT_TO_IN[N - 1 - k];

    // Boundary 0 is x = cx at every u (top = cx − GAP·0, bottom = cx − cx·0^P),
    // so it is its own mirror. The centre band is therefore ONE region, and
    // splitting it at cx like the others invents an edge that isn't a boundary.
    // Two independently antialiased fills meeting on a shared edge each cover
    // ~50% of the pixel that edge crosses and composite to ~75%, not 100% — a
    // 1px dark seam down the brightest band. It only shows when cx misses a
    // whole device pixel: the fan spans the viewport, so the edge sits at
    // width/2, which is integral on a DPR-2 display (device width is always
    // even) and half-integral at DPR 1 on an odd width or at 125%/150% scaling.
    // Measured at 1919×1080: lum 157 against 206 either side; 1920 was flat.
    // Page 2 never had this because fanBands() already emits its centre band as
    // one spanning triangle.
    if (k === 0) {
      const l = boundaries[1];
      const r = mirror(boundaries[1], W);
      bands.push({
        d:
          `M${n2(l[0][0])} ${n2(l[0][1])} ${down(l)} ` +
          `L${n2(r[3][0])} ${n2(r[3][1])} ${up(r)} Z`,
        fill,
      });
      continue;
    }

    for (const half of [
      { inner: boundaries[k], outer: boundaries[k + 1] },
      { inner: mirror(boundaries[k], W), outer: mirror(boundaries[k + 1], W) },
    ]) {
      const { inner, outer } = half;
      const d =
        `M${n2(inner[0][0])} ${n2(inner[0][1])} ${down(inner)} ` +
        `L${n2(outer[3][0])} ${n2(outer[3][1])} ${up(outer)} Z`;
      bands.push({ d, fill });
    }
  }
  return bands;
}

// ---------------------------------------------------------------------------
// §B — observatory: straight continuation
// ---------------------------------------------------------------------------

// Every boundary is a straight line from the top edge to a shared apex at
// (cx, H): the wake has become a V. x_k here equals heroTrails()'s bottom
// anchor for boundary N−k, which is what makes the page seam exact.
export function fanBands(W = 1600, H = 1000, N = 6, P = 1.1): FanBand[] {
  const cx = W / 2;
  const b = Array.from({ length: N + 1 }, (_, k) => {
    const w = cx * Math.pow(1 - k / N, P);
    return { x: cx - w, y: (H / cx) * w };
  });
  return b.slice(0, N).map((o, k) => {
    const i = b[k + 1];
    const d =
      k === N - 1
        ? `M${n2(o.x)} 0 L${cx} ${n2(o.y)} L${n2(W - o.x)} 0 Z`
        : `M${n2(o.x)} 0 L${cx} ${n2(o.y)} L${n2(W - o.x)} 0 L${n2(W - i.x)} 0 L${cx} ${n2(i.y)} L${n2(i.x)} 0 Z`;
    return { d, fill: FAN_COLORS_OUT_TO_IN[k] };
  });
}
