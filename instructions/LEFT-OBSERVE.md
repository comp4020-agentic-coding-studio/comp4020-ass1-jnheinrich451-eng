# SECTION 2 — LEFT BAR / OBSERVE
*The population filter. Owns one piece of state and nothing else.*
Connected to: `SECTION2-LEFT-FIND.md` (its sibling tab), `SECTION2-DATA.md`
(method → colour), `SECTION2-LAYOUT.md` (the box it sits in).

---

## 1. THE TAB PAIR — shared by both panels

```
row: display:flex; gap:5px
button: flex:1; padding:6px 4px; 10.5px; letter-spacing:.16em
  on   background rgba(150,170,255,.16)  border rgba(200,215,255,.6)  #ffffff
  off  transparent                        border rgba(150,170,255,.26) #8f9ad4
```
Labels `OBSERVE` and `FIND`, in that order. **Switching tabs changes nothing
about the archive** — not the filter, not the projection, not the selection,
not the camera. It only swaps which control surface is visible.

OBSERVE is the default (`panelMode:'observe'`).

---

## 2. STRUCTURE

```
OBSERVATION
METHOD                 11.5px .18em #8f9ad4, line-height 1.6, hard <br/>
──────
● ALL
○ TRANSIT
○ WOBBLE
○ IMAGING
○ MICROLENS
```
Column `gap:12px` between heading and list; `gap:2px` between rows.

## 3. THE ROWS

```
row:   display:flex; align-items:center; gap:8px; padding:5px 4px
       12px, letter-spacing .1em, transition color .2s
       active #ffffff · idle #9aa3ca
dot:   ● when active, ○ when not — 10px, width:12px, inline-block
       active colour = the method's own colour
       idle colour   = rgba(150,170,255,.45)
```

| label | id | dot colour when active |
|---|---|---|
| ALL | `all` | `#dfe4ff` |
| TRANSIT | `Transit` | `#e8c37a` |
| WOBBLE | `Radial Velocity` | `#9fc4ff` |
| IMAGING | `Imaging` | `#c79bff` |
| MICROLENS | `Microlensing` | `#ffffff` |

Labels are the *observing act*, not the catalogue term: WOBBLE, not
"radial velocity". The catalogue term still appears verbatim in the TARGET
panel and in FIND rows, so nothing is renamed away.

## 4. BEHAVIOUR

- Click sets `methodFilter`. Nothing else changes — projection, pan/zoom,
  selection and FIND query all survive a filter change.
- The change is **animated, not switched**: every point interpolates radius
  `2.0 → 1.2 px` and alpha `0.8 → 0.1` (or back) on a shared clock, so the
  excluded population dims in place rather than disappearing. Formula in
  `SECTION2-DATA.md § 5`.
- Anything filtered out is still drawn, still counted, still hoverable-adjacent
  in space. The archive is never subsetted; only its emphasis moves.
- The footer's `VISIBLE` / `UNRESOLVED` counts and the field caption re-read
  from the filter immediately.
- The axis domains do **not** rescale on filter change (`SECTION2-AXES.md § 2`).

## 5. WHY IT IS FIVE OPTIONS

Four real method buckets plus ALL. Every other discovery method in the archive
collapses into `Other` (`#6c7699`) — it is drawn and counted, but it is not
offered as a filter, because a bucket you cannot describe is not a question a
user can ask.
