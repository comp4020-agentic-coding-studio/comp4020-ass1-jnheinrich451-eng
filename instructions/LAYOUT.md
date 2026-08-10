# SECTION 2 — LAYOUT & DESIGN FORMULA
*The archive page. Everything below is the frame and the words; the six sibling
documents own the parts inside it.*

Siblings: `SECTION2-LEFT-OBSERVE.md` · `SECTION2-LEFT-FIND.md` ·
`SECTION2-RIGHT-TARGET.md` · `SECTION2-AXES.md` · `SECTION2-DATA.md` ·
`SECTION2-OPEN-SYSTEM.md`

---

## 1. STACK — bottom to top

| z | layer | rule |
|---|---|---|
| 0 | page ground `#03040a` | never changes |
| 1 | starfield SVG | see `STARFIELD.md` |
| 2 | **straight fan** ×4 passes | see `STRIPE.md` (§ section-2 geometry) |
| 3 | frame box | `border:1px solid rgba(150,170,255,.34)`, `padding:18px` |
| 4 | three-column grid | header / grid / footer |
| 39 | dive veil | `#03040a`, opacity 0 → 1, see OPEN-SYSTEM |
| 40 | system shell | full-bleed, mounted only while open |

### Fan passes (all `position:absolute;inset:0;pointer-events:none`)

| pass | opacity | clip-path | mask |
|---|---|---|---|
| ring (outer) | .5 | `polygon` ring, 26px inset | — |
| inner | .3 | `inset(26px)` | centre cut `linear-gradient(90deg,#000 0 20%,transparent 30%,transparent 70%,#000 80%)` |
| header patch | .2 | `inset(26px 26px calc(100% - 84px) 26px)` | `linear-gradient(90deg,transparent 18%,#000 30%,#000 70%,transparent 82%)` |
| apex patch | .3 | `inset(calc(100% - 190px) 20% 26px 20%)` | `linear-gradient(180deg,transparent 0,#000 62%)` |

The centre cut exists so the plot column reads against solid ground. **FIELD
GROUND: CLEAR** drops the cut, sets the field background transparent, and hides
the header + apex patches (they only patch what the cut removed).

---

## 2. GRID

```
height: calc(100vh - 52px)            /* definite, not min-height */
grid-template-columns: 210px  minmax(0,1fr)  230px
grid-template-rows:    minmax(0,1fr)
gap: 18px
```

- **Focus mode** (`EXPAND FIELD`) → `minmax(0,1fr)`, both side panels unmounted.
- **Narrow (<640px)** → single column, rows `auto 58vh auto`, gap 14px, frame box
  switches to `min-height` so the stack may grow.
- `minmax(0,1fr)` on the row is load-bearing: without it a long FIND list makes
  the row content-driven and stretches the page past the viewport.

Panel boxes: `border:1px solid rgba(150,170,255,.28)`, left pad `14px 12px`,
right pad `16px 14px`, both `display:flex;flex-direction:column;min-height:0`.
Field box: `border:1px solid rgba(150,170,255,.2)`, `overflow:hidden`.

---

## 3. TYPE — one family, six sizes

IBM Plex Mono throughout. No other face appears in section 2.

| role | size | tracking | colour |
|---|---|---|---|
| header strip | 12px | .16em | `#cfd6f6` / `#8f9ad4` |
| panel headings (OBSERVATION METHOD, TARGET, PLANET FIELD) | 11.5px | .18–.2em | `#8f9ad4` |
| target name | 15px | .02em | `#fff` |
| body rows / footer | 11.5px | .1em | `#cfd6f6` |
| sub-labels, FIND rows | 10.5px | .08–.18em | `#8f9ad4` |
| micro (SHOWING, disclosures) | 9.5px | .1em | `#5f6889` |
| canvas ticks | 9.5px | — | `#8f9ad4` |

Palette: ink `#03040a` · line `rgba(150,170,255,.28)` · dim text `#5f6889` ·
mid `#8f9ad4` · body `#cfd6f6` · bright `#e6e9fb` / `#fff` · caution `#e8c37a`.
Method colours in `SECTION2-DATA.md`.

---

## 4. WORDS — exact copy, in reading order

**Header strip** (`justify-content:space-between`, 12px, pad `0 4px 16px`)
- left: `BLINDSPOTS / EXOPLANET ARCHIVE`
- right: `{n} CONFIRMED WORLDS` (locale-formatted, `#8f9ad4`)

**Left column** — tab pair `OBSERVE` | `FIND`, then the active panel.
See the two left-bar documents.

**Field (centre)**
- top centre: `PLANET FIELD`
- top-left overlay: `FIELD PROJECTION` then four picks in brackets —
  `[ ORBIT × SIZE ]` `[ EARTH DISTANCE ]` `[ DISCOVERY TIME ]` `[ SPATIAL // RA + DEC ]`
- bottom-left: `{n} confirmed worlds` — or `{m} of {n} found by {method}`
- bottom-right: `NAV // DRAG · WHEEL ZOOM`, and in SPATIAL
  `NAV // L-DRAG PAN · R-DRAG ORBIT · WHEEL DOLLY`
- focus mode only, top-right: `{n} SIGNALS` and `[ RETURN ]`

**Right column** — `TARGET`. See `SECTION2-RIGHT-TARGET.md`.

**Footer strip** (11.5px, .1em, pad `16px 4px 0`, three groups, wrap)
1. `VIEW: {label}` · `/` · `{axes}`
2. `VISIBLE: {n}` · `UNRESOLVED: {n}`
3. `FIELD GROUND: SOLID|CLEAR` · `EXPAND FIELD` · `FIT FIELD`

Axes strings (footer group 1, right half):
```
ORBIT × SIZE      X: ORBITAL PERIOD [D]   Y: RADIUS [R⊕]
EARTH DISTANCE    ORIGIN: SOL   R: LOG DISTANCE [PC]   ANGLE: DISPLAY DISTRIBUTION
DISCOVERY TIME    T: DISCOVERY YEAR   Y: DISPLAY DISTRIBUTION
SPATIAL // RA+DEC ORIGIN: SOL   DIRECTION: RA + DEC   R: LOG DISTANCE [PC]
```
Mid-morph the label reads `{from} → {to}` and the axes read `PROJECTING…`.
Never claim the destination mapping while the field still looks like the source.

---

## 5. VOICE RULES (apply to every string on the page)

1. Uppercase, spaced, instrument-panel. Sentence case only for the field caption.
2. A value that is absent is `UNRESOLVED` — never `0`, never `—`, never hidden.
3. Anything compressed for display says so: `VISUALLY COMPRESSED`,
   `DISPLAY DISTRIBUTION`, `DISPLAY SPREAD · NO DATA AXIS`.
4. Actions are bracketed: `[ OPEN SYSTEM ]`, `[ RETURN ]`, `[ SHOW 120 MORE ]`.
5. Separator between facts is ` · ` (\u00B7); between a label and its value `//`.
