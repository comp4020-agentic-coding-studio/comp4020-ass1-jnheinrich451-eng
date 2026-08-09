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
  // p1 is the FIRST control value, so B'(0) = 3*p1 sets the tangent at the top.
  // STRIPE.md §A.2 gives p1 = -0.11 + 0.022k, but its own prose says "near the
  // top every trail is almost vertical (dx/dy ~ 0)" — and a non-zero p1 makes
  // dx/dy non-zero there, so adjacent boundaries diverge LINEARLY in u and the
  // bundle visibly fans out at the top. p1 = 0 is what the prose actually
  // describes: every boundary leaves the top edge vertical, so the gap between
  // neighbours changes only quadratically and the four middle bands read as
  // parallel. The flare is unchanged — p2 still owns it.
  const p1 = 0;
  const p2 = 0.315 - 0.053 * k; // late release into the flare
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
