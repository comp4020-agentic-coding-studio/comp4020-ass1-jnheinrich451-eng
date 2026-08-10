# SECTION 2 — LEFT BAR / FIND
*The second tab of the same box. A way of REACHING a record — never a change to
the archive itself.*
Connected to: `SECTION2-LEFT-OBSERVE.md` (shares the box, the tab pair, and
`methodFilter`), `SECTION2-RIGHT-TARGET.md` (a click lands there),
`SECTION2-DATA.md` (columns, coverage).

---

## 0. THE CONNECTION TO OBSERVE — read this first

FIND searches **inside the population OBSERVE has selected.** The pipeline is
fixed and one-directional:

```
archive rows
  → methodFilter        (owned by OBSERVE)     → pool
  → REQUIRE DATA flags  (owned by FIND, AND)   →
  → text query          (name or host)         →
  → sort                                       → results
  → limit (80, +120)                           → rendered rows
```

Consequences, all deliberate:
- The count reads `{results} / {pool} CURRENT SIGNALS` — the denominator is
  OBSERVE's pool, not the archive, so the two panels are visibly linked.
- FIND never writes `methodFilter`. `CLEAR` clears query, requirements and sort
  and touches nothing else.
- Switching back to OBSERVE keeps the query alive; returning to FIND finds it
  exactly as left.
- Results are memoised on the key
  `methodFilter | query | requirements | sort` — the OBSERVE state is part of
  the cache key, so a filter change invalidates the list for free.
- Any change to the population resets the paging window to 80, never the query.

---

## 1. STRUCTURE — top to bottom, column gap 11px

```
TARGET SEARCH                     10.5px .18em #8f9ad4, 6px below
[ text input ]
[SYSTEM READY] [NEAREST] [RECENT] chips, wrap, gap 4px
REQUIRE DATA                      10.5px .18em
REQUIRE ALL SELECTED              9.5px .08em #5f6889
□ ORBIT … (8 rows)
SORT  [ select ]
{n} / {pool} CURRENT SIGNALS               CLEAR
(empty state, only when 0)
[ result rows ]
[ SHOW n MORE ]
SHOWING x OF y                    9.5px .1em #5f6889, 1px top rule
```

The **column itself is the scroller** (`overflow-y:auto`, `min-height:0`,
`overscroll-behavior:contain`); the list inside is `flex:0 0 auto` plain flow.
Making the list the scroller collapses it to zero height — it becomes the only
shrinkable child of a definite-height column and absorbs the whole deficit.
Narrow only: the list gets its own `max-height:300px` scroller.

Scrollbar (the one CSS rule that cannot be inline): 10px, thumb `#7a5cc4`
radius 6, 2px `rgba(3,4,10,.9)` border, glow `0 0 7px rgba(154,116,255,.75)`;
hover `#a184f0`. Track `rgba(70,50,120,.14)`.

## 2. CONTROLS

**Input** — full width, `padding:7px 8px`, `background rgba(3,4,10,.85)`,
border `rgba(150,170,255,.32)`, 11px, placeholder
`Search planets or host stars`. Matches planet name OR host name,
case-insensitive substring. `Esc` returns to the OBSERVE tab.

**Presets** — `padding:4px 7px`, 10px, `white-space:nowrap`:
- `SYSTEM READY` → adds the `sysready` requirement
- `NEAREST` → sort by distance
- `RECENT` → sort by discovery year
Each is a shortcut into an existing control, never a hidden fourth filter.

**REQUIRE DATA** — 8 checkboxes, `■`/`□` in an 11px slot, AND-combined:

| label | requires columns |
|---|---|
| ORBIT | orbper, orbsmax |
| SIZE | rade |
| MASS | bmasse |
| TEMPERATURE | eqt |
| DISTANCE | dist_pc |
| SKY POSITION | ra, dec |
| ECCENTRICITY | ecc |
| SYSTEM VIEW READY | orbper, orbsmax, rade, teff, srad |

**SORT** — NAME · DISTANCE · DISCOVERY YEAR · RADIUS. Missing values always sort
last, never as zero.

## 3. RESULT ROW

```
padding:9px 9px 10px · line-height 1.45 · flex:0 0 auto · left border 2px
   selected  bg rgba(150,170,255,.16)  border #cfd6f6
   preview   bg rgba(150,170,255,.08)  border rgba(150,170,255,.5)
   idle      transparent               border transparent

line 1  {planet name}                            ●●○○      11.5px / 8px
line 2  {METHOD} · {year}                                  9.5px #8f9ad4
line 3  R 1.24 R⊕ · M 3.1 M⊕ · T 812 K       SYS READY     9.5px #5f6889
```
Line 3 takes at most three of R / M / T / D in that priority; with none it
reads `NO DISPLAY VALUES`. The four dots are the coverage glyph
(`SECTION2-DATA.md § 6`) and are always duplicated into `aria-label` as
"n of 4 visualisation data groups available" — the marks are never the only
carrier.

## 4. HOVER IS PREVIEW, CLICK IS LOCK

- Hover / focus a row → `previewIdx`. This is the **same state a field hover
  writes**, so a row hover and a point hover can never fight, and the point in
  the field lights up as you scan the list.
- Click → `selectedIdx`, `previewIdx` cleared. The TARGET panel fills in and
  shows no PREVIEW banner.
- Preview is suppressed entirely on narrow (no hover, and it would fight the
  scroll).

## 5. EMPTY + PAGING

Empty state, `#e8c37a`:
```
NO TARGETS MATCH CURRENT FILTERS
REQUIRING // ORBIT + SIZE          (or QUERY // {text})
[ CLEAR DATA FILTERS ]
```
It names *which* constraint bit, and the button clears only the requirements.

Paging: 80 rows, then `[ SHOW n MORE ]` (+120, dashed border). Footer always
states `SHOWING x OF y` — the list never pretends to be complete.
