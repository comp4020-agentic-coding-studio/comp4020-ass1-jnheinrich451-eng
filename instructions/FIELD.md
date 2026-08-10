# SECTION 2 — PLANET FIELD
*The centre column: the canvas, its four overlays, its navigation, and the
FIELD GROUND toggle.*
Connected to: `SECTION2-LAYOUT.md` (the grid it sits in), `SECTION2-AXES.md`
(what the canvas draws on top of the points), `SECTION2-DATA.md` (the points
themselves), `SECTION2-LEFT-*.md` (who writes the state it reads).

---

## 0. WHAT THE FIELD IS

The only place on the page where data is drawn, and the only place with a dark
ground. Everything else in section 2 is an outline sitting on the fan. **Nothing
floats in the centre except data and the four thin overlays below** — no cards,
no legends, no tooltips, no floating panels.

One `<canvas>` at `position:absolute;inset:0`, DPR capped at 2, redrawn whole on
every state change. There is no DOM per point; 6,336 records is the reason.

---

## 1. THE BOX

```
position: relative
border:   1px solid rgba(150,170,255,.2)     ← lighter than the rails' .28
background: #03040a  |  transparent          ← the FIELD GROUND toggle, §5
overflow: hidden
min-height: 0                                ← load-bearing in the grid row
cursor:   crosshair
```

The border is deliberately one step fainter than the side panels. The rails are
instruments; the field is a window, and a window's frame should not compete with
what is behind it.

---

## 2. THE FOUR OVERLAYS

All are DOM, all `pointer-events:none` except the projection picker, all IBM
Plex Mono. They are the entire chrome of the field.

**a. Title** — `PLANET FIELD`, `top:14px`, full width, centred, 11.5px, .2em,
`#8f9ad4`. Centred because it names the region, not a control.

**b. FIELD PROJECTION picker** — `top:44px; left:16px`, `width:fit-content`,
`max-width:360px`, padding `8px 12px 10px`, negative margin `-8px 0 0 -12px` so
the text aligns optically to the box edge despite its own padding.
```
FIELD PROJECTION                          #8f9ad4, 7px below
[ ORBIT × SIZE ]  [ EARTH DISTANCE ]  [ DISCOVERY TIME ]  [ SPATIAL // RA + DEC ]
```
Wrapping row, `gap:8px 14px`, 11.5px .14em. Active `#ffffff` with
`text-shadow:0 0 12px rgba(190,205,255,.5)`; idle `#6c7699`; `transition:color .2s`.
Background is a gradient scrim `rgba(3,4,10,.9) → .72` when the ground is
SOLID, and `transparent` + `text-shadow:0 1px 3px rgba(0,0,0,.85)` when CLEAR —
the label must survive being over the fan.

**c. Caption strip** — `bottom:12px; left/right:14px`, `space-between`, wrapping,
11px .05em `#5f6889`.
- left: `6,336 confirmed worlds`, or `1,204 of 6,336 found by Transit`
  — sentence case. It is the author speaking, not the instrument.
- right: `NAV // DRAG · WHEEL ZOOM`, or in SPATIAL
  `NAV // L-DRAG PAN · R-DRAG ORBIT · WHEEL DOLLY`.

**d. Focus-mode strip** — only in EXPAND FIELD: `top:14px; right:16px`,
`{n} SIGNALS` and `[ RETURN ]`, 11.5px .14em.

### Overlays are measured, never assumed
The HUD reads these two elements' live geometry every frame:
```
hudTopReserve()    = projection panel offsetTop + offsetHeight + 10   (fallback 145)
hudBottomReserve() = caption strip offsetTop − 26                     (fallback 26px band)
```
Both change height with content and viewport — the caption's NAV hint wraps to a
second line on a narrow field. Hard-coding either reserve prints tick labels
over the text; it is the one thing that must not be a magic number.

---

## 3. NAVIGATION

| gesture | flat projections | SPATIAL |
|---|---|---|
| drag | pan (`cx,cy -= Δpx / scale`) | left = pan, right = orbit camera |
| wheel | zoom about the cursor | dolly the camera |
| hover | preview nearest point within **18 px** | same |
| click | lock nearest within **16 px**, else clear | same |

