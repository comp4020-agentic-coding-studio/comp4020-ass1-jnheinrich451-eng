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

## 2026-08-10 01:30 — TYPE.md / STARFIELD.md / theme; reflective cover built then dropped

**Prompt:**

> Overall they are good! But I want to refine some things […] The theme of the
> design will be in CLAUDE.md line 200. And I get some precise controls, I
> introduced 3 new files: REFLECTIVE-COVER.md, STARFIELD.md and TYPE.md which
> matches problem of reflective spherical cover, background stars, and the title
> BLINKSPOTS. I find the current design is warm, orange or red theme, but the
> stripes should be clear, white, cool style, at least conceptually should be!

Then, three times mid-turn: *"Pls ignore the lens part!"* → *"Please ignore the
THE UNIVERSE ARE ... OUR INSTRUMENTS. I deleted in the REFLECTIVE-COVER.md."* →
*"No, ingnore the panels as well"*

**Result:** [`a4edc4f`](../../commit/a4edc4f), [`bce04a9`](../../commit/bce04a9)

- **Theme** — the warmth was the *lighting*, not the fan. A cream sun over a
  purple ambient at exposure 1.1 pushed the whole hero orange. Sun is now cool
  white, ambient a blue-purple fill, exposure 0.92. The fan's palette is
  untouched: STRIPE.md fixes it and CLAUDE.md line 200 licenses it as the
  "ambient colour breaker" that does not break the theme.
- **TYPE.md** — Space Grotesk added as body default; one font request carries all
  three faces; title stack Avant Garde → Century Gothic → Poppins 700 in that
  order; title re-anchored to a zero-size flex box on the globe's projected
  centre (§1.1), which frees `transform` for the float animation; CTA to mono
  15px/.18em; type colours to §5, including dropping purple from the h2 since §5
  forbids giving type a fan colour.
- **STARFIELD.md §A** — hero field rebuilt verbatim: 2,600 points, three-tier
  size split, `aTw` twinkle depth, §A.3/§A.4 shaders, `uTime` in seconds.
- **STARFIELD.md §B** — new static observatory field: 190 circles seeded once by
  `starfield.ts`, written into the markup, clipped to the two black triangles.
  Four tests: count, clip paths, determinism, and that no star sits on a stripe.

**What happened:** three separate things.

1. **A z-index bug the render caught and the diff could not.** The cover and the
   canvas were both at `z-index: 1`, so DOM order decided, and the arc rendered
   *in front of* the globe — the exact opposite of §4. Equal z-index is not a
   tie, it is a silent handover to source order. The hero stack is now written
   out explicitly in one comment.
2. **A spec that contradicted itself, and I said so instead of splitting it.**
   §2's `R = px * 1.18` cannot satisfy §4. With squash 0.5 the apex lands
   0.59px above centre, inside a disc whose limb is at 1.00px, so ~130 of the
   150° hid behind the planet: no panel visible, 8 of 41 glyphs legible.
   "Panels disappear at the silhouette" presupposes they were visible. I shipped
   R = 1.85px with the arithmetic in a comment naming it a deviation. Same call
   as the STRIPE.md §A.2 indexing slip — when several parts of a spec disagree,
   follow the majority and *write down* which line you overrode.
3. **Built three things that were then cut, in reverse order.** Lens, then arced
   text, then panels. Nothing of REFLECTIVE-COVER.md survives. Worth being
   honest that this was avoidable: the doc's §2 numbers already implied an
   invisible component, and I found that out by *rendering* it rather than by
   doing the arithmetic first. The arithmetic took one line of Python. **When a
   spec is dimensional, check the numbers against the geometry before writing
   the component** — a contradiction found in Python is cheap and a contradiction
   found in a screenshot is not.

Also self-inflicted: I removed the cover's CSS with regexes matched against
selector text, and the slices included the preceding comments — one of which
mentioned "hotspot" and another "lens", so `#hero-canvas` and `.cover` were
deleted too, and a later pattern spliced a rule into the middle of a comment.
The tests stayed green throughout, because they assert markup and generator
output, not layout. Green checks did not mean the page was intact; the
screenshot did.

## 2026-08-10 01:56 — Parallel top bands, no top bar, lower CTA, concentrated light point

**Prompt:**

