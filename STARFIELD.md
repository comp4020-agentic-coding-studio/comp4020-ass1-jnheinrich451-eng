# STARFIELD.md — background stars

Two completely different starfields, one per page. They must never be confused:
the hero's is a **live 3D shader field** that moves with the camera; the
observatory's is a **static SVG field** that exists only to keep the black
corners from reading as empty paper.

---

## A. Hero — three.js point field

### A.1 Distribution

2,600 points on a uniform spherical shell around the origin:

```ts
r     = 30 + random() * 45              // shell thickness 30–75
theta = random() * 2π
phi   = acos(2*random() - 1)            // NOT random()*π — that clumps at the poles
x = r·sin(phi)·cos(theta)
y = r·sin(phi)·sin(theta)
z = r·cos(phi)
```

The `acos(2u−1)` inverse transform is the whole reason the field looks natural.
A naive uniform `phi` puts visible density bands at the top and bottom of every
camera angle.

The shell is far outside the globe (radius 2.585) and the satellite orbits
(3.0–4.4), so no star ever occludes an object.

### A.2 Per-star attributes

| attribute | value |
|---|---|
| `aSize` | 1.5 % of stars: `4.2 + rand*2.6` (bright) · next 8.5 %: `2.2 + rand*1.2` · remaining 90 %: `0.8 + rand*1.1` |
| `aPhase` | `rand * 2π` — twinkle offset |
| `aTw` | `0.25 + rand*0.75` — twinkle *depth*; low values barely breathe |
| `aTint` | 18 %: `[1, .86, .72]` warm · 20 %: `[.78, .86, 1]` cool · 62 %: white |

The three-tier size split is doing the work of a magnitude distribution: a
handful of anchors, a thin second rank, and a dense faint floor. Change the
ratios and the sky immediately reads as generated.

### A.3 Vertex shader

```glsl
vec4 mv = modelViewMatrix * vec4(position, 1.0);
float t     = sin(uTime * 0.55 + aPhase) * 0.5 + 0.5;
float pulse = mix(1.0 - aTw * 0.8, 1.0, t);
vAlpha      = clamp(0.28 + pulse * 0.72, 0.0, 1.0);
gl_PointSize = aSize * uPixelRatio * (1.0 + pulse * 0.35) * (60.0 / -mv.z);
```

Two things twinkle together — alpha *and* size (`+35 %`) — which is what makes it
read as atmospheric scintillation rather than an opacity loop. `60.0 / -mv.z` is
the perspective size falloff; without it, distant stars stay as large as near
ones. `uPixelRatio` is clamped to 2.

Base rate `0.55` rad/s: slow. Stars are the calmest thing on the page.

### A.4 Fragment shader

```glsl
vec2 d = gl_PointCoord - vec2(0.5);
float r = length(d);
if (r > 0.5) discard;                     // round, not square
float core = smoothstep(0.5, 0.0, r);
float glow = pow(core, 3.0) + core * 0.28;
gl_FragColor = vec4(vTint * glow, glow * vAlpha);
```

`pow(core,3)` is the hard centre, `core*0.28` the soft skirt. Additive blending,
`depthWrite:false`, `transparent:true`. No texture — a sprite map at this count
costs more and looks softer.

---

## B. Observatory — static SVG field

190 `<circle>` elements, positions **seeded once at author time** and written
into the markup. They do not regenerate on load; the sky is the same every visit,
because it is part of the layout, not an effect.

```
r        0.39 – 1.18
fill     #dfe6ff              (single colour — no tinting at this scale)
opacity  0.25 – 0.75          (static base, animated by starTwinkle)
```

```css
@keyframes starTwinkle { 0%,100% { opacity:.12 } 50% { opacity:1 } }
```

Per star: `duration 2.61–6.97s`, `ease-in-out`, `delay 0.01–5.94s`, infinite.
Delays are spread across a range wider than the longest duration, so the field
never phases together.

Group glow, applied once to the whole `<g>` rather than per circle:

```
filter: drop-shadow(0 0 1.5px rgba(214,230,255,.95))
        drop-shadow(0 0 5px   rgba(150,180,255,.55))
```

### B.1 The corner clip — the important part

Stars are allowed **only in the two black triangles the fan does not cover**:

```svg
<clipPath id="fanGroundClip">
  <path d="M0 0 L800 1000 L0 1000 Z"></path>
  <path d="M1600 0 L800 1000 L1600 1000 Z"></path>
</clipPath>
```

Same `viewBox="0 0 1600 1000"` and `preserveAspectRatio="none"` as the fan, so
the clip tracks the stripes exactly at any window width. **No star may ever sit
on a stripe** — a star on colour reads as dirt, and it breaks the fan's claim to
be a flat printed surface.

---

## Rules

- The hero field is 3D and reacts to the camera; the observatory field is flat
  and reacts to nothing. Do not add parallax to the second one.
- Neither field reacts to scroll, pointer, or data.
- Both are additive light on black. Never place a starfield over a lit ground.
- Star colour is `#dfe6ff` (SVG) or the three shader tints. They are not part of
  the palette and are never reused for UI.
- If the field needs to be denser, add faint stars — never brighter ones.
