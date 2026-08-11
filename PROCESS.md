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
   change, and I committed that result rather than claiming a win
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

3. **Six attempts at one camera, because I had modelled the wrong thing.** A
   CAMERA ROTATION control "did nothing". The obvious answer is a bigger number,
   so I measured instead: 2.9°/s, one revolution every 126 seconds — on, but
   invisible. Raising it to 8°/s changed nothing in the report. So I stopped
   reading variables and measured the *picture*: the star projected off-frame in
   every sample, and the camera already swung ±260 units with the toggle
   **off**, because it tracked the planet. Retargeting to the barycentre made
   rotation visible but fixed only the system view. The root was my model, and
   it took my author's correction to see it: I was rotating the *camera* when
   what turns is the *frame*. Star and planet hold fixed relative to each other,
   so the frame co-rotates with the planet and the orbit, tail and starfield
   carry the revolution. The star's projected x then held 2.157 → 2.143 over ten
   seconds — a 1 % breath which *is* the eccentricity — where it had swept
   across the frame
   ([`efe5ba8...ce875e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/compare/efe5ba8...ce875e7)).

4. **I fixed one transition four times; the fix was deleting the code.** Each
   round I narrowed when a clamp should run — eagerly, then moving with the
   rect, then only while morphing, then only when the rect changes — and never
   asked whether it should exist. The arithmetic settles it in one line:
   `sx(cx) = pad + iw/2` for any fit, so changing the fit rect rescales the
   picture about the view's centre and cannot move it. Deleted, and verified
   where the old code failed: `cx` holds 0.631 across every frame of the change
   at zoom 0.4, where it previously snapped to centre first
   ([`7b32ba9...c755961`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/compare/7b32ba9...c755961)).
