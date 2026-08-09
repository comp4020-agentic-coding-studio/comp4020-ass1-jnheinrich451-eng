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

### 2 The sheen — what makes it reflective

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
4. **Concentrate light point** Borrow the idea of Starfield opening, which can be described as A bright light source is partially occluded by the planet, sitting almost exactly tangent to the planetary silhouette. Only a small portion of the source is visible, producing an intense white-hot hotspot at the limb, surrounded by bloom, a soft hale, radial light rays, and subtle lens flare. The location computes by set the border of shadow on Mars, get its middle point, which can be computed with the intersecting two points of sihouette, draw a line and get the mid point. Find the normal vector direction, the vector cross with the silhouette is the location of the light point.
5. **Potential implementation** 
- HTML:
<div class="space-container">
  <!-- The background image featuring the planet's limb -->
  <img src="your-planet-background.jpg" alt="Space Limb Background" class="bg-image">
  
  <!-- Interactive Hotspot Anchor -->
  <a href="#destination" class="hotspot-trigger">
    <span class="central-ring"></span>
    <span class="logo-text">STARFIELD</span>
  </a>
</div>

- CSS:
/* Container scales with your webpage layout */
.space-container {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 1000px;
}

.bg-image {
  width: 100%;
  display: block;
}

/* Position the logo anchor dynamically near the limb */
.hotspot-trigger {
  position: absolute;
  top: 50%;   /* Adjust vertically to align with the limb */
  left: 50%;  /* Adjust horizontally to align with the limb */
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
}

/* Styling the circular target ring */
.central-ring {
  position: absolute;
  width: 180px;
  height: 180px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  transition: all 0.4s ease-in-out;
}

/* Crisp, spaced out typography centered within the element */
.logo-text {
  color: #ffffff;
  font-family: 'Montserrat', sans-serif;
  font-size: 24px;
  letter-spacing: 12px;
  text-indent: 12px; /* Offsets letter-spacing tracking bug on last letter */
  z-index: 2;
  transition: text-shadow 0.4s ease;
}

/* Hover Effects: Ring glows and expands into a cosmic pulse */
.hotspot-trigger:hover .central-ring {
  border-color: #ffffff;
  box-shadow: 0 0 25px rgba(255, 255, 255, 0.6);
  animation: pulse-glow 2s infinite ease-in-out; /* Continuous ambient pulse */
}

.hotspot-trigger:hover .logo-text {
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
}

/* Keyframe logic for an outward pulse */
@keyframes pulse-glow {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 35px rgba(255, 255, 255, 0.8);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

**Worth attention!** This part is I clipped from Google, it is not corresponding to the project, however you can refer to the logic.
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