> Ty. But I find some thing, oh I know, it is my monitor! It shows in warm theme!
> Then theme has no problem. Some minor fixes, first remove the top bar:
> BLINDSPOTS and OBSERVATORY, which collide with the existing components. For
> center big stripe, the top area, the blue, yellow, blood red, and the orange,
> except the outer deep red and inner white, they to me is expanding outwards. I
> think you use math as tools, then make them parallel near to top areas. And
> remove the button [ ENTER OBSERVATORY ] lower, 1/28 of the height, refer to
> bottom margin. And for shadow effect, make the speed quicker, + 5% as first
> trial. […] for edges, emit strong light at a point this point can be computed
> with shadow. The shadow has a mid point, and get its normal vector, the vector
> cross with the sheen sihouette becomes brighter. The details I updated in
> REFLECTIVE-COVER.md line 60.

**Result:** [`a59193b`](../../commit/a59193b)

- **Top bar** — could not simply be deleted: `spec/invariants.test.ts` requires a
  navigation landmark on every page, and removing it would also take the only
  keyboard route past the hero. It is a skip link now — off-screen for pointer
  users, sliding in on focus. Landmark and keyboard path both survive.
- **Parallel top bands** — the diagnosis was one line of calculus. `p1` is the
  first Bézier control value, so `B'(0) = 3·p1` *is* the tangent at the top edge.
  STRIPE.md §A.2's `p1 = −0.11 + 0.022k` makes that non-zero, so adjacent
  boundaries diverge **linearly** in `u` and the bundle visibly fans out. Setting
  `p1 = 0` is what §A.2's own prose already asks for ("near the top every trail
  is almost vertical, dx/dy ≈ 0") — the gap between neighbours then changes only
  quadratically. The flare is untouched; `p2` still owns it.
- **Light point** — their construction reduces to closed form. The terminator
  meets the silhouette where N ⊥ L and N ⊥ V, i.e. `N = ±(L×V)/|L×V|`, two
  points; the chord's midpoint is the globe centre, and the normal to that chord
  inside the silhouette plane is `V×(L×V) = L − V(V·L)` — the light direction
  projected onto the screen plane. No iteration, no marching the limb. Worth
  noting: doing the algebra *first* meant the shader was right on the first try.

**What happened:** the theme wasn't warm — it was the user's monitor. I had spent
part of the previous pass cooling the render (exposure 1.1 → 0.92, cooler sun) to
chase a problem that was never in the artefact. Reverted. **A colour judgement
read off one uncalibrated display is not evidence about the page**, and I should
have asked what they were viewing on before retuning the lighting.

Two bugs the screenshots caught that the diff and the tests could not:

1. **The outside bloom as a second three.js shell composited as an opaque dark
   crescent** that swallowed the stars, instead of a glow. Cause: additive
   blending raises the *alpha* of the canvas wherever it draws, and this canvas
   is transparent precisely so the fan shows through it. I reasoned about the
   blend equation twice and got it wrong twice, then bisected by zeroing the
   shell's alpha — which settled it in one screenshot. Lesson: **bisect the
   render, don't re-derive the blend maths.** The fix was to move the bloom to a
   DOM layer at the projected hotspot, which composites correctly over every
   layer.
2. **`Box3.getBoundingSphere()` returns the sphere CIRCUMSCRIBING the box** — a
   factor of √3 too large for a cube. I used it to measure the globe's real
   silhouette radius and it inflated the title by ~73%. The right measure is the
   mean half-extent in the screen plane. Both `--mars-px` and the flare position
   had been using the nominal `MARS_RADIUS`, which is the *longest* axis of the
   scaled GLB, so the flare sat a hair outside the limb and showed as a doubled
   core — a real bug, just not the one my first fix introduced.

## 2026-08-10 02:20 — Pure-dark shadow, full orbit, 5px flare outset, constant band width

**Prompt:**

> Overall good fix! And I have some layout improvements. First simple one, make
> the shadow part pure dark, yes, pure dark, from aesthetic view. Second,
> increase the shadow boundary push forward speed +10%, and restore the original
> logic of the Mars should be pure dark. Third for the hot-spot, logic is
> correct, but I need to verify when the Mars can be pure dark, plus the light is
> not on the sihouette, we push 5px outwards. […] And the stripes, I find the top
> region, yes it is parallel, but I feel they becomes thicker, which shouldn't.
> Pls find the STRIPE.md line 89 to 97. Make them parallel, and thickness remains
> the same.

**Result:** [`57a17e4`](../../commit/57a17e4)

- **Constant top thickness** — derived rather than tuned. With
  `x_k(u) = top_k + D_k·B(u)` and uniform top spacing, `gap(u) = GAP + ΔD_k·B(u)`,
  so `gap'(0) = ΔD_k·B'(0)` and `gap''(0) = ΔD_k·B''(0)`. Parallel needs the
  first to vanish, constant thickness needs the second, and for a cubic Bézier
  `B'(0) = 3p1`, `B''(0) = 6p2 − 12p1` — so both together force `p1 = p2 = 0`
  and `B(u) = u³` exactly. Four new tests encode §A.2.1's two checks.
