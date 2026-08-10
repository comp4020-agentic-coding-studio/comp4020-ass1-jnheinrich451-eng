# SECTION 2 — OPEN SYSTEM / THE ZOOM
*How the archive becomes a system, and how it becomes an archive again.*
Connected to: `SECTION2-RIGHT-TARGET.md` (the button),
`SECTION2-DATA.md` (the record), `HOTSPOT.md` (the planet's own lighting).

---

## 0. THE PRINCIPLE

**The transition starts in the archive, not in the system.** The field itself
dives into the selected mark; the system view takes over at the moment the point
fills the frame. Nothing cuts, and the archive is never mutated — it is saved,
restored under cover, and found untouched on RETURN.

---

## 1. THE DIVE — 720 ms

```
save    { layout, cx, cy, zoom }
tween   cx,cy  → the selected point's own coordinates
        zoom   → zoom × 11
duration 720 ms, accelerating (reads as being pulled in, not gliding)
veil    #03040a, opacity 0 → 1 over 600ms cubic-bezier(.7,0,.9,.3)
```
The veil takes the archive to black **across** the dive so the system shell never
cross-fades against a live field — that double exposure was the blink.
Skipped entirely if: reduced motion, a projection morph is already in flight, or
the system is already open. Then it enters directly.

At 720 ms: mount the system, then silently restore the field's saved pan/zoom
behind the veil. RETURN therefore lands on exactly the frame you left.

## 2. THE ENTRY — 1150 ms

```
camera yaw   = π ± 0.95      (side chosen deterministically per planet name)
camera pitch = 0.24
entry dist   = planetR × 6
approach     from max(orbitR × 1.35, entryDist × 4)  →  entryDist, 1150 ms
```
yaw is measured from the planet→star direction, so π would be a dead-on
full-lit disc. Entering at π ± 0.95 keeps most of the lit face **plus a
terminator**, and throws the star well off the planet's disk — the default frame
is never an accidental eclipse poster. Starting outside the orbit and closing in
makes the move read as *travelling to* the system rather than cutting to it.

## 3. ZOOM INSIDE THE SYSTEM

Wheel (`exp(Δy·0.0012)`, non-passive listener) and the two 30px buttons
(`×0.8` in, `×1.25` out). One continuous range, two regimes:

```
min = planetR × 1.9                        inspection — the planet fills the frame
max = max(planetR × 16, orbitR × 2.6)      overview — whole ellipse + star in one view
```
The floor is derived from the guaranteed periapsis clearance, so **the camera can
never enter the planet and never escape toward the star.** The overview is
somewhere the user chooses to go, not where they land.

Camera orbit is **user-driven only** — drag yaw `×0.006`, pitch `±1.35` clamp.
Nothing moves the viewing angle on its own, so every unprompted motion on screen
belongs to the planet. Revolution is read from the backdrop, the orbit ticks and
the after-image sliding past — never from camera motion.

## 4. ORBIT SCALE ×1 / ×3 / ×5

A pure change of display unit, applied **before** the periapsis clearance rule,
so at wider settings a genuinely tight orbit is allowed to stay tight instead of
being inflated. It is eased, not rebuilt: the ellipse opens or closes and the
planet rides it — which also makes it legible that this is presentation.

The camera's inspection distance is untouched (`planetR` is unchanged), so the
close view is identical at every setting; only the space around it changes.
Nothing in real units depends on it — star apparent size, separation in AU and
Keplerian speed are all computed from archive values.
The panel appends ` · ×3` to `ORBIT SCALE // VISUALLY COMPRESSED`.

## 5. THE RETURN — 560 ms

ESC or `[ RETURN TO FIELD ]`. The camera pulls **back out along the same path**
under the fade (`to = max(orbitR × 2.1, dist × 5)`), and the scene keeps
animating throughout — freezing it first is what made the exit read as a blink.
Then the shell unmounts, the veil lifts, and the archive is exactly as it was:
projection, filter, camera, selection, FIND query, all untouched.

## 6. SHELL CHROME

```
top-left     SYSTEM VIEW / {name} / HOST {host} · {method}     10.5 / 19 / 11px
top-right    [ RETURN TO FIELD ]        bg rgba(4,5,10,.7), border .5 alpha
right panel  ARCHIVE VALUES — 12 rows, 11.5px, line-height 2   214px wide
             then a 1px rule and the disclosure block, 10px, #8f9ad4
bottom-left  − +  ORBIT SCALE  x1 x3 x5   DRAG TO INSPECT · WHEEL TO ZOOM · ESC TO RETURN
```
Narrow: the panel becomes a bottom sheet, `max-height:44%`, gradient scrim.

**The disclosure block is not optional.** It opens with
`DATA-DRIVEN VISUALISATION` / `NOT AN OBSERVED IMAGE` in `#e8c37a`, then names
every compression by hand: planet scale, orbit scale, time scale, orbit speed
(KEPLERIAN), eccentricity, orbit shape, star apparent size, rotation
(ILLUSTRATIVE), surface (PROCEDURAL · NOT OBSERVED), display phase (SIMULATED).
Everything above it in the panel is a raw archive value. That is the whole
contract of the system view: real numbers stated, every liberty named.
