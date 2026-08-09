# GLITCH-AND-CTA.md — the glitch reveal

## 1. Hover state machine

```ts
ctaHover: null   // never touched — code blocks have never appeared
ctaHover: true   // hovering  → glitchInSlice
ctaHover: false  // left      → glitchOutSlice
```

The three-value state is the point. On first load nothing must animate, so
`null` renders `animation:none` — without it, all four blocks would play their
exit on mount. `touched = ctaHover != null` gates the out-animation.

---

## 2. The four code blocks

IBM Plex Mono 10.5 px / 1.55 / `.02em`, `rgba(228,232,255,.9)`, `z-index:6`,
`pointer-events:none`, absolutely positioned. Each is a live read of the loaded
dataset — never lorem, never frozen.

| id | position | content |
|---|---|---|
| `c1` | `top:5.5%; left:2%` | archive header + the 20 column names in two padded 16-wide columns |
| `c2` | `top:10%; right:6%` (right-aligned) | `STATUS... TRANSMITTING`, `CURSOR... open`, then the top 6 discovery methods with counts |
| `c3` | `top:max(40%,252px); left:clamp(12px, min(10.5%, calc(50% − (earthPx*1.02 + 200 + 26)px)), 30%)` | a `SELECT pl_name, disc_year, sy_dist` result — 8 rows |
| `c4` | `top:54%; right:clamp(12px, min(9.5%, calc(50% − (earthPx*1.02 + 190 + 26)px)), 30%)` (right-aligned) | method flag matrix — 8 rows of `tr rv im mi` |

### 2.1 The clamp

`c3` and `c4` sit beside the globe, so their inset is derived from it:

```
calc(50% − (lensSize + blockWidth + 26)px)
```

— push in from the centre by the lens radius, the block's own width, and the
26 px margin. `min(…, 10.5%)` keeps them off the edge on wide screens;
`clamp(12px, …, 30%)` stops them crossing the globe on narrow ones. They move
when the globe moves; they never overlap it.

### 2.2 Column formatting

```ts
pad(v, n, right) =>
  v == null ? '—' : String(v).slice(0, n)[right ? 'padStart' : 'padEnd'](n)
```

Text pads left-aligned, numbers pad right-aligned, everything truncates hard at
the column width. Rows are `white-space:pre`, one `<div>` per line.

### 2.3 The chromatic-aberration shadow

```
text-shadow: -1.2px 0 rgba(168,85,247,.7),     /* violet, left  */
              1.2px 0 rgba(234,179,8,.6),      /* amber,  right */
              0 0 10px rgba(6,6,14,.95),
              0 0 22px rgba(6,6,14,.8)
```

A 2.4 px violet/amber split — a misconverged signal, not an RGB-split cliché
(the usual red/cyan would collide with the trail palette). It is **static**: the
fringe does not animate, so the text stays readable while still reading as
transmitted. The two black stops behind it knock the starfield out.

---

## 3. The glitch keyframes

All three run with **`steps(1)`** — no interpolation. Each keyframe is a discrete
frame; the tearing comes from jumping between clip bands, not from easing.

### 3.1 Enter — `glitchInSlice .5s steps(1) [delay] 1 forwards`

```css
@keyframes glitchInSlice {
  0%   { opacity:0; clip-path:inset(0 0 100% 0); transform:translate(-6px,0) }
  12%  { opacity:1; clip-path:inset(0 0  88% 0); transform:translate(-6px,0) }
  24%  {            clip-path:inset(8% 0 62% 0); transform:translate( 4px,0) }
  36%  {            clip-path:inset(42% 0 28% 0);transform:translate(-4px,0) }
  48%  {            clip-path:inset(62% 0  8% 0);transform:translate( 5px,0) }
  60%  {            clip-path:inset(18% 0 48% 0);transform:translate(-2px,0) }
  72%,100% { opacity:1; clip-path:inset(0 0 0 0); transform:translate(0,0) }
}
```

The visible band **walks down the block** (top → 8 % → 42 % → 62 %) then jumps
back up to 18 % before resolving. The out-of-order penultimate frame is what
stops it reading as a wipe. Horizontal offsets alternate sign and shrink
(−6, +4, −4, +5, −2, 0) — a signal settling.

Per-block delays: **0, 90, 145, 220 ms** — uneven on purpose. Even spacing reads
as a staggered animation; uneven reads as four independent feeds arriving.

### 3.2 Exit — `glitchOutSlice .42s steps(1) [i*40ms] 1 both`

```css
@keyframes glitchOutSlice {
  0%   { opacity:1;  clip-path:inset(0 0 0 0);   transform:translate(0,0) }
  18%  { opacity:1;  clip-path:inset(0 0 62% 0); transform:translate( 7px,0) }
  34%  { opacity:.9; clip-path:inset(38% 0 22% 0);transform:translate(-9px,0) }
  52%  { opacity:.75;clip-path:inset(72% 0 4% 0);transform:translate( 6px,0) }
  70%  { opacity:.4; clip-path:inset(12% 0 74% 0);transform:translate(-4px,0) }
  100% { opacity:0;  clip-path:inset(48% 0 48% 0);transform:translate( 2px,0) }
}
```

Shorter (.42 s vs .5 s) and **more violent** — offsets grow to ±9 px and opacity
decays in four steps. It ends on a zero-height band at mid-height, so the block
collapses to a line and vanishes. Exit delays are a flat 40 ms stagger: leaving
is one gesture, arriving is four events.

`both` (not `forwards`) so the block is already invisible during its delay.

### 3.3 `glitchSlice`

The same walk without the opacity ramp — a 60 %-then-hold loop kept for
one-shot disturbances on an already-visible element. Unused in the current build;
keep it, do not put it on a loop.

---

## 4. Rules

- `steps(1)` on every glitch. A smoothed clip-path is a wipe, and wipes look like
  marketing.
- Only the CTA triggers this. Nothing else on the hero has a hover state.
- The blocks are read-only, unselectable, and never interactive.
- Content is always live dataset text. If the data has not loaded, show `----`
  for counts and `—` for values rather than delaying the reveal.
- Under `prefers-reduced-motion`, cross-fade the blocks over 200 ms instead.