- **Pure dark** — ambient light removed entirely, and the limb shell's constant
  `0.05` base term dropped (it had been painting the night-side limb grey).
- **Full orbit** at 6.93e-5, period ~91 s, so Mars runs lit → crescent → pure
  dark. Trade-off stated in the commit: for part of every cycle the planet is a
  black disc.
- **Flare outset 5 px** radially outward, and the shell's core gain 7.0 → 4.0,
  since the white-hot point is the DOM layer's job now.

**What happened:** nothing was flagged as wrong, but two process notes worth
keeping.

1. **The spec's warning and the user's request looked contradictory, and weren't.**
   §A.2.1 is titled "The boundaries are not parallel — and must not be", and
   forbids a shared easing because it "reads as a striped curtain instead of a
   wake". The request was for exactly that shared easing. Rather than pick a
   side, I checked what the curtain failure actually *requires*: bands widening
   at the same rate. They can't here, because ΔD_k comes from the power-law
   bottom spread. So the shared easing is safe, and §A.2.1's own numeric checks
   confirm it — its 1:9.5 and 1:12.5 ratios turn out to be nothing but
   GAP : bottom-spread, which the generated fan hits at 1:9.55 and 1:12.46.
   **A prohibition is worth testing against its own stated reason before
   treating it as binding** — the reason was narrower than the rule.
2. **Verified the pure-dark phase by computing when it occurs, not by waiting for
   it.** The sun angle is `t · 6.93e-5`, so the planet is fully back-lit at
   `angle = π`, i.e. `t = π/6.93e-5 ≈ 45.3 s` after load. Reload, wait 45 s,
   screenshot. Sampling the ~91 s cycle at intervals had already missed that
   phase four times in a row. Cheaper to solve for the moment than to poll for it.

## 2026-08-10 02:48 — Title to the limb rule and vertically stretched; CTA per CTA.md

**Prompt:**

> Good, and for this hot-spot style, I need to test further. And here some fixes.
> […] First is for BLINDSPOTS, make then bigger. The sheen of left and right
> bounds should across vertically to the mid point of B and S, the first and last
> letter of BLINDSPOTS. And enlonger the font vertically. You can refer the style
> of video game Control, the white, suppressive big title. […] Make it
> overwhelming! Keep the central of the Mars. […] And for lower button [ ENTER
> OBSERVATORY ]. Change to rounded rectangle. And make the background shifting
> slowly from dark but pure dark, to the setting you are applying. […] even
> darkest, can see through the background. I added a file CTA.md

**Result:** [`383b9bb`](../../commit/383b9bb)

- **Title** — the sizing rule is now geometric rather than a fudge factor.
  Because the title is centred on the globe centre, at the title's own vertical
  centre the limb sits at exactly ±`marsPx`, so "the limb passes through the
  middle of B and S" means *the two outer glyph centres are one diameter apart*.
  `TITLE_OVERHANG` deleted. Measured with a `Range` over the individual
  characters, since where a glyph's centre falls depends on that glyph's own
  advance — B and S cannot be inferred from an average. Verified numerically at
  390×844: Mars spans 21→369 and the two centres land on 21 and 369.
- **Vertical stretch** 1.42× via `scaleY`, not a condensed face: Poppins has no
  condensed cut, and `scaleY` leaves the horizontal measurement the limb rule
  just solved for exactly intact.
- **CTA** — 3px radius, border removed, pointer-events bar so the hit area is the
  words only, 15px/.18em, one-property hover, real `:focus-visible`. Two
  deviations flagged in the commit: kept a real `<a href>` over the doc's
  `div`+`span`+`onClick` (§6 itself treats that snippet as prototype markup), and
  kept `bottom: 1/28` over §2's `3vh`, since 1/28 was specified directly and
  satisfies §2's stated reason anyway.

**What happened:** nothing was flagged, but two notes.

1. **I nearly reported a clipped title that wasn't clipped.** The phone
   screenshot looked cut off at both edges, and my first instinct was to treat it
   as a bug. Querying the real rect said `left: 2, right: 388` in a 390 viewport
   — not clipped, just flush. What the measurement *did* reveal was a genuine
   smaller bug behind it: my viewport cap was computed from a predicted ink width
   via `scrollWidth`, which disagrees with the client rect for an element inside a
   zero-width flex anchor, so a 0.98 ceiling was really landing at ~0.995. Fixed
   by setting the size, then correcting against the box that actually rendered.
   **Read the numbers off the DOM before believing what a screenshot looks like**
   — the screenshot found the smell, the rect found the bug, and they were not the
   same bug.
