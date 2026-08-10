# STRIPE.md — the scout-trail fan

The one recurring graphic device. It appears twice, as the same six colours in
the same order, but with two different geometries:

- **A. Hero (page 1)** — curved scout trails, launched from the centre of the
  top edge and flaring outward as they fall. This is the primary artwork.
- **B. Observatory (page 2)** — the straight-edged continuation, so the colour
  boundaries land where the hero's trails left the page seam.

Both are **generated, not drawn**. Never hand-tune path numbers.

---

## 0. Colours — outer → central (fixed)

```ts
export const FAN_COLORS_OUT_TO_IN = [
  '#8A1538', // deep maroon — outermost trail
  '#E86132', // orange
  '#D11F3A', // red
  '#345587', // slate blue — the only cool band; reads as "instrument"
  '#D9A83E', // gold
  '#F1F1EE', // bone white — centre; also the active-HUD accent
];
```

Mirrored about the centre line, so the full left→right order is
maroon · orange · red · slate · gold · **white | white** · gold · slate · red ·
orange · maroon.

Grounds: `#000000` behind the hero fan, `#04050a` hero section, `#070812`
observatory section, `#03040a` plot field. No other background colours.

Trail-head streaks (the moving scout ships, not the fan): core gradient
`#ff3b55 → #ffb765 38% → #ffe89a 60% → #a9e8ff`, glow
`rgba(199,33,56,.55) → rgba(255,217,102,.6) → rgba(129,216,255,.55)`.

---

## A. Hero fan — curved trails

### A.1 Parameters

```ts
const W = 1600, H = 1000;   // viewBox units, preserveAspectRatio="none"
const cx = W / 2;           // 800 — launch point, centre of the top edge
const N = 6;                // bands per side
const P = 1.1;              // bottom flare exponent (shared with page 2)
const TOP_GAP = 11.667;     // = 70/6 — even boundary spacing at the top edge
const OVERSHOOT = 40;       // curves start at y = −40 so nothing reads as flat
```

### A.2 Formula

Each boundary `k = 0 … N` runs from a **top anchor** (evenly spaced — the
trails leave the launch point as a tight parallel bundle) to a **bottom anchor**
(power-law spread — the same values page 2 continues from):

```
top_k    = cx − TOP_GAP · k                      // 800, 788.33, … 741.67
bottom_k = cx − cx · (1 − k/N)^P                 // 0, 145.38, … 800  (see A.4)
```

Between them, x eases as a **cubic Bézier in u**, where `u` is normalised depth:

```
u        = (y + OVERSHOOT) / (H + OVERSHOOT)         // 0 at y=−40, 1 at y=H
B_k(u)   = 3·p1_k·u·(1−u)² + 3·p2_k·u²·(1−u) + u³
x_k(y)   = top_k + (bottom_k − top_k) · B_k(u)

p1_k = −0.11  + 0.022·k     // slight negative hold: the trail leaves vertical
p2_k =  0.315 − 0.053·k     // late release into the flare
```

The two control values are what make the bundle read as *launched*: near the top
every trail is almost vertical (`dx/dy ≈ 0`), and the spread happens in the
bottom third. Inner trails (`k` small) hold longer than outer ones, so the
bundle opens like a wake rather than a uniform cone.

Single-parameter approximation, if you'd rather not carry control points:

```
x_k(y) ≈ top_k + (bottom_k − top_k) · u^q_k ,   q_k = 2.23 + 0.12·k
```

Slightly tighter near the top; visually close, ~1.5 units off at mid-height.

### A.2.1 The boundaries are not parallel — and must not be

The single most common reconstruction error is treating the trails as a parallel bundle that bends as a unit. They are not: top spacing is uniform, bottom spacing is a power law, and every boundary carries its own easing. Adjacent boundaries start 11.667 units apart at y = −40 and end anywhere from 111.46 (k=0→1) to 145.38 (k=5→6) apart at y = H — so band width is near-constant at the top and grows toward the outside at the bottom. On top of that, p1_k and p2_k shift with k, so the inner trails hold vertical longer than the outer ones; if you apply one shared easing curve to all six, the bands stay parallel and the whole thing reads as a striped curtain instead of a wake. 

Two checks: 

(1) measure band width at y = 0 and at y = H — the ratio should be about 1 : 9.5 for the innermost band and 1 : 12.5 for the outermost, never 1 : 1; 

(2) confirm the fan is narrow at the top, wide at the bottom — the trails launch from the top-centre and open downward, so the widest point is the bottom edge, where the observatory's V picks them up. A reconstruction that is wide at the top and closes downward is vertically flipped.

### A.3 Band construction

Band `k` (0 = centre white, 5 = outer maroon) is bounded by curves `k` and
`k+1`, closed along the bottom edge. Sample each curve at ≥32 steps and emit
cubic segments:

```
M <curve k, top>  C…down…  L bottom_{k+1} H  C…back up…  Z
```

Mirror the whole set about `x = cx` for the right half (the shipped SVG carries
12 explicit paths, 6 per side). The outermost boundary is the canvas edge
itself (`x = 0` / `x = W`).

### A.4 Bottom anchors (shared seam values)

