# Process overview

## What I built

BLINDSPOTS is a two-page static site over the NASA Exoplanet Archive's 6,336
confirmed worlds. The hero is symbolic: a three.js Mars, a scout-trail fan
generated from `STRIPE.md`'s formula rather than drawn, and a title sized from
Mars's own projected diameter. The archive page is the instrument — all 6,336
records in one canvas, four projections that morph between each other, a method
filter, search, a target readout, HUD tapes that read the exact expression that
placed the points, and a system view you dive into and return from with the
field untouched. Vite, TypeScript and three.js; 90 tests run from `pnpm check`.

## The moments that mattered

1. **The field ran at 3 FPS and I optimised the wrong thing five times.**
   Dragging moved "frame by frame instead of an animation", so I did the obvious
   work first: bucketed the draw loop, culled off-screen points, swapped `arc`
   for `fillRect`, stopped reallocating the canvas. Every one measured as no
   change, and I committed that honestly rather than claiming the win
   ([`f1a5aec`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/commit/f1a5aec)).
   Instead of optimising a sixth thing I counted what the loop was *doing*:
   5,067 rAF callbacks against 20 real frames. `paint()` re-entered its own
   driver, so every frame scheduled two. Frames went 115 ms → 7 ms
   ([`f1a5aec...7f0865a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/compare/f1a5aec...7f0865a)).

2. **Three bugs at 390×844 that were one bug.** A hot spot thrown off Mars's
   limb, a scout trail cut early, glitch blocks colliding with the title. The
   obvious fix is three better numbers. `CLAUDE.md` forbids fixing misalignment
   with an absolute offset, so I treated them as one class instead: each was a
   constant standing in for a relation, and the fix is the relation. I knew it
   was right by measurement, not by eye — the flare's centroid on the phone read
   174.3 px against a 174.0 px radius, a 0.29 px error, and the trail's mask
   stops resolved to the limb exactly
   ([`dc18440`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/commit/dc18440)).

3. **One root cause behind three symptoms, then a test so it cannot come back.**
   Reference rules sat beside their own ticks and a 2026 record's cursor landed
   on 2024. Rather than nudging the lines, I looked for what they shared:
   `logNorm` already emits `0.06 + 0.88t`, and I had applied that padding a
   second time by reading the spec's mapping line literally. The wrong version
   renders as *plausible*, so a careful reader is the wrong guard — I added
   three tests that fail on a double pad, then cropped the tape at 2× to watch
   the cursor land exactly on 2007
   ([`4e808db`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/commit/4e808db)).

4. **I fixed one transition four times; the fix was deleting the code.** Each
   round I narrowed when a clamp should run — eagerly, then moving with the
   rect, then only while morphing, then only when the rect changes — and never
   asked whether it should exist. The arithmetic settles it in one line:
   `sx(cx) = pad + iw/2` for any fit, so changing the fit rect rescales the
   picture about the view's centre and cannot move that centre. Nothing needed
   correcting. Deleted, and verified where the old code failed: `cx` holds 0.631
   across every frame of the change at zoom 0.4, where it previously snapped to
   centre first
   ([`7b32ba9...c755961`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/compare/7b32ba9...c755961)).
