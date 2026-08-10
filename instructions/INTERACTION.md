# SECTION 2 — INTERACTION
*The input grammar and every transition, defined once. Where a number appears
here it is the number; the other section-2 documents reference it rather than
restating it.*

Connected to: `SECTION2-FIELD.md` (the surface the gestures land on),
`SECTION2-DATA.md` (what moves), `SECTION2-AXES.md` (what cross-fades),
`SECTION2-OPEN-SYSTEM.md` (the sequence this file times).

---

## 1. THE INPUT GRAMMAR

Three verbs, and each one keeps its meaning everywhere in the piece.

| verb | means | never means |
|---|---|---|
| **hover** | preview — show me, don't commit me | select |
| **click** | lock — this is my target now | navigate |
| **drag** | move the *view* | move the *data* |

Consequences that are enforced in code:
- A drag exceeding **3 px** total sets `_dragMoved` and swallows the click that
  follows. Panning can never select.
- Hover writes `previewIdx`; a FIND row hover writes the **same** field, so a row
  hover and a point hover can never disagree about what is being previewed.
- Nothing in the field is a link. Every navigation is an explicit bracketed
  action in a rail: `[ CENTER TARGET ]`, `[ OPEN SYSTEM ]`, `[ RETURN ]`.

### Hit radii
```
hover  18 px      generous — scanning should be easy
click  16 px      precise — committing should be deliberate
```
Both respect the method filter: a dimmed record cannot be picked. **What you
cannot see, you cannot hit.**

---

## 2. LEFT = TRANSLATE, RIGHT = ROTATE

In SPATIAL // RA + DEC the view has both a position and an orientation, so one
drag is not enough. The split is the standard one:

```
left drag    TRANSLATE   pans the view — the frame slides, the camera's
                         orientation is untouched
right drag   ROTATE      orbits the camera about SOL — yaw ±Δx·0.006,
                         pitch += Δy·0.006 clamped to ±1.45 rad
wheel        DOLLY       dist = clamp(dist · exp(Δy·0.0012), 1.25, 7)
```

This is the convention every 3D viewport since the 1990s has used — CAD, DCC
tools, game editors, GIS. **Do not invent a different one.** A user who has ever
touched a 3D application already knows this control set, and the cost of being
novel here is that the projection feels broken rather than clever. Three
consequences worth keeping:

1. **The verb that costs the most is the one you must ask for.** Rotation
   changes what "up" and "toward" mean; it lives on the secondary button so it
   cannot happen by accident while you are reading.
2. **The primary button keeps its meaning across all four projections.** In the
   three flat projections there is no orientation to change, so left-drag pans
   and right-drag does nothing. The muscle memory transfers intact.
3. **Right-click is only claimed where it is a control.** `contextmenu` is
   prevented in SPATIAL and nowhere else — the browser menu stays available in
   every other projection and over every rail.

The rotation is **user-driven only**, here and in the system view. Nothing
orbits the camera on its own, so any unprompted motion on screen belongs to the
data. That is the whole reason a slow-moving planet reads as moving.

Wheel is bound with `{ passive: false }` on the canvas element itself, never on
the window: the page must still scroll everywhere else on the page.

---

## 3. THE TRANSITION TABLE

| transition | duration | curve | what interpolates |
|---|---|---|---|
| projection morph | **900 ms** | `easeInOut` cubic | points, fit rect, pan, zoom, depth cue, HUD alpha |
| method filter | shared clock | linear | point radius 2.0⇄1.2 px, alpha 0.8⇄0.1 |
| CENTER TARGET | **650 ms** | `easeInOut` | cx, cy, zoom |
| dive into system | **720 ms** | accelerating (`cubic-bezier(.7,0,.9,.3)` veil) | cx, cy, zoom ×11 |
| system approach | **1150 ms** | `easeInOut` | camera distance only |
| system exit | **560 ms** | fade out, scene still running | camera distance outward |
| orbit scale ×1/×3/×5 | 600 ms | ease-out | orbit display radius only |
| envelope settle | ~160 ms | exponential `k = 1 − e^(−dt/0.055)` | HUD tape extents |
| hover / value change | ≤ 120 ms | linear | colour only |

```js
easeInOut(p) = p < 0.5 ? 4p³ : 1 − (−2p + 2)³ / 2
```
One curve for everything that changes the frame. Values change instantly;
frames change with mass.

---

## 4. PROJECTION MORPH — 900 ms

The hardest transition in the piece, because it is a **coordinated change of
representation**, not a move.

```
1  snapshot the CURRENTLY DRAWN positions as the source
2  snapshot the CURRENTLY RENDERED pixel mapping (fit rect + pan + zoom)
3  snapshot the source depth cue (SPATIAL only)
4  interpolate all of them on one eased clock
5  cross-fade the HUDs: source out over the first 35%, destination in over the
   last 35% — the points own the middle
6  at 55% the footer stops saying "A → B" and claims the destination
```