2. **Verified the translucency claim instead of asserting it.** "Even at its
   darkest you can see through it" is checkable: sample the gold fan band beside
   the plate (173,134,49) and through it (40,39,40) light end, (22,21,20) dark
   end — about 20% and 7% of the stripe carrying through. Two `background-color`
   keyframes are easy to write and easy to get wrong by one alpha digit; pixel
   sampling is the difference between "should be translucent" and "is".

Also worth recording: `transform` is a single property, so adding `scaleY` to a
title that already animates `translateY` means restating the scale in **every**
keyframe. A keyframe that sets only `translateY` silently drops the stretch for
that part of the cycle.

## 2026-08-10 02:05 — Widening the title, slowing the terminator

**Prompt:**

> Good, and another minor fix, the BLINDSPOTS, it is tall enough, then we make
> it wider. Just in ratio, make it longer about 1/6 of its original length. And
> please make the shadow area movement speed lower 3%!

**Result:**
Did the arithmetic before touching the code, because "wider but not taller" is a
constraint on two numbers, not one. The fit solves the font size from a target
span; the float keyframes apply a `scaleX`. With `scaleX = S` and the target
`span = 2*marsPx*G`, the two cancel exactly when `S = G` — the font size comes
out unchanged and only the word lengthens. So `TITLE_LENGTH_GAIN = 7/6` in
`hero.ts` and `--title-stretch-x: 1.1667` in `styles.css` are the same number
twice, deliberately. Desktop measures `fontSize 127.371px, width 1031` against
~884 before: 1.166. `SUN_RATE` 0.0000693 → 0.00006722, period ~93.5s.

**What happened:** nothing was flagged, but the change quietly breaks a rule the
user set one turn earlier — Mars's limb passing vertically through the midpoints
of the first B and last S. Those centres now sit at ±(7/6)·marsPx, so the limb
crosses 1/6 of a radius *inside* them. The two rules cannot both hold: the limb
rule fixes the span at exactly `2*marsPx`, and 1/6 longer is by definition not
that. Recorded the escape hatch in a comment and the commit message
(`TITLE_LENGTH_GAIN = 1` restores it) rather than picking one silently. **When a
new instruction contradicts an older one, implement the new one and say which
older one it costs** — the user is the only person who can decide which they
want, and they can't decide it if the conflict isn't visible.

Second, smaller: at 390×844 the title was already 386 of 390px, so the 0.99
viewport ceiling absorbs most of the gain there. Glyphs get wider, font size gets
smaller, net length barely moves. The phone is width-bound, not Mars-bound, and
any further "make it longer" request will do nothing there.

Third: four `Mars model failed to load` errors in the console were stale HMR
frames naming `buildAtmosphere` and `layoutCover` — both deleted with the
reflective cover. `agent-browser console` returns a cumulative buffer, not the
last load. Confirmed by grepping the source (neither symbol exists) and by the
screenshots showing the textured GLB, not the fallback sphere. **A red line in
that buffer is not necessarily a red line now.**

Commit: [`512175b`](../../commit/512175b3d42d14fe96be75064f5cf713f86b62f1)

## 2026-08-10 03:15 — The hot spot, rebuilt from HOTSPOT.md

**Prompt:**

> Perfect, then I have a file for guidance on this Hot-spot, I removed
> implementation from REFLECTIVE-COVER.md, and now in the new file, and it is
> experimental, but you can do boldly. Pls find the HOTSPOT.md for details, if we
> can improve. And if you choose to disable the current plan, please comment out
> instead of delete the code snippet.

**Result:**
New `hotspot.ts`: a 2D overlay canvas above the WebGL canvas and below the title,
drawing HOTSPOT.md layers 2, 3, 8, 9, 10 — halo, ghosts, anamorphic streak,
spikes, core — at the light point `hero.ts` already projects. §5's split does the
real work: the globe, fresnel shell and starfield stay in WebGL, so layers 4–7
(disc stamp, forward scatter, terminator wash, rim bands) have nothing left to
do. The real globe occludes; the shader already draws the rim on the true
silhouette.

Sized every ported constant from `U = px / 1.15` — §1's `R = W*1.15` solved for
`W` — so the doc's numbers go in verbatim instead of being re-derived into a
"cleaner" set. §4's cold preset throughout. The superseded CSS flare is commented
out in three files rather than deleted, as asked.

**What happened:** nothing was flagged, but four notes.

