# HOTSPOT.md — the limb hot spot

A star cresting the planet's limb: hard rim, bloom, anamorphic streak, forward
scattering into the night side. Reference implementation: `Limb Hotspot.dc.html`.
It is **fixed at the right limb** — the star's only freedom is elevation along
that limb.

It is a 2D canvas composite, not a shader and not a 3D light. That is
deliberate: the effect is a *photograph* of a sunrise, and photographs are made
of lens artifacts, which are cheaper and more controllable in 2D.

---

## 1. Geometry — two numbers, everything else derived

```ts
R = W * 1.15                          // planet radius: much larger than the frame
C = { x: W * 0.75 - R, y: H * 0.55 }  // centre off-canvas LEFT
th = -elevation * PI / 180            // 0 = rightmost point of the disc
S  = C + (R + W*0.004) * (cos th, sin th)   // the star, just OUTSIDE the limb
```

The planet is deliberately enormous — its limb must read as a **shallow arc**,
not a circle. Anything under about `W * 0.9` starts to look like a ball, and the
sense of standing on a world's edge collapses.

`S` sits `W*0.004` outside the limb: the star has just cleared the horizon. Push
it inside and the core is occluded; push it far out and it detaches into a
generic lens flare.

---

## 2. Layer order — this is the whole trick

```
1  stars              source-over, clipped OUT of the disc (evenodd)
2  outer halo         lighter  — three nested radial gradients at S
3  lens ghosts        lighter
4  DISC STAMP         source-over BLACK, clipped to the circle
5  forward scatter    lighter, inside the disc clip
6  terminator wash    lighter, inside the disc clip
7  rim bands          lighter, clipped to annuli
8  anamorphic streak  lighter — IN FRONT of the planet
9  spikes             lighter — IN FRONT of the planet
10 core               lighter
11 vignette + grain   source-over
```

Two order facts carry the illusion:

- **The glow is painted across the whole frame first, then the planet is stamped
  over it in flat black.** No occlusion maths, no masks per layer — one
  `source-over` black circle deletes every glow behind the world at once.
- **The streak, spikes and core are drawn AFTER the stamp**, because they are
  artifacts of the *lens*, not of the scene. A flare that respects the planet's
  silhouette looks like a bug; one that crosses it looks like a camera.

---

## 3. The pieces

### 3.1 Halo — the lit sky

Three concentric radial gradients at `S`, all `lighter`:

| radius | colour | alpha |
|---|---|---|
| `W*1.25` | atmosphere blue `#81b2ff` | .30 |
| `W*0.42` | halo `#cee2ff` | .40 |
| `W*0.11` | white | .55 |

Each uses a three-stop falloff (`0 → 0.35 → 1`) rather than a linear ramp, so
the brightness collapses fast near the core and lingers far out — which is what
atmospheric scattering actually does, and what a two-stop gradient never does.

### 3.2 Anamorphic streak — a circle squashed flat

```ts
g.translate(S.x, S.y); g.scale(1, thickness);   // 0.055 / 0.018 / 0.006
radialGradient(0,0,0, 0,0, len) → fill circle
```

Three passes: wide+dim (blue), medium (halo), thin+bright (white). Squashing a
*radial* gradient is what gives the streak its tapering pointed ends; a linear
gradient in a rectangle gives blunt ends and reads as a UI divider.

Stops `0, .06, .4, 1` — the .06 stop keeps the centre hot over the first 6 % of
the length, which is the anamorphic signature.

### 3.3 Spikes

Same squashed-circle trick at `scale(1, 0.006)`, rotated evenly around `S` with a
`+0.22` rad offset so no spike is axis-aligned. Lengths jittered per index.
Alpha `0.30 * bloom` maximum — spikes should be *nearly* subliminal; when you
can count them the shot looks like a stock flare.

### 3.4 The rim — annulus clip, not a stroked arc

Canvas cannot gradient along a path, and stroking the limb in per-degree
segments produces visible stitching. Instead, clip to a thin annulus and fill a
radial gradient **centred on the star**:

```ts
beginPath();
arc(C.x, C.y, outer, 0, 2PI);
arc(C.x, C.y, inner, 0, 2PI, true);   // reverse winding
clip('evenodd');
fill radialGradient at S
```

Three bands, widest and dimmest first:

| inner…outer | gradient radius | colour | alpha |
|---|---|---|---|
| `R ± W*0.030` | `W*0.55` | atmosphere | .20 |
| `R ± W*0.008` | `W*0.34` | halo | .55 |
| `R ± 1.6px` | `W*0.26` | white | 1.0 |

The 1.6 px hard rim is the single element that makes it a *planet* — it is the
only truly sharp edge in the composite, and everything else is soft by contrast.

### 3.5 Forward scattering

Inside the disc clip, `lighter`, a radial gradient at `S` of radius `W*0.42`
with stops `.30 / .10 / 0`. This is light bleeding around the limb into the night
side. Without it the terminator is a hard cut and the planet reads as a paper
cutout. A very wide, very low `.05` wash from `C.x - R*0.2` keeps the dark side
from being flat black.

### 3.6 Ghosts, vignette, grain

Ghosts: three faint rings along the line from `S` through the frame centre, at
`t = 0.45 / 0.85 / 1.25`, alpha ≤ .014, each a ring (transparent centre, bright
at .94 of its radius). Vignette to `rgba(0,0,0,.42)`. 2,200 1 px grain dots at
3.5 % alpha — deterministic, from `sin(i*127.1+311.7)` hashing, so the frame is
identical every draw.

---

## 3.7 Phase — the one driver everything hangs off

`phase` p ∈ [0,1] is the fraction of the disc that is lit: **0 = the shadow
covers the world (a razor crescent), 1 = fully lit**. It is not a brightness
slider; it is a physical state, and five separate quantities are derived from it
so the whole composite moves together.

```ts
lit = pow(p, 1.5)                 // SURFACE illumination — runs WITH phase
I   = 0.06 + 0.94 * pow(1-p, 1.5) // FLARE intensity — runs AGAINST phase
SL  = 1.70 - 1.45 * pow(p, 0.7)   // streak length multiplier — INVERSE
RM  = 0.35 + 1.75 * p             // how far the rim glow wraps the limb
kT  = 2p - 1                      // terminator ellipse x-radius factor
tt  = th - azimuth                // shadow axis, independent of the star
```

| quantity | at p→0 (dark Mars) | at p→1 (lit Mars) |
|---|---|---|
| **halo / core / spike alpha (`× I`)** | **1.0 — blazing** | **0.06 — nearly gone** |
| **streak length (`× SL`)** | **1.70×, longest** | **0.25×, a point** |
| day-side glow (`× lit`) | 0.35× | 1.0× |
| halo radius | `W*0.75` | `W*1.35` |
| core radius | 0.55× | 1.0× |
| rim wrap (`× RM`) | 0.35× — a spark on the limb | 2.1× — light around the shoulder |
| spike length | 1.15× | 0.70× |

### The two drivers run opposite ways — on purpose

There are **two** illuminations in this composite and they are inversely
coupled:

- **The surface** (`lit`) brightens with phase. More of the world faces the
  star, so the day side widens and glows harder. Obvious.
- **The flare** (`I`) *dims* with phase. This is the interesting one. The
  spectacular frame is the nearly-eclipsed one: the star is reduced to a point
  seen edge-on through the deepest slice of atmosphere, and a point source is
  exactly what produces a hot core, hard spikes and a long anamorphic smear. As
  the face opens up the star sits higher and reads as a broad source — the core
  spreads, the smear collapses, the drama leaks away.

So the darkest Mars gives the brightest, longest hot spot, and a fully lit Mars
gives an almost flareless one. That inversion is the whole effect: it makes the
composite read as *an event happening to the camera* rather than as a brightness
slider.

### Azimuth — rolling the shadow