Rules that each fix a specific failure:
- **Retarget from the drawn positions, not the source layout.** Switching twice
  quickly otherwise teleports records or draws them twice.
- **Interpolate the mapping too.** Switching the fit rect at morph start made the
  field jump before any point had moved.
- **Interpolate the depth cue** (1.0 = no cue) instead of switching it. Only
  SPATIAL has one; switching it on in a single frame is a visible pop.
- **Furniture resolves from the layout being drawn**, not from the active data —
  on frame 1 the active data is already the destination, which made the
  UNRESOLVED annotation pop rather than cross-fade.

### After-image
Not a motion blur and not a velocity vector — instrument persistence.
```
slice   the last 14% of the interpolation path, per point
cap     22 px
alpha   base × 0.20   (0.34 if selected)
envelope sin(π · p)   — zero at both ends, so nothing survives completion
width   0.9 px
size    point radius × (1 + 0.1 · envelope)
```

---

## 5. CENTER TARGET — 650 ms

Locates the locked record **inside the current projection**.

```
to.cx, to.cy = the record's own coordinates
to.zoom      = clamp(current zoom, 2.4, 3.2)
```
It stops at a moderate zoom so the record keeps its neighbourhood — a target
alone in an empty frame tells you nothing about where it sits. It never switches
projection, never changes the filter, never opens the system, and it moves the
*view*, never the point. It is offered only when the record is resolved in the
current projection; otherwise there is nowhere to centre on and the button is
absent rather than dead.

---

## 6. ENTERING OPEN SYSTEM

Four beats, ~1.9 s total. The first two belong to the archive, the last two to
the system.

```
t=0      dive begins IN THE FIELD
         save { layout, cx, cy, zoom }
         tween cx,cy → the selected point;  zoom → zoom × 11;  720 ms accelerating
         veil #03040a fades 0 → 1 over 600 ms, cubic-bezier(.7,0,.9,.3)
t=720    mount the system; restore the field's saved pan/zoom BEHIND the veil
         camera yaw = π ± 0.95 (side deterministic per planet name), pitch 0.24
t=720    approach begins: dist from max(orbitR × 1.35, entry × 4) → planetR × 6
         1150 ms easeInOut
t≈1870   at rest, inspection distance
```

Why each part is there:
- **The transition starts in the archive.** The field itself dives into the mark,
  so the system is somewhere you *travelled to*, not a modal that appeared.
- **Accelerating, not eased both ways.** Being pulled in reads as gravity;
  gliding in reads as a slideshow.
- **The veil takes the archive fully to black.** Cross-fading the system shell
  against a live field was the double exposure that read as a blink.
- **Restore the field under the veil.** RETURN then lands on exactly the frame
  you left, with no restoration visible.
- **Enter at π ± 0.95, not π.** Dead-on is a full-lit disc with the star behind
  the camera. Off-axis keeps most of the lit face *plus* a terminator and throws
  the star clear of the planet's disk, so the default frame is never an
  accidental eclipse poster.
- **Approach from outside the orbit.** Starting wide and closing in states the
  scale of the system before it states the planet.

Skipped entirely — enters directly — if reduced motion is set, a projection
morph is already in flight, or the system is already open.

---

## 7. LEAVING OPEN SYSTEM — 560 ms

ESC or `[ RETURN TO FIELD ]`.

```
camera pulls BACK OUT along the same path:  dist → max(orbitR × 2.1, dist × 5)
shell fades out, 560 ms
the scene keeps animating throughout
veil lifts, 480 ms ease-out
shell unmounts
```

- **The exit is the entry reversed.** Leaving by the door you came in is what
  makes the system feel like a place.
- **Never freeze the scene before the fade.** That is precisely what made the
  exit read as a blink: motion stopping and the image dissolving at the same
  instant reads as a cut, not a departure.
- **The archive is found untouched.** Projection, method filter, pan, zoom,
  camera, selection, FIND query and scroll are all exactly as they were. Opening
  a system is a look, not a navigation.

---

## 8. REDUCED MOTION

`prefers-reduced-motion: reduce` is honoured everywhere, and it means *skip*, not
*shorten*:

- projection change → instant, no trail, no eased mapping
- CENTER TARGET → instant jump
- OPEN SYSTEM → no dive, no approach; mounts at the entry framing
- RETURN → no pull-back
- HUD envelope → snaps to the target extents

Nothing is removed from the interface and no state differs. Every readout, count
and disclosure is identical — only the travel between states is skipped.

---

## 9. THE RULE UNDER ALL OF IT

**Motion is either explaining a change or it is noise.** Every transition in
this document exists to answer one question the user would otherwise have to ask:
*where did that go, where am I now, what changed, and can I get back?*
If a proposed animation does not answer one of those, it does not belong here.