1. **I screenshotted the wrong project.** `agent-browser open localhost:5173`
   returned a completely different site — a fungi page from another repo whose
   dev server had the port. My own was on 5175. The screenshot was perfectly
   legible and perfectly irrelevant, and nothing about it announced that. **The
   rendered page is only ground truth if it is the right page** — check the
   `<title>` when a port is shared, and prefer the port the server actually
   printed over the one you assume.
2. **`mix-blend-mode: screen` is load-bearing, not styling.** The reference
   paints its `lighter` layers onto an opaque frame. On a transparent overlay
   composited source-over, an alpha-0.3 white glow *washes* the fan toward white
   instead of adding to it — same pixels over black, visibly wrong over the
   stripes. This is the second time in this project that a compositing assumption
   about a transparent surface has been the whole bug (the first was the additive
   three.js shell that came out an opaque dark crescent).
3. **CSS block comments do not nest.** Commenting out the flare rules swallowed
   the outer comment at the first inner `/* … */`, and the rest of the file
   became live CSS again. Stripped the two inner delimiters and left a note in
   place saying why. `pnpm check` would not have caught this: stylelint parsed
   the result happily.
4. **Two numbers were not in the doc.** HOTSPOT.md gives the streak's thicknesses
   and gradient stops but never its length, and the same for the spikes. Chose
   `U*1.1` per streak unit and `U*0.52`, and said so in the source and the commit
   rather than letting invented constants sit among ported ones. The distinction
   matters precisely because everything around them *is* ported.

Verified at the pure-dark phase — the one the user said still needed testing.
That phase turns out to be the effect's best case: a star cresting a black limb,
with the composite carrying the entire frame.

Commit: [`a61a470`](../../commit/a61a470)

## 2026-08-10 03:20 — Tangent streak, wider trajectory

**Prompt:**

> Good, the effect itself it good! But haha, the rotation is fixed! We say it has
> two axes, the top-bottom short axis, and left-right long axis. So I plan to let
> long axis tangent to limb. So the computation should be, compute the angle of
> long axis vector, to the norm vector of what we mentioned shadow plane, and
> make the inner product = 0. It is easiest. And move the trajectory outer,
> faraway to center of Mars for about 5px, let's see the effect first.

**Result:**
The streak was drawn at a fixed angle 0 — a straight port of the reference, where
the star is pinned to the right limb and horizontal is always tangent there. As
soon as the light point orbits, that constant is wrong everywhere except its
original position.

The fix needed no new geometry. In screen space the outward normal at the light
point *is* the radial direction `(dx, dy)` — the same vector `placeFlare` already
computes for the outset — so `longAxis · normal = 0` is satisfied by
`atan2(dy, dx) + π/2`. Exactly zero analytically, no projection, no trig on the
3D vectors. Spikes rotate with the streak: a rotating streak over a fixed
starburst reads as two artifacts rather than one lens. `FLARE_OUTSET` 5 → 10.

**What happened:** nothing was flagged, but one thing worth keeping.

**A ported constant can encode an assumption that does not travel with it.**
Angle 0 was correct in HOTSPOT.md because §1 fixes the star at the rightmost
point of the disc — horizontal *is* the tangent there, so the doc never needed to
name the rule. Porting the number faithfully carried the value and dropped the
reason. Every other constant in the file survived the move because it is scale-
relative; this one was position-relative, and position is the one thing this
implementation deliberately changed. Worth checking the rest of a ported set for
the same shape: which constants are only right because of something the source
held still?

Verified at two sun phases ~35s apart rather than one — a fixed angle and a
tracking angle look identical in any single frame taken near the original
position, which is exactly how this survived the first review.

Commit: [`9c44903`](../../commit/9c44903)

## 2026-08-10 03:30 — The CTA wings

**Prompt:**

> Ty, I have plan for this hotspot, I am scheming, and we add stripes for CTA
> button, the Wings, the specification is in CTA.md line 72 to 95. Easy design,
> better aesthetic view!

**Result:**
Three flat bars either side of the plate, mirrored, in the trail-head warm-to-cold
order, inner ends flush against a 10px gutter so the taper opens outward. §3.1's
derivation ports intact and is the best part of the spec: `align-self: stretch`
makes each wing exactly as tall as the plate, so the red bar's top edge lands on
the button's top edge, a fixed 6px sets the red→yellow gap, and `margin-top: auto`
leaves the yellow→cyan gap as the remainder — which is *why* it stays the larger
of the two rather than being tuned to. Measured at 1920, every derived number
holds: wing height 37 = plate height, gaps 6 then 10, cyan 2px inside the lower
edge, gutters 10 both sides.

