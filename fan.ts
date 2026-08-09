// The scout-trail fan: a six-band V, generated not drawn. See STRIPE.md —
// change W/H/N/P and regenerate; never hand-tune the path numbers below.

export const FAN_COLORS = [
  "#8A1538", // 0 outermost — deep maroon
  "#E86132", // 1 orange
  "#D11F3A", // 2 red
  "#345587", // 3 slate blue
  "#D9A83E", // 4 gold
  "#F1F1EE", // 5 apex — bone white
];

export interface FanBand {
  d: string;
  fill: string;
}

// flip=true anchors the wide spread at the bottom edge (y=H) and the apex
// near the top (y=0) — the hero's "scout trail" orientation, rising to a
// point above the title. flip=false is STRIPE.md's plain default (apex at
// the bottom), used where the fan continues behind later content.
export function fanBands(
  W = 1600,
  H = 1000,
  N = 6,
  P = 1.1,
  flip = false,
): FanBand[] {
  const cx = W / 2;
  const edge = flip ? H : 0;
  const b = Array.from({ length: N + 1 }, (_, k) => {
    const w = cx * Math.pow(1 - k / N, P);
    const y = (H / cx) * w;
    return { w, x: cx - w, y: flip ? H - y : y };
  });
  return b.slice(0, N).map((o, k) => {
    const i = b[k + 1];
    const d =
      k === N - 1
        ? `M${o.x} ${edge} L${cx} ${o.y} L${W - o.x} ${edge} Z`
        : `M${o.x} ${edge} L${cx} ${o.y} L${W - o.x} ${edge} L${W - i.x} ${edge} L${cx} ${i.y} L${i.x} ${edge} Z`;
    return { d, fill: FAN_COLORS[k] };
  });
}
