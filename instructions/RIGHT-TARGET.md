# SECTION 2 — RIGHT BAR / TARGET
*One record, read-only, plus the two actions that act on it.*
Connected to: `SECTION2-LEFT-FIND.md` (writes the selection),
`SECTION2-OPEN-SYSTEM.md` (the button at the bottom),
`SECTION2-AXES.md` (CENTER TARGET moves the view, not the data).

---

## 1. BOX

230px column, `padding:16px 14px`, border `rgba(150,170,255,.28)`,
column `gap:14px`, its own scroller (`overflow-y:auto`, same purple scrollbar
as FIND). Unmounted in focus mode.

## 2. THREE STATES

**Header** — always: `TARGET` (11.5px .18em) and, when a record is loaded, a
`×` at 13px on the right that clears the selection.

**Empty** — `No target` / `selected`, 11.5px, `#5f6889`, line-height 1.8.
Sentence case: it is a status, not a label.

**Preview** — if the record arrived by hover rather than click, a banner sits
above the name: `PREVIEW · NOT LOCKED`, 9.5px .18em `#e8c37a`. The panel is
otherwise identical, so scanning FIND reads full records without committing.

## 3. RECORD BLOCK

```
{planet name}                15px  #ffffff  .02em
{host}                       11px  #8f9ad4  line-height 1.7
{METHOD} · {year}            same line block, 14px below

ORBIT…… 0.045 AU             11.5px  line-height 2.1  #cfd6f6
PERIOD… 3.5 D
RADIUS… 1.24 R⊕
MASS……. 3.10 M⊕
EQ TEMP. 812 K
DIST……. 12.4 PC
```
Six rows, fixed order, fixed precision (3/1/2/1/0/1 decimals). Labels are padded
to equal width with `…` so the values form a hard left column — a leader dot
row, not a table. Any missing value prints `UNRESOLVED` in the same slot.

## 4. UNRESOLVED NOTE

If the record cannot be placed in the **current** projection:
```
──────────────── 1px rule rgba(150,170,255,.22), 16px above / 12px pad
CURRENT PROJECTION // UNRESOLVED      #e8c37a
MISSING // ORBITAL PERIOD, PLANET RADIUS
```
The missing fields are named per projection (see `SECTION2-DATA.md § 3`), so the
panel explains *why* a point sits in the holding cloud instead of the plot.
This note changes when the projection changes; the record above it does not.

## 5. ACTIONS

Both full width, transparent, mono, uppercase, bracketed.

| button | shown when | style |
|---|---|---|
| `[ CENTER TARGET ]` | the record is resolved in this projection | `padding:8px`, border `rgba(150,170,255,.32)`, 10.5px .14em `#9aa3ca`, 14px above |
| `[ OPEN SYSTEM ]` | always, once a record is loaded | `padding:10px 8px`, border `rgba(150,170,255,.5)`, 11.5px .16em `#cfd6f6`, 10px above |

Hover lifts border and text to `#ffffff`; focus is `outline:1px solid #cfd6f6;
outline-offset:2px`. CENTER TARGET eases the field's pan/zoom to the point and
never moves the point. OPEN SYSTEM is the dive — `SECTION2-OPEN-SYSTEM.md`.

## 6. RULE

This panel is a **readout**. It never edits, never rounds silently, never
substitutes. Every number here is an archive value; every derived or compressed
number lives in the system view, where it is labelled as such.
