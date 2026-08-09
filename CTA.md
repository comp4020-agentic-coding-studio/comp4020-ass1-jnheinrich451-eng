# CTA.md — [ ENTER OBSERVATORY ]

The only affordance on page 1. One line of mono type on a translucent plate,
pinned to the bottom of the hero. It has to do three jobs at once: read as a
button without looking like a web button, survive on top of a starfield and a
six-colour fan, and act as the trigger for the glitch reveal.

---

## 1. Markup

A pointer-transparent full-width bar containing a single inline `<span>` that
carries every property. Nothing else.

```html
<div onClick="{{ scrollToObservatory }}"
     style="position:absolute;bottom:3vh;left:0;right:0;
            text-align:center;z-index:5;pointer-events:none">
  <span onMouseEnter="{{ onCtaEnter }}" onMouseLeave="{{ onCtaLeave }}"
        style="display:inline-block;pointer-events:auto;cursor:pointer;
               padding:9px 20px;border-radius:3px;
               background:rgba(4,5,10,.86);
               font-family:'IBM Plex Mono',monospace;
               font-size:15px;letter-spacing:.18em;color:#e8ecff;
               text-shadow:0 0 2px #04050a,0 0 6px rgba(4,5,10,.98);
               animation:ctaGlow 3.4s ease-in-out infinite"
        style-hover="text-shadow:0 0 2px #04050a,0 0 20px rgba(190,205,255,.9)">
    [ ENTER OBSERVATORY ]
  </span>
</div>
```

The bar is `pointer-events:none` and only the span re-enables them, so the hit
area is exactly the words plus their padding — **no invisible full-width target**.
The click handler sits on the bar (harmless, since only the span is hittable);
the hover handlers sit on the span.

---

## 2. Geometry

| property | value | why |
|---|---|---|
| `bottom` | `3vh` | viewport-relative so it stays clear of the fan apex at any height; a px value collides on short screens |
| `padding` | `9px 20px` | asymmetric — the wide tracking already pads the line horizontally, so the vertical padding is what makes it a target. 44 px minimum height comes out of 15 px type + 18 px padding + line-height |
| `border-radius` | `3px` | the project's control radius. Not 0 (reads as a table cell), not 6 (reads as a web button) |
| `z-index` | `5` | same plane as the title — above the scouts, below the glitch blocks |

Text is centred by the parent's `text-align`, not by flex, so the span keeps
shrink-to-fit width without a wrapper.

---

## 3. Surface

```
background:  rgba(4,5,10,.86)
color:       #e8ecff
text-shadow: 0 0 2px #04050a, 0 0 6px rgba(4,5,10,.98)
```

- The plate is **86 % opaque, not solid** — the stripes stay faintly visible
  through it, so the button sits *in* the image rather than on it. This is one
  of only two plates in the entire project (the other is the SOL marker).
- `#04050a` is the hero's own ground colour, so the plate reads as a hole
  punched in the scene rather than a panel added to it.
- No border. The plate edge is the only boundary, and it is soft by being
  translucent. Adding a 1 px rule turns it into a form control.
- The two text shadows are black knockouts, not glow: they guarantee legibility
  in the moment the plate crosses a bright star or the fan's white centre band.

## 3.1. The wings
Three flat bars either side of the plate, mirrored, in the scout-trail palette: red #c72138 on top, yellow #ffd966 in the middle, cyan #81d8ff at the bottom — the same warm-to-cold order the trail gradient runs vertically, so the button carries the ships' signature at rest.

bar	    length	       thickness
red	    132 px	       9 px
yellow	99 px (0.75)	 6 px
cyan	  40 px (0.30)	 4 px

Nothing about the set is averaged. Lengths fall 1 : 0.75 : 0.30 — a sharp drop at the last step, not an even taper — and thickness falls with them, so the group reads as a signal decaying rather than a chart. Inner ends are flush against a 10 px gutter (left wing right-aligned, right wing left-aligned), so the taper opens outward, away from the words.

Vertically the group is tied to the button, not to fixed numbers:

row:    display:flex; align-items:center; justify-content:center; gap:10px
wing:   display:flex; flex-direction:column; align-self:stretch;
        align-items:flex-end        /* flex-start on the right wing */
red:    height:9px
yellow: height:6px;  margin-top:6px
cyan:   height:4px;  margin-top:auto; margin-bottom:2px

**align-self:stretch** makes each wing exactly as tall as the plate, so the red bar's top edge sits on the button's top edge and the cyan is pushed to the bottom by margin-top:auto. The red→yellow gap is a fixed 6 px; the yellow→cyan gap is simply what remains, which guarantees it stays the larger of the two. The 2 px bottom margin lifts the cyan just inside the lower edge — flush, it looked pinned to the plate rather than floating beside it.

Because the spacing is derived rather than measured, the alignment survives any change to the type size or padding without being re-tuned.

The wings are pointer-events:none — decoration only. They do not participate in the hover state, do not glow, and never animate.

---

## 4. Type

```
IBM Plex Mono 400 · 15px · letter-spacing .18em · uppercase
```

`.18em` is the **widest tracking in the project**, and that is the point: the
CTA is the instrument offering an action, so it gets the most deliberate,
most spaced-out voice on the page. 15 px is also the largest mono size — every
other mono use is 8–13 px.

The bracket convention: `[ ENTER OBSERVATORY ]` with spaces **inside** the
brackets. Brackets mark an action throughout the project; the inner spaces stop
the mono brackets from clamping the words.

Copy rules — the label is a **command to the machine**, not a promise to the
user. `ENTER OBSERVATORY`, not "Explore the data" / "Get started" / "Scroll to
begin". Two words, both nouns-of-operation, no verb-object marketing phrasing,
no arrow glyph, no chevron.

---

## 5. Motion

```css
@keyframes ctaGlow { 0%,100% { opacity:.78 } 50% { opacity:1 } }
```

3.4 s, `ease-in-out`, infinite, on the whole span (plate included, so the
element breathes as one object). Amplitude .78 → 1 is enough to register as
alive at the edge of vision and too small to nag. The period is coprime with
the title's 9 s float and the sheen's 4.6 s, so the hero never develops a beat.

**Hover changes exactly one property**: the outer text-shadow stop goes from a
6 px black knockout to a 20 px blue bloom (`rgba(190,205,255,.9)`). The letters
light up; nothing moves, nothing scales, no colour changes, no background
change, no border appears. The restraint is what keeps it feeling like a
readout that acknowledged you rather than a button that animated.

---

## 6. Behaviour

- **Click** → smooth scroll to `#observatory`.
- **Hover enter/leave** → drives `ctaHover`, the three-value state that runs the
  glitch reveal (see `GLITCH-AND-CTA.md`). `null` on first load so nothing
  animates on mount; `true` → `glitchInSlice`; `false` → `glitchOutSlice`.
- It is the **only** hover state in the hero. Nothing else on page 1 responds to
  the pointer except the globe hotspot.
- Focus: give it a real `:focus-visible` outline in the shipped build —
  `1px solid rgba(200,215,255,.7)`, `outline-offset:3px` — matching the
  project's active-panel border. The prototype omits it.

---

## 7. Don'ts

- No border, no fill colour, no gradient, no shadow under the plate.
- No arrow, chevron, caret, or scroll-hint animation. The bracket is the signal.
- Do not centre it vertically or float it beside the title — it belongs to the
  bottom edge, because it points down the page.
- Do not reuse this treatment for controls inside the observatory. There, the
  language is outlined panels; this plate exists once, for the one moment the
  page asks for a decision.