**What happened:** nothing was flagged, but three things.

1. **The spec's fixed px broke the phone, and it broke the wrong element.** At
   390px the red bars ran to −17 and 407 — expected, since 132+10+286+10+132 =
   570. What I did *not* expect was that flex took the shortfall out of the
   **plate**, squeezing it from 286 to 140 and overflowing its own text. The
   decoration was fine and the affordance was destroyed. Fixed by making the
   132px a flex *basis* and the bar lengths percentages of the wing, so the
   1 : 0.75 : 0.30 ratio survives at every width and the wings are what give way.
   No breakpoint needed. **When adding a fixed-size decoration to a flex row, ask
   which element pays for it** — the answer is whichever one can shrink, and that
   is rarely the one you want.
2. **A 0.4px inconsistency inside §3.1.** Its table labels the cyan bar 40px, but
   the ratio it states in the same paragraph, 0.30 of 132, is 39.6. Using
   percentages picks the ratio over the table, on the grounds that the ratio is
   the stated rule and the table is a rounded label. Noted in the CSS.
3. **I broke the build with a comment, again.** Splitting one CSS comment into
   two left the second without its opening delimiter, and the whole rest of the
   file became a syntax error. That is twice this session that a CSS comment edit
   has broken something — unlike the earlier one, this failed the build loudly
   instead of silently disabling rules. Both times the cause was editing comment
   *delimiters* with a text replacement rather than the rules around them.

Commit: [`806696d`](../../commit/806696d)

## 2026-08-10 03:50 — Phase-driven hot spot

**Prompt:**

> Perfect, and the modification to the Hotspot! Here is the thought, first
> instruction, move the point outer for 6px more. And the idea is we have this
> hotspot light consistently feels too fake. Then the modification is we add
> diminish and bright based on shadow area. If shadow area is big, then the
> brightness is stronger, and long axis is longer. If shadow area is smaller, the
> Mars get adequately lighted, then hotspot will diminish, maybe vanish, and the
> long axis will fade to short. The overall halo will reduce accordingly. The
> implementation is in the HOTSPOT.md. Try to implement it first!

**Result:**
Implemented §3.7. `p` is the lit fraction of the visible disc, which for a sphere
is `(1 + cos α)/2` with α the phase angle — and both unit vectors were already in
hand for the light point, so the dot product is the entire computation. All five
derivations ported verbatim; sampled at 11 points and both endpoints land on
§3.7's table exactly. `RM` goes to the WebGL shell rather than the overlay, since
that is where the rim lives after §5's split. `FLARE_OUTSET` 10 → 16.

**What happened:** one contradiction, one omission, one self-inflicted break.

1. **The prompt and §3.7 ask for opposite brightness.** The prompt says big
   shadow → *stronger*; §3.7 says at p→0 the alpha is "~0.05 — nearly
   extinguished", and argues the point explicitly ("it is not a brightness
   slider; it is a physical state"). They agree on the streak — long at big
   shadow — and are exactly inverted on brightness. Implemented the doc, because
   the prompt ended "The implementation is in the HOTSPOT.md", and reported the
   conflict with both quotes and the single line that flips it. **When two
   instructions from the same person conflict, the job is to name the conflict,
   not to average them or to pick the one I like** — and the deciding signal here
   was which one the prompt itself pointed at.
2. **Did not implement §3.7's terminator clip and forward scatter.** §5 already
   dropped forward scatter because the real globe occludes, and a wash over the
   day side would flatten the GLB's own texture — and fight the pure-dark shadow
   asked for two turns ago. Said so in the commit rather than letting a
   silently-skipped section look like an oversight.
3. **A backtick in a comment ended the shader.** I wrote "the exponent on `lit`"
   inside a template literal, which closed the string mid-shader and produced six
   syntax errors pointing at `side: THREE.FrontSide` — thirty lines below the
   actual cause. Markdown habits do not survive inside template literals.

Verified across a full orbit rather than one frame, which is now the standing
rule for anything phase-dependent: at low phase a dark disc with a razor rim and
a long streak, at high phase a compact bright core with the streak collapsed.

Commit: [`2a5f7f6`](../../commit/2a5f7f6)

## 2026-08-10 04:05 — The glitch reveal, on real archive data

**Prompt:**

> Yes I am fixing it. And we move on to the GLITCH effect! Actually it is quite
> good to me haha. The implementation is in GLITCH.md, and the effect is when
> user hover cursor on the [ ENTER OBSERVATORY ] then the glitches panels
> emerges, with true data from PSCompPars_2026.08.08_10.48.26.csv!

