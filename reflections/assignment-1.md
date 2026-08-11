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
fraction of the measured radius, exact by construction, and I made it prove that
rather than take it on trust: the flare's centroid measured 174.3 px against a
174.0 px radius. Later the same rule caught a phone header capped against a
*guessed* button width — still an offset wearing another name.

A prompt fixes one bug; a rule changes what gets reached for on the next one.

## What did this work change about who I want to be as a software developer?

<!-- Your half. 60–120 words is plenty on top of the above. -->
