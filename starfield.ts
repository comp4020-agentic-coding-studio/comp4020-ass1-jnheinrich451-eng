// The observatory's static star field — STARFIELD.md §B. Positions are seeded
// once at author time and written into the markup, so the sky is identical on
// every visit: it is part of the layout, not an effect. Regenerate with
// `node --experimental-strip-types scripts/gen-stars.mts` if the ranges change.

export interface StaticStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  dur: number;
  delay: number;
}

// mulberry32 — small, fast, and deterministic, which is the whole point here.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STAR_VIEWBOX = { w: 1600, h: 1000 } as const;

// The two black triangles the fan does not cover, in fan coordinates:
//   left  M0 0 L800 1000 L0 1000 Z      → x < 0.8·y
//   right M1600 0 L800 1000 L1600 1000 Z → x > 1600 − 0.8·y
// A star on a stripe reads as dirt, so we only ever place them in here. The
// clipPath in the markup enforces the same boundary at render time — this is
// belt and braces, and it also means no star is wasted behind the fan.
export function inFanGround(x: number, y: number): boolean {
  const { w, h } = STAR_VIEWBOX;
  const slope = (w / 2) / h;
  return x < slope * y || x > w - slope * y;
}

export function observatoryStars(count = 190, seed = 0x5eed1a3f): StaticStar[] {
  const rng = mulberry32(seed);
  const round = (v: number, dp: number) => Number(v.toFixed(dp));
  const stars: StaticStar[] = [];
  // Rejection sampling: uniform over the two triangles, which is what keeps the
  // density even. Bounded by the count, so it always terminates.
  while (stars.length < count) {
    const x = rng() * STAR_VIEWBOX.w;
    const y = rng() * STAR_VIEWBOX.h;
    if (!inFanGround(x, y)) continue;
    stars.push({
      cx: round(x, 1),
      cy: round(y, 1),
      r: round(0.39 + rng() * (1.18 - 0.39), 2),
      opacity: round(0.25 + rng() * (0.75 - 0.25), 2),
      dur: round(2.61 + rng() * (6.97 - 2.61), 2),
      // Delays span wider than the longest duration so the field never phases
      // together into a single blink.
      delay: round(0.01 + rng() * (5.94 - 0.01), 2),
    });
  }
  return stars;
}

export function staticStarMarkup(stars: StaticStar[]): string {
  return stars
    .map(
      (s) =>
        `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" opacity="${s.opacity}" ` +
        `style="animation-duration:${s.dur}s;animation-delay:${s.delay}s" />`,
    )
    .join("\n");
}