`azimuth` (−180…180°) rotates the terminator axis **independently of the star**:
`tt = th − azimuth`, positive = counter-clockwise on screen. Phase controls how
*wide* the shadow is; azimuth controls where it lies. Leave it at 0 and the
terminator stays perpendicular to the star direction, which is the physically
correct case; turn it and you get the cinematic one, where the light rakes
across the world from an angle the star does not account for.

Note it moves the shadow only. The rim, the scatter falloff and the flare all
stay anchored to `th`, so the star never detaches from its own highlight.

**Note!** We introduced Azimuth later, later than we defined the terminator and the Hotspot's logic.
- Current issue, the terminator's direction is misaligned with the sunrise location and the Hotspot. The Hotspot and sunrise location remain the same, yet terminator's plane changes.
- Potential fix, if can, formulate the trajectory of the terminator. The Hotspot and the sunrise sector collide when the Mars is from pure dark to leak a bit light, like cresent moon. The lit area should be opposite with the shadowed area, it is a fixed and true rule.
- The hotspot should emerge on the seam of shadowed and sunlight area. You can decide which way (left or right) to go. The senario is we have a break of light and it expands to a bigger light area, but hotspots follows the transient area of light and shadow. Each time you can decide which way to move, maybe use a random number generator, <0.5 then to left, >= 0.5 then to right.

### The terminator

The day/night boundary projects as a **half-ellipse whose x-radius is
`R·(2p−1)`** — negative for a crescent (it cuts into the lit half), positive for
a gibbous phase (it bulges past centre). One path covers both cases:

```ts
beginPath();
arc(C.x, C.y, R, th - PI/2, th + PI/2);                       // lit limb
ellipse(C.x, C.y, abs(R*kT), R, th, PI/2, -PI/2, kT > 0);     // terminator
closePath(); clip();
```

The ellipse is rotated by `th` so its axes follow the star, and the
anticlockwise flag flips with the sign of `kT`. The forward-scatter gradient is
then drawn inside that clip, with its radius also growing with `p` — so the day
side widens and brightens as one motion.

### Rim exception


The hard 1.6 px white rim keeps **alpha 1.0 at every phase**. Physically the limb
immediately beside the star is fully lit no matter how thin the crescent is;
only its *extent* should shrink, and `RM` already does that. Fading it as well
made low phases read as fog rather than as a razor edge.

---

## 4. Tunables

`phase` (0–1) · `azimuth` (−180…180°) · `elevation` (−30…30°) · `bloom` (.3–1.8) · `streak` (0–1.4) · `spikes` (0–10) ·
`scatter` (0–2) · `tone` (cold / neutral / warm) · `stars`.

Working preset (the one to build from): `phase 0.18`, `elevation 3`, `bloom 1.15`,
`streak 1.4`, `scatter 1.5`, `spikes 6`, `tone cold`. Long streak plus lifted
scatter is what sells the atmosphere; raising `bloom` instead blows the core out.

Tone only swaps three RGB triples (core / halo / atmosphere). Cold is the
project default; warm turns it into a K-dwarf without touching geometry.

---

## 5. Restoring it into the hero

The hero already renders the globe in three.js, so the composite splits:

- Keep the globe, its fresnel atmosphere shell and the starfield in WebGL.
- Add the hot spot as a **2D canvas overlay above the WebGL canvas**, with the
  limb geometry computed from the same projected `earthPx` / `earthCx` /
  `earthCy` values the title and scouts already use — the rim arc is then
  guaranteed to sit exactly on the rendered globe's silhouette.
- Draw only layers 2, 3, 8, 9, 10 (halo, ghosts, streak, spikes, core) in the
  overlay; the disc stamp and the rim are unnecessary because the real globe
  already occludes and already has a fresnel rim. Raise the fresnel shell's
  intensity near the sun direction instead.
- Put the overlay **below** the title (z 5) and above the fan, so the streak
  crosses the planet but never the word.

Everything scales from the same measured radius, so it survives resize with no
extra work.
