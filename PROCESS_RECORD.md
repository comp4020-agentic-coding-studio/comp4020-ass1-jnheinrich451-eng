# Process record

The raw, append-only history that `PROCESS.md`'s few curated moments get picked
from. Oldest first. See `.claude/skills/process_record/SKILL.md` for the format.

---

## 2026-08-10 00:20 — SKILL.md for process recording

**Prompt:**

> Ty, and need fix, but before that, please give me a SKILL.md in
> /process_record, the content is about follow the PROCESS.md requirement, but
> not record directly in PROCESS.md, but in PROCESS_RECORD.md. We record each
> prompt, and the results, if I mentioned something is not good, then add in it
> in What happened section. This SKILL.md first!

**Result:**
Wrote the skill: when to append, the entry format above, and the conditional
`What happened` section. Reasoning captured in the skill itself — `PROCESS.md`
asks for three or four moments, and that curation silently discards everything
not chosen, including corrections worth remembering.

## 2026-08-10 00:30 — Making the skill invocable

**Prompt:**

> Good, and then for recording, oh I cannot use dash command to find
> /process_record?

**Result:**
Moved it from `process_record/SKILL.md` to
`.claude/skills/process_record/SKILL.md`. Claude Code only discovers project
skills under `.claude/skills/<name>/`, not an arbitrary repo folder, so a
correct file in the wrong place is invisible.

**What happened:** the skill was unusable where I first put it. I created it at
the literal path asked for without checking the discovery rule, so it existed
but could not be invoked. Consequence to note: `.gitignore` line 22 is
`.claude/`, so the file is local tooling and won't appear in the graded repo.

## 2026-08-10 00:38 — Two fan geometries; hero was shipping page 2's

**Prompt:**

> Yes you find it. The stripes contains two parts, one is the you just
> completed, it is for page 2, flip it into page 2. The flip means we refer the
> bottom margin of first page, the seam of second page, and flip 180 degrees
> upside down. And for first page, use the HERO instruction. It should be
> curved, like rocket climb high, and near top near parallel, which refer the
> Starfield art style, and the Halo in game HALO, the curve form. Refer to
> STRIPE.md. And I noticed a thing, CLAUDE.md is restored to default? Oh they
> are about Astro instruction. I will update before submit the prompt, which
> will define art style, aesthetic view, layout. Please record it after
> completion, I cannot use the skill in this message.

**Result:** [`c8f832d`](../../commit/c8f832d)

- `fan.ts` gains `heroTrails()` (§A) beside `fanBands()` (§B). Hero: 12 mirrored
  paths, full opacity on `#000`. Observatory: §B's V unflipped, wide edge at the
  top, meeting the hero's bottom edge.
- Each §A boundary ships as **one exact cubic Bézier** instead of §A.5's
  65-sample polyline. `x(u)` is exactly cubic and `y(u)` exactly linear, so the
  boundary *is* a cubic Bézier and the control points fall straight out of
  `p1_k`/`p2_k`. Same curve, zero sampling error, ~10× less markup. Every
  constant is verbatim — this is a change of representation, not of design.
- Corrected an indexing slip in the spec, not the design: §A.2 prints
  `bottom_k = cx − cx(1 − k/N)^P`, which reverses `k` and so contradicts §A.4's
  own table, §A.3's "0 = centre white", §A.5's `FAN_COLORS[N−1−k]` fill, and
  page 2's seam. Four out of five say `(k/N)^P` counted centre-out; used that,
  and the generated anchors then reproduce §A.4 exactly.
- Hero canvas was `WebGLRenderer({antialias:true})` — opaque, so it would have
  hidden the fan sitting under it. Now `alpha:true` with a transparent clear
  colour. Added §A.6's vignette and scanline layers, which is what makes the
  title legible over a full-opacity fan without dimming the fan.