```
zoom  = clamp(zoom · exp(−Δy · 0.0015), 1, 6)      anchored at the cursor:
        world point under the pointer is re-solved and cx,cy set so it stays put
dolly = clamp(dist · exp(Δy · 0.0012), 1.25, 7)
orbit = yaw ±Δx·0.006, pitch clamp ±1.45
```

- Wheel is bound with `{passive:false}` on the canvas element, not on the
  window — the page must still scroll everywhere else.
- Right-drag suppresses the context menu **only** in SPATIAL, where it is a
  control; elsewhere the browser menu is left alone.
- A drag of more than 3 px total sets `_dragMoved`, which suppresses the click
  that follows. Panning must never select.
- `findNearest` **respects the method filter**: a dimmed record cannot be picked
  by accident. What you cannot see, you cannot hit.
- Hit radius is larger for hover (18) than for click (16): scanning should be
  generous, committing should be precise.

**FIT FIELD** resets pan/zoom to the projection's fit rect — and in SPATIAL also
resets the camera to `yaw 0.62, pitch 0.34, dist 2.75`.
**CENTER TARGET** (from the TARGET panel) eases 650 ms to the record and stops at
`clamp(zoom, 2.4, 3.2)` — a moderate zoom, so the record keeps its
neighbourhood. It never switches projection, never changes the filter, never
opens the system.

Each projection keeps **its own** pan/zoom and its own fit rect. Switching away
and back returns to the frame you left it in.

---

## 4. EXPAND FIELD (focus mode)

Unmounts both rails; the grid collapses to `minmax(0,1fr)`. The field keeps
every bit of state — projection, filter, selection, camera. The strip in the
top-right replaces the two rails' only irreplaceable readouts: the visible count
and a way out.

Because the canvas resizes after React commits, `setFocusMode` redraws at
0 / 40 / 160 ms. The HUD reserves are measured from DOM, so they need the layout
to have settled.

---

## 5. FIELD GROUND: SOLID / CLEAR

The one toggle in section 2 that changes nothing about the data and everything
about the reading. Footer control, cycling `SOLID ⇄ CLEAR`.

### SOLID (default)
```
field box background         #03040a
fan inner pass mask          linear-gradient(90deg,#000 0 20%,transparent 30%,
                                             transparent 70%,#000 80%)
fan header patch  opacity    .2
fan apex patch    opacity    .3
projection panel  background linear-gradient(180deg,rgba(3,4,10,.9),rgba(3,4,10,.72))
                  text-shadow none
```
The fan is **cut out of the centre column** so the points sit on plain ground.
This is the reading state: colour is data, and nothing behind it competes.

The cut costs two patches. The header strip sits *above* the plot, so it does not
need the cut — refill it at 20 % through a soft-edged mask
(`transparent 18% → #000 30% → #000 70% → transparent 82%`) or the header reads
as a dark band across the fan. The V's apex sits *below* the plot, so restore it
in the bottom 190 px only, faded in from above
(`linear-gradient(180deg,transparent 0,#000 62%)`) and clipped to the same
20–80 % band the cut removes — full width it double-paints the margin ring and
the apex comes out a different red from the arms above it.

### CLEAR
```
field box background         transparent
fan inner pass               no mask — runs edge to edge at .3
fan header + apex patches    opacity 0            ← they only patch the cut
projection panel  background transparent
                  text-shadow 0 1px 3px rgba(0,0,0,.85)
```
The fan runs behind the points at exactly the side rails' 30 %, so the whole
section becomes one continuous graphic. This is the *composition* state: it
shows that the field is part of the identity, not a widget dropped on top of it.

### Rules
1. The toggle touches **presentation only**. No projection, filter, selection,
   camera or scale changes. It is a redraw, not a state change.
2. The two patches exist *because* of the cut. When the cut goes, they go —
   never leave them on in CLEAR, they will double-paint.
3. Anything the ground stops occluding must earn its own legibility: the
   projection picker swaps its scrim for a text-shadow. If a future overlay
   cannot survive CLEAR, it does not belong in the field.
4. Point alpha, radius and colour are **identical** in both states. Fixing
   legibility by brightening the data would make the toggle a data control.

---

## 6. WHAT NEVER APPEARS IN THE FIELD

- Tooltips. The TARGET rail is the tooltip, and it is always in the same place.
- A legend. The OBSERVE rail is the legend, and it is also the filter.
- Point labels. At 6,336 records any labelling is a lie about density.
- Empty-state art. If the filter matches nothing, the field is empty and the
  caption says so.