| k | (1−k/N) | bottom_k (left) | mirror (right) |
|---|---|---|---|
| 0 | 1.000 | 800.00 | 800.00 |
| 1 | 0.833 | 688.54 | 911.46 |
| 2 | 0.667 | 561.08 | 1038.92 |
| 3 | 0.500 | 426.79 | 1173.21 |
| 4 | 0.333 | 287.86 | 1312.14 |
| 5 | 0.167 | 145.38 | 1454.62 |
| 6 | 0.000 | 0.00 | 1600.00 |

These are the only numbers page 2 needs to know.

### A.5 Generator

```ts
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function heroTrails(W = 1600, H = 1000, N = 6, P = 1.1, GAP = 70 / 6, OV = 40) {
  const cx = W / 2;
  const curve = (k: number) => {
    const top = cx - GAP * k;
    const bottom = cx - cx * Math.pow(1 - k / N, P);
    const p1 = -0.11 + 0.022 * k, p2 = 0.315 - 0.053 * k;
    return Array.from({ length: 65 }, (_, i) => {
      const u = i / 64, y = u * (H + OV) - OV;
      const b = 3 * p1 * u * (1 - u) ** 2 + 3 * p2 * u * u * (1 - u) + u ** 3;
      return [lerp(top, bottom, b), y] as const;
    });
  };
  return Array.from({ length: N }, (_, k) => {
    const a = curve(k), b = curve(k + 1).slice().reverse();
    const d = `M ${a[0][0].toFixed(2)} ${a[0][1]} `
      + a.slice(1).map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(1)}`).join(' ')
      + ` L ${b[0][0].toFixed(2)} ${b[0][1]} `
      + b.slice(1).map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(1)}`).join(' ') + ' Z';
    return { d, fill: FAN_COLORS_OUT_TO_IN[N - 1 - k] };  // k=0 is the centre band
  });
}
```

(Smooth it by converting the sampled polyline to `C` segments — the shipped file
does; the visual difference at 64 samples is negligible.)

### A.6 Hero layering, bottom to top

1. `#000000` ground, fan SVG at full opacity.
2. `<canvas>` starfield + orbiting satellites (three.js).
3. Vignette `radial-gradient(ellipse at 50% 45%, transparent 42%, rgba(0,0,0,.2))`.
4. Scanlines: 1 px `rgba(180,205,255,.28)` every 3 px, `opacity:.16`,
   `mix-blend-mode:overlay`.
5. Two animated scout ships (`scoutRTL` 0→41.67 %, `scoutLTR` 50→91.67 %)
   dragging the streak gradients above.
6. Title, then CTA.

---

## B. Observatory fan — straight continuation

Same colours, same bottom anchors, but every boundary is a **straight line to a
shared apex** at `(cx, H)`. The trails have "landed": what was a wake becomes a V.

```
t_k = 1 − k/N
w_k = (W/2) · t_k^P                 // half-width at the top edge
x_k = cx − w_k                      // = bottom_k from A.4 — the seam matches
y_k = (H / (W/2)) · w_k = 1.25·w_k  // depth where boundary k meets the centre line
```

All boundaries share the slope `1.25` (38.66° from vertical), so the section
reads as one continuous V.

```
band k:  M x_k 0  L cx y_k  L (W−x_k) 0  L (W−x_{k+1}) 0  L cx y_{k+1}  L x_{k+1} 0  Z
```

| k | w_k | x_k | y_k | fill |
|---|---|---|---|---|
| 0 | 800.00 | 0.00 | 1000.0 | `#8A1538` |
| 1 | 654.62 | 145.38 | 818.3 | `#E86132` |
| 2 | 512.14 | 287.86 | 640.2 | `#D11F3A` |
| 3 | 373.21 | 426.79 | 466.5 | `#345587` |
| 4 | 238.92 | 561.08 | 298.7 | `#D9A83E` |
| 5 | 111.46 | 688.54 | 139.3 | `#F1F1EE` |

The innermost band is a plain triangle: `M 688.54 0 L 800 139.3 L 911.46 0 Z`.

### B.1 Opacity passes

Same six paths painted several times, differing only in opacity and clip/mask:

| pass | opacity | clip / mask |
|---|---|---|
| base field | 0.30 | centre column cut: `linear-gradient(90deg,#000 0 20%,transparent 30%,transparent 70%,#000 80%)` |
| margin ring | 0.15 | outside `inset(26px)` |
| outer frame | 0.50 | outside the framed box |
| header strip | 0.20 | `inset(26px 26px calc(100% - 84px) 26px)` + inverse mask `linear-gradient(90deg,transparent 18%,#000 30%,#000 70%,transparent 82%)` |
| apex tip | 0.30 | `inset(calc(100% - 190px) 20% 26px 20%)` + `linear-gradient(180deg,transparent 0,#000 62%)` |

The centre cut exists so plotted points read against plain dark ground. With the
field veil off, drop the mask and the fan runs behind the field at 30 %.

---

## Rules

- **Never approximate the seam.** Hero and observatory share `viewBox` width and
  `preserveAspectRatio="none"`, so boundaries meet exactly at any window width.
  Do not substitute a percentage-based gradient for either.
- **No gaps between bands.** Adjacent paths share vertices; never inset or stroke.
- **Colour order is fixed** and identical on both pages.
- **Max two grounds per page.** The fan supplies all other colour.
- **Stars only in the black corners** — clip a starfield to `M0 0 L800 1000 L0
  1000 Z` and `M1600 0 L800 1000 L1600 1000 Z`, so no star ever sits on a stripe.
- Only `N` and `P` change the shape family; `p1/p2` change the launch feel. Every
  path regenerates from those.