Verified: `pnpm check` green 22/22; new tests re-derive both fans from `fan.ts`
and assert page 1's bottom anchors equal page 2's top anchors; screenshots in
Chrome at 1920×1080 and 390×844 show the bundle reading as a climb at both and
no colour boundary stepping across the seam; console clean.

**What happened:** the hero was showing the wrong geometry — page 2's
straight-line V, flipped, at 30% opacity. The cause was that the earlier
`STRIPE.md` described one geometry, and I read the first formula I found as
*the* fan rather than asking which section governed which page. Also noted: the
Astro rules the user saw are in `~/Downloads/CLAUDE.md`, a *different* project's
file (the crit-2 fungi site) that happens to load as a parent-directory
instruction here. This repo's own `CLAUDE.md` is unchanged and names no stack;
this repo remains plain Vite/TS. The user is rewriting this repo's `CLAUDE.md`
to carry art direction, aesthetic and layout.

## 2026-08-10 00:58 — Title scale, 1R limb glow, whiter starfield

**Prompt:**

> Good, and for next, some minor style fixes. First is the BLINDSPOTS title,
> make it smaller, in all scale. I prefer the first B and last S, they cross the
> sihouette of Mars of left and right. […ASCII sketch of the title crossing the
> disc…] The B's left part is outside of the Mars, last S right part is outside
> of Mars. Second, the reflective sphere cover outside of the Mars. You can
> refer the effect in /assets/20260806222212_1.jpg, the Starfield style. When
> the Mars receives the light, then edge emit highlights. The reflective cover,
> can set to 1R of the Mars, which means the same radius of the 3D model of the
> Mars. Third, the background Stars. pls make them looks more white and blue,
> and some blink frequent, some emit strong lights consistently with some Lumen
> variation. Overall it is good. Lets see the modification, if not ideal, then I
> will add more instructions.

**Result:** [`4330298`](../../commit/4330298)

- **Title** — `fitTitle()` sizes it by *measuring* rather than by a font ratio:
  100px probe, read `scrollWidth`, discount the trailing letter-space (not ink),
  scale once to `1.08 ×` Mars's on-screen diameter. Measuring is what makes the
  limb crossing hold when Poppins hasn't loaded; re-fits on
  `document.fonts.ready`. The CSS clamp is now only the no-JS fallback.
- **Limb glow** — 1.06R warm-gold `BackSide` atmosphere → 1R cool blue-white
  shell driven by light direction, so only the sunlit limb burns. Required
  `FrontSide` + `depthTest: false`, not the usual oversized `BackSide` shell: at
  1R a `BackSide` shell has `dot(N,V) < 0` everywhere, so the fresnel term
  saturates and floods the whole disc, and a depth-tested same-radius shell
  z-fights the model it wraps.
- **Starfield** — white through blue-white, no gold or purple; per-star
  `rate`/`flicker`/`mag` instead of one shared sine (~8% bright and near-steady
  with slow lumen variation, ~26% fast blinkers), two detuned sines so the
  variation isn't a clean loop.

**What happened:** nothing the user flagged, but the rendered page flagged two
things my code review would not have. Both were invisible at 1920×1080 and only
appeared in the 390×844 screenshot:

1. The title landed *inside* the limb on the phone. Mars was wider there than
   `94vw / TITLE_OVERHANG`, so `fitTitle()`'s viewport safety cap bound before
   the Mars-relative size did — the cap silently won and the design intent
   silently lost. Fixed by raising the narrow-viewport camera pull-back ceiling
   1.6 → 1.78, and the lesson is worth keeping: **that ceiling is set by the
   title, not by Mars.**
2. Mars was fully unlit in that frame. The sun orbited a full 360°, so the
   planet sat in shadow for half of every ~70 s cycle — a marker could load the
   page and find a black disc. `placeSun()` now sweeps a 0.28 rad arc about
   −1.05 rad, side-lit front-left at all times.

Both are the same class of bug: time- or viewport-dependent state that a static
read of the diff cannot show. Screenshotting *both* marking viewports is not a
final check, it is the only way these surface.
