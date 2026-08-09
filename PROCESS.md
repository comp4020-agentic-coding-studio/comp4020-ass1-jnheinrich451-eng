# Process overview

## What I built

BLINDSPOTS is a one-page scrolling site. The Hero section opens on a rotating
three.js Mars model in a twinkling starfield, with the BLINDSPOTS title sized
and centred to Mars's actual on-screen diameter at any viewport, and an
`[ ENTER OBSERVATORY ]` control that scrolls to the Observatory section below
it (still a placeholder — its real content is scoped for a later commit).

## The moments that mattered

Three or four for an assignment; fewer is fine for a weekly prototype. Keep the
list short so each moment has room to do all four jobs:

1. **what happened** --- the problem, or the thing the agent got wrong
2. **what you did instead of the obvious thing** --- the call you made, and why
   it beat the obvious one
3. **how you knew it was right** --- the check you ran, the viewport you looked
   at, what you read before accepting the diff
4. **the citation** --- a commit or commit range, a `CLAUDE.md` change, a check
   that went from red to green, a prompt paired with the commit it produced

Jobs 2 and 3 are the ones the repo can't tell a reader on its own, so they're
where the marks are. The strongest moments are the ones where a correction
landed in the **harness** rather than in another prompt --- a rule added to
`CLAUDE.md`, a check wired up, an attempt thrown away: re-prompting until it
passes is the routine case, and changing what the agent works against is the
skilled one.

Cite each moment as a link whose text is the commit hash or range and whose
target is this repo's commit or compare URL, so a reader clicks straight to the
evidence:

- one commit: [`a1b2c3d`](https://github.com/YOUR-ORG/YOUR-REPO/commit/a1b2c3d)
- a range:
  [`a1b2c3d...e4f5a6b`](https://github.com/YOUR-ORG/YOUR-REPO/compare/a1b2c3d...e4f5a6b)

To pair a prompt with the commit it produced, quote the prompt (curated, not a
full transcript) next to the citation:

> the prompt, verbatim

Screenshots are welcome where one carries the verification better than a
sentence does. Commit the file to this repo and link it with a **relative**
path, which is what makes it render on GitHub: `![alt text](docs/before.png)`.
Images don't count towards the word count and don't replace the citation.

1. **The title's size was derived from Mars's on-screen radius, not a fixed
   value** — `font-size: clamp(24px, calc(var(--mars-px) * 0.72), 220px)`, with
   `--mars-px` set by projecting Mars's world-space edge through the camera on
   load and on resize. That's correct at 1920×1080, where Mars is wide and
   short. On a 390×844 phone, the same aspect-driven camera distance puts Mars
   itself well within the screen, but the resulting `--mars-px` was still large
   enough to push `BLINDSPOTS`'s ten letters past both edges of a 390px-wide
   viewport. I only found this by actually loading the page at that viewport
   with `agent-browser` and screenshotting it — the desktop render looked
   correct and gave no reason to suspect it. I capped the formula with
   `min(calc(var(--mars-px) * 0.72), 11vw)` so the viewport width, not just
   Mars's projected size, bounds the title on narrow screens, and re-screenshot
   both viewports to confirm the fix didn't change the desktop layout.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that the
current reflection entry is in `reflections/`, and that your `CLAUDE.md` is
there --- before a marker ever opens the file. It checks that your map is
traceable, not that it is good: the marker judges whether your small,
deliberately chosen set of moments shows real judgement and reflection. A green
check is not a substitute for that curation.

Images are deliberately not checked, because whether one renders is visible the
moment you look. Open this file on GitHub and look at it before you ship.
