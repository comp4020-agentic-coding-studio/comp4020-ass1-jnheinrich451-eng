# STRIPE.md — the scout-trail fan

The single recurring graphic device of the site: a six-band V that starts as
scout trails in the hero and continues, at reduced opacity, behind the data
field. It is **generated, not drawn**. Never hand-tune path numbers — change the
two parameters and regenerate.

---

## 1. Parameters

```ts
const W = 1600;   // viewBox width  (design units, not px)
const H = 1000;   // viewBox height
const cx = W / 2; // 800 — apex sits on the centre line at (cx, H)
const N = 6;      // number of colour bands
const P = 1.1;    // flare exponent — the only shape knob
```

## 2. Formula

For each boundary `k = 0 … N` (0 = outermost, N = apex):

```
t_k = 1 − k / N                      // normalised distance from the apex
w_k = (W / 2) · t_k^P                // half-width where boundary k meets the top edge
x_k = cx − w_k                       // left intersection with y = 0
y_k = (H / (W / 2)) · w_k            // = 1.25 · w_k — depth where boundary k
                                     //   reaches the centre line
```

Two consequences worth knowing:

- **All boundaries are parallel.** `y_k / w_k` is constant at `H/(W/2) = 1.25`,
  i.e. 38.66° from vertical. This is what makes the fan read as one continuous
  V rather than a set of nested chevrons.
- **`P` alone controls the flare.** `P = 1` gives equal band widths; `P = 1.1`
  makes the outer bands slightly wider, matching the hero trails' ease-out.

## 3. Generator

```ts
export const FAN_COLORS = [
  '#8A1538', // 0 outermost — deep maroon
  '#E86132', // 1 orange
  '#D11F3A', // 2 red
  '#345587', // 3 slate blue
  '#D9A83E', // 4 gold
  '#F1F1EE', // 5 apex — bone white
];

export function fanBands(W = 1600, H = 1000, N = 6, P = 1.1) {
  const cx = W / 2;
  const b = Array.from({ length: N + 1 }, (_, k) => {
    const w = cx * Math.pow(1 - k / N, P);
    return { w, x: cx - w, y: (H / cx) * w };
  });
  return b.slice(0, N).map((o, k) => {
    const i = b[k + 1];
    const d = k === N - 1
      ? `M${o.x} 0 L${cx} ${o.y} L${W - o.x} 0 Z`
      : `M${o.x} 0 L${cx} ${o.y} L${W - o.x} 0 L${W - i.x} 0 L${cx} ${i.y} L${i.x} 0 Z`;
    return { d, fill: FAN_COLORS[k] };
  });
}
```

Render with `preserveAspectRatio="none"` so the fan stretches to any viewport
and colour boundaries meet their counterparts exactly at the page seam:

```html
<svg viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true"
     style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
  <!-- one <path d fill> per band -->
</svg>
```

## 4. Reference output (W=1600, H=1000, N=6, P=1.1)

| k | t | w | x_left | y (apex depth) | fill |
|---|---|---|---|---|---|
| 0 | 1.000 | 800.00 | 0.00 | 1000.0 | `#8A1538` |
| 1 | 0.833 | 654.62 | 145.38 | 818.3 | `#E86132` |
| 2 | 0.667 | 512.14 | 287.86 | 640.2 | `#D11F3A` |
| 3 | 0.500 | 373.21 | 426.79 | 466.5 | `#345587` |
| 4 | 0.333 | 238.92 | 561.08 | 298.7 | `#D9A83E` |
| 5 | 0.167 | 111.46 | 688.54 | 139.3 | `#F1F1EE` |
| 6 | 0.000 | 0.00 | 800.00 | 0.0 | — |

Literal paths (what the prototype ships):

```
M0 0 L800 1000 L1600 0 L1454.62 0 L800 818.3 L145.38 0 Z              #8A1538
M145.38 0 L800 818.3 L1454.62 0 L1312.14 0 L800 640.2 L287.86 0 Z     #E86132
M287.86 0 L800 640.2 L1312.14 0 L1173.21 0 L800 466.5 L426.79 0 Z     #D11F3A
M426.79 0 L800 466.5 L1173.21 0 L1038.92 0 L800 298.7 L561.08 0 Z     #345587
M561.08 0 L800 298.7 L1038.92 0 L911.46 0 L800 139.3 L688.54 0 Z      #D9A83E
M688.54 0 L800 139.3 L911.46 0 Z                                      #F1F1EE
```

## 5. Opacity zones

The same six paths are painted several times, differing only in opacity and
clip/mask. Grounds: `#070812` (section), `#03040a` (plot field).

| pass | opacity | clip / mask |
|---|---|---|
| base field | 0.30 | centre column masked out: `linear-gradient(90deg,#000 0 20%,transparent 30%,transparent 70%,#000 80%)` |
| margin ring | 0.15 | `clip-path: inset(26px)` complement |
| outer frame | 0.50 | outside the framed box |
| header strip | 0.20 | `clip-path: inset(26px 26px calc(100% - 84px) 26px)` + inverse mask `linear-gradient(90deg,transparent 18%,#000 30%,#000 70%,transparent 82%)` |
| apex tip | 0.30 | `clip-path: inset(calc(100% - 190px) 20% 26px 20%)` + `linear-gradient(180deg,transparent 0,#000 62%)` |

The centre cut exists so plotted points read against plain dark ground. When
the field veil is off, drop the mask and the fan runs behind the field at the
side columns' 30%.

## 6. Rules

- **Never approximate the seam.** Hero and section fans share the same `viewBox`
  width and `preserveAspectRatio`, so boundaries meet exactly at any window
  width. Do not swap one for a percentage-based gradient.
- **No gaps between bands.** Adjacent paths share vertices; do not inset or
  stroke them.
- **Max two grounds per page** (`#070812`, `#03040a`). The fan supplies all
  other colour.
- **Stars only in the black corners** — clip a starfield to
  `M0 0 L800 1000 L0 1000 Z` and `M1600 0 L800 1000 L1600 1000 Z` so no star
  ever sits on a stripe.
- **Colour order is fixed** outer→central. The apex white is the accent used by
  active HUD elements; the slate blue at k=3 is the only cool band and should
  stay the one that reads as "instrument".
