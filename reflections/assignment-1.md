# Assignment 1 — BLINDSPOTS

## What was the breakthrough that moved the work forward?

Three bugs at 390×844: a hot spot thrown off Mars's limb, a scout trail cut
early, glitch blocks over the title. My instinct was to re-prompt until each
looked right, and the agent's was the same — nudge a constant until the
screenshot passed. That is how all three were written: numbers tuned at
1920×1080, correct there and wrong on a phone.

What changed it was not another prompt. In the same commit as the fix I put a
rule into `CLAUDE.md` — *find the anchors or connectors and adjust based on
relations*; *don't use absolute offset to fix misalignment*
([`dc18440`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-jnheinrich451-eng/commit/dc18440)).

After that the agent stopped offering better numbers. The hot spot became a
fraction of the measured radius, exact by construction, and I made it prove
that: the flare's centroid measured 174.3 px against a 174.0 px radius. Weeks
later the rule caught a phone header capped against a *guessed* button width —
an offset wearing another name.

A prompt fixes one bug; a rule changes what gets reached for on the next one.

## What did this work change about who I want to be as a software developer?

I used to write one brief and expect it to hold. This project ran on 23
documents, and the decision I trust most was writing `SPATIAL.md` when one
section of another spec could not carry the 3-D view — the sphere and its tapes
landed on the next pass. I also stopped naming the cause. Describing only what I
saw, and making the agent probe for it, was twice more accurate than my own
diagnosis. Rules make an agent fast; I want to be the part of the
loop that still knows what the thing is for.
