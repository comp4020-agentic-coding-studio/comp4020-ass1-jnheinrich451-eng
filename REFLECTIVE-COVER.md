# REFLECTIVE-COVER.md

Everything here is sized from **one measured number**:
`earthPx`, the globe's on-screen radius in CSS pixels, projected out of the
three.js scene each frame the camera or viewport changes. Nothing in this
component has a hard-coded size.

---

## 1. Measuring `earthPx`

```ts
// project the globe centre and one edge point to screen space
const cx = project(center),  ex = project(center + right * radius);
earthPx    = hypot(ex - cx);              // radius in CSS px
earthCxPct = cx.x / canvasWidth  * 100;   // where the arc anchors
earthCyPct = cx.y / canvasHeight * 100;
```

Recompute on resize, on camera change, and once the model finishes loading.
Every measurement below is a multiple of `earthPx` (`px` for short).

---

## 2. The arc

A 150° arc centred on the globe, sitting on a squashed circle so it reads as a
ring seen at a shallow angle.

```
R      = px * 1.18            // panel radius
squash = 0.5                  // scaleY on the whole wrap — the perspective
span   = 150°,  start = −75°  // symmetric about vertical
wrap   : left earthCx%, top earthCy%, margin-top px*0.10, transform scaleY(0.5)
```

The wrap is a zero-size anchor (`width:0;height:0`) — every child positions
itself by `rotate(a) translateY(−R)`, so the arc stays perfectly concentric no
matter the size.

### 2.1 Panel segments — 26 of them

```
a_i = −75 + (i / 25) * 150
w_i = 2πR · (150/360) / 26 + 3      // +3 so neighbours overlap, no seams
```

Each segment: `w_i × 15px`, radius 2 px, transformed
`rotate(a_i) translateY(−R)`, with

```
background: linear-gradient(180deg, #3a4668 0%, #161c2e 55%, #0a0d17 100%)
border:     1px solid rgba(150,175,255,.28)
overflow:   hidden
```

The vertical gradient is the panel's own curvature — bright at the top edge,
falling to near-black at the bottom. It is the *only* place in the project where
a gradient stands in for form.

### 2.2 The sheen — what makes it reflective

Inside each segment, a full-bleed child sweeps across:

```
background: linear-gradient(100deg,
              transparent 30%,
              rgba(255,255,255,.85) 48%,
              rgba(255,214,150,.5)  54%,
              transparent 70%)
animation:  panelSheen 4.6s ease-in-out infinite
delay:      i * 0.12s
```

```css
@keyframes panelSheen {
  0%,45% { transform: translateX(-120%) }
  60%    { transform: translateX(120%) }
  100%   { transform: translateX(120%) }
}
```

Three things make this read as reflection rather than as a shine effect:

1. **The 0.12 s per-segment stagger.** 26 segments × 0.12 s = 3.1 s of travel
   across a 4.6 s cycle, so the highlight crosses the arc as a *wave*, like a
   light source passing behind the viewer.
2. **The warm secondary band** (`rgba(255,214,150,.5)` right behind the white)
   — a single-colour highlight looks like CSS; the split into cold-then-warm
   looks like a coated surface.
3. **The long dead time.** 45 % of the cycle is spent off-panel. The arc is dark
   most of the time; the sweep is an event, not a loop.

Never raise the frequency or shorten the dead time. If the arc looks busy, the
component has failed.

## 3. The lens beneath — iris behaviour

The cover conceals a lens that opens on hover of the globe hotspot
(`px*1.86` circle, the only pointer target in the hero).

```
lensSize = px * 1.02
closed:  clip-path: ellipse(52% 0% at 50% 50%);  transform: scale(.94)
open:    clip-path: ellipse(50% 50% at 50% 50%); transform: scale(1)
transition: .85s cubic-bezier(.16,.9,.2,1)   // both properties
drop-shadow(0 0 px*0.14 rgba(130,165,255,.55))
drop-shadow(0 0 px*0.40 rgba(150,120,255,.30))
```

The closed state is an ellipse of **zero height** — an eyelid, not a fade. The
`52%` horizontal (slightly over 50) prevents a hairline of lens showing at the
corners while shut. The easing is heavily front-loaded: it snaps open and
settles, so it reads as a mechanism releasing.

Two elements ride the opening, both delayed so they arrive *after* the lid:

| element | detail |
|---|---|
| tick ring | 24 ticks at 15°; every 6th is major (14 px / `rgba(210,228,255,.75)`), others 7 px / `.35`. Radius `lensSize*0.62`. `opacity 0 → .9`, `.6s ease .1s` |
| readout | IBM Plex Mono 11 px, tracking `.18em`, `#cfe0ff`, glow `0 0 12px rgba(150,190,255,.8)`, sitting `lensSize*0.62` below centre. `opacity 0 → 1`, `.5s ease .15s` |

---

## 4. Stacking

```
z 2   arc: panels + arced text        (behind the globe's silhouette)
z 3   scout routes (see SCOUT-SHIP.md)
z 4   globe hotspot — the only interactive element
z 5   title, lens, ticks, readout
```

The arc is deliberately *behind* the globe: the panels disappear at the
silhouette, which is what sells them as a physical ring around it rather than a
graphic pasted on top.

---

## 5. Rules

- Every dimension derives from `earthPx`. If you find a literal px value that is
  not 15 (panel height), 26 (text offset), 2/3 (radii, overlap), it is a bug.
- The arc never rotates. The globe rotates; the sheen travels; the structure
  holds still.
- One sheen wave on screen at a time.
- Panel fill is the only permitted background gradient in the project. Do not
  copy the treatment onto other panels — it is what marks this object as the
  reflective one.
- The arced text is a statement, not a label: it never changes with state, never
  animates, and never gets a second line.