**Result:**
Four code blocks, every line a read of the real archive. c1 prints the CSV's own
first 20 column names, c2 counts discovery methods across all 6,336 records, c3
is a real `ORDER BY sy_dist`, c4 reads the detection-flag matrix. Keyframes,
delays and the violet/amber fringe ported verbatim; §1's three-value state
verified in the browser as mount `none/none`, hover `in/forwards`, leave
`out/both`.

**What happened:** nothing was flagged, but four things.

1. **The dataset could not answer c4, and the gap was the interesting part.**
   `exoplanets.json` already existed — with no generator beside it, so it was a
   fact nobody could re-derive — and it carries `method`, the discovery method.
   c4 wants the four detection flags. Those are *not* the same thing: a planet
   carries more flags once other techniques confirm it, so deriving flags from
   `method` would have been inventing data while looking like reading it. Wrote
   a generator that reads the CSV and **refuses to write unless all 15 existing
   columns come out identical**, which makes its two additions provably
   additive rather than a silent replacement of someone else's file. A test
   asserts rows exist whose flag count exceeds one — that is the assertion that
   would fail if the flags were ever back-derived.
2. **Checking the output against reality, not just against the schema.** c3
   returned Proxima Cen b at 1.30 pc, Barnard's at 1.83, eps Eri at 3.20. Those
   are the actual nearest systems at the actual distances. A sort can be wired
   backwards and still produce eight plausible rows; knowing what the answer
   should be is the only check that catches it.
3. **The blocks are hidden under 600px, and the second reason is the real one.**
   At 390×844 four ~300px blocks overlap each other and sit on the title (c3
   spanned y 371–484 against the title's 371–473). But the deeper problem is
   that the trigger is hover and touch has none: `pointerenter` fires on tap,
   and that same tap navigates to `#observatory`, so the reveal would flash on
   the way out of the page. Shrinking the type fixes the collision and not the
   interaction. **When a feature does not fit a viewport, check whether it is a
   layout problem or an input-model problem before spending effort on layout.**
4. **Three tests failed because they asserted source CSS against built CSS.** The
   minifier ships `steps(1)` as `step-end`, drops a `0ms` delay outright, and
   rewrites `220ms` as `.22s`. Rewrote them to parse the animation shorthand and
   normalise to milliseconds. Tests over built output have to assert the
   *meaning*, not the spelling — the spelling belongs to the minifier.

Also worth recording: a reduced-motion reset written as `.glitch-block` could
never have overridden `.cta-hover #glitch-c1`. stylelint's
`no-descending-specificity` flagged the ordering and, following it to the rule
it named, turned up the real bug behind it — the reset was inert. That is twice
now that a lint rule has pointed at something worse than the thing it reported.

Commit: [`41d1ced`](../../commit/41d1ced)

## 2026-08-10 04:25 — Azimuth, 0.5 scale, inverted flare

**Prompt:**

> I have checked in your progress, cannot pick an error. This part is solved! And
> we back to the HOTSPOT.md. This time, I modified the .md, it aligns with my
> design now. And first instruction, nudge the hotspot outside 10px again! And I
> added an Azimuth, now it will have a vertical light bar! And for the scale, I
> request you to shrink it, the length is ridiculous. Lets scale the whole
> hotspot to 0.5 for this run

**Result:**
`FLARE_OUTSET` 16 → 26. `SCALE` 0.5 applied to `U`, the unit every size in
`hotspot.ts` derives from, so halo, streak, spikes and core shrink together and
no proportion in §3 changes — a zoom, not a retune. `I` picked up the doc's new
inverted form, which is the previous turn's flagged conflict resolved in the
prompt's favour. Azimuth rotates the shading light about the view axis while the
star, rim, hotspot and phase all keep reading the true direction.

**What happened:** one pleasing result, one thing I could not deliver.

1. **Phase is exactly invariant under azimuth, not approximately.** A rotation
   about an axis preserves every vector's component along that axis, and phase is
   `(1 + axis·dir)/2` — so rolling the light about the *view* axis cannot change
   how wide the shadow is, only where it lies. §3.7 claims that separation as a
   design intent; rotating about that particular axis makes it an identity. Worth
   noticing when a spec's stated separation can be made exact instead of merely
   arranged.
2. **Azimuth cannot pin the boundary vertical, and I only found that by
   capturing a cycle.** The prompt expected "a vertical light bar". The sun runs
   a full orbit, so the terminator already sweeps every orientation each ~93.5s;
   azimuth *offsets* that sweep relative to the star rather than fixing it.
   Captured at 90°: horizontal at high phase, diagonal at low phase. My first
   instinct was to reason it out from the orbit geometry, and that reasoning gave
   me a confident wrong answer twice — once that 90° would make it vertical, then
   that 90° would make it vertical *at the dramatic phase*. The screenshots
   settled it both times. **A time-varying effect cannot be reasoned about from
   one frame's geometry; sample the cycle.**

   Also worth saying plainly: one directional light gives one boundary, so
   azimuth rolls that boundary and cannot produce a separate bar of light.
   Reported both, with the option that would work — constraining the sun's
   orbit — rather than quietly shipping 90° and letting the expectation stand.

Commit: [`cff2d2e`](../../commit/cff2d2e)

## 2026-08-10 04:50 — The scout crossings

**Prompt:**

> Good! And let me think. The next, the scout-ship trail. I add another dynamic
> component, conceptually act as bounds of BLINDSPOTS. The concept is the
> scout-ship, you can find it in the /assets/scout-ship.png. It will enter from
> right margin of the window, through from the above of the Mars, and out from
> left margin. After the complete vanish, including the long trail. After 5
> seconds, it returns from left to right. This time differs by it enters at the
> back of the Mars. The trail and itself will be covered by the Mars! And vanish,
> quit from right margin, and loop the condition. And details include in the
> SCOUT-SHIP.md.

**Result:**
Pure DOM per §1: a zero-size anchor translates, five layers hang off it, and
`scouts.ts` owns only the routes — measured from the title box, since nothing
else in the component needs anything JavaScript knows.

The brief's timing turned out to *be* §2's, exactly. 41.67% of 60s is 25s of
crossing; the return starts at 50% = 30s, so the gap is 5s; the second run ends
at 91.67% = 55s, 5s before the restart. The prompt described the doc without
either of us having to reconcile them. Wrote the test against the two 5-second
gaps rather than the three percentages, because the gap is the thing the brief
specifies and the percentages are how it happens to be spelled.

**What happened:** nothing was flagged, but three things.

1. **The routes were non-deterministic and only arithmetic showed it.** The title
   floats ±6px on a 9s loop, and `getBoundingClientRect` includes that transform
   — so the measured route depended on which frame the measurement landed on. The
   render looked fine. What did not look fine was the arithmetic: the route came
   out at 375.6 where `titleTop` 408 and a gap of 408/18 predict 385.3. Subtract
   just the translation and keep the scale (the scale is the word's real size,
   the float is the noise) and predicted matches actual to 0.1px at both
   viewports. **Recomputing a measured value by hand is a cheap check that
   catches things no screenshot will** — a 10px error in a 273px title is
   invisible and still wrong.
2. **The doc is wrong about the upper route and still gives the right
   instruction.** §4 says "the upper route needs no mask; it clears the globe."
   Ours does not clear it — Mars fills most of the frame and the routes bracket a
   title centred on it, so the upper pass necessarily crosses the disc. But it
   crosses *in front*, which is exactly the contrast the brief wants against the
   lower pass going behind. So the stated reason is false and the instruction it
   justifies is still correct. Recorded both rather than silently obeying.
3. **Seeking a CSS animation by `animation-delay` does not work the way it
   reads.** Setting `-12s` shifts relative to the animation's original start, so
   it compounds with however long the page has been open — my "seek to 12s" was
   really "seek to 52s", which parked the ship off-screen, and the first
   screenshot showed an empty frame that I nearly read as a broken component.
   `getAnimations()[0].currentTime = 12000` plus `pause()` is exact: the
   transform then read 390.27px against a hand-computed 390.

Commit: [`3a11398`](../../commit/3a11398)

## 2026-08-10 05:00 — Correcting SCOUT-SHIP.md §4

**Prompt:**

> Ty, and pls change the SCOUT-SHIP.md about the section you pointed out

**Result:**
Rewrote §4's closing claim. It read "The upper route needs no mask; it clears the
globe" — true instruction, false reason. Now it says the upper pass *does* cross
the disc at this scale and crosses in front, that the over-the-world versus
behind-it contrast is what makes the second crossing a different event, and that
masking it would throw that away. Phrased so it holds either way if the globe's
size ever changes.

**What happened:** worth recording why this one mattered enough to fix. A right
instruction resting on a wrong reason is more dangerous than a wrong instruction,
because it survives review — the behaviour looks correct, so nobody checks the
justification, and the first person to notice the upper trail crossing Mars would
have "fixed" it by adding a mask and quietly destroyed the contrast between the
two passes. The spec docs are harness, so a stale reason in one is a trap laid
for the next change, not just an inaccuracy.

Commit: [`6a33ac8`](../../commit/6a33ac8)
