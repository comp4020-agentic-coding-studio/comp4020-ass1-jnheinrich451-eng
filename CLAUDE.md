# COMP4020 prototype

This is your starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.

# Blindspots / NASA Exoplanet Archive

## 1. What it is

A three-part scrolling instrument for the NASA Exoplanet Archive. Not a
dashboard, not a marketing page — **an observatory console**. Every surface should read as something you *operate*, not something you browse. The through line is the title: the archive is a map of where we happen to have been looking, so the design keeps showing the shape of the search, not just the findings.

Three parts, in scroll order:

1. **Hero** — cinematic. Black, scout trails, one word.
2. **Field** — the working instrument. 6,336 records, four projections.
3. **System** — a single star system, opened from the field.

---

## 2. Colour

### Structural — from the fan (see STRIPE.md)

Outer → central: `#8A1538` `#E86132` `#D11F3A` `#345587` `#D9A83E` `#F1F1EE`.
These are the *only* saturated colours in the layout. They are never used for
data encoding — mixing chrome colour with data colour destroys the read.

### Grounds — at most two per page

`#000000` hero fan · `#04050a` hero section · `#070812` field section ·
`#03040a` plot field.

### Instrument palette — everything UI

```
#e8ecff  primary text          #cfd6f6  secondary text
#9aa3ca  tertiary / labels     #6c7699  disabled, gridlines
rgba(150,170,255,.20–.50)      borders, ticks, rules
#bcd0ff / #ffffff              link, link hover
```

Cool blue-grey only. If a UI element needs emphasis, raise its border opacity or
its text brightness — do not introduce a colour.

### Data encoding — earned, and only in the field

```
#e8c37a  transit          #9fc4ff  radial velocity (WOBBLE)
#c79bff  imaging          #ffffff  microlensing
#6c7699  other methods
```

These five are the whole categorical scale. **Selection is not a colour** — a
selected record keeps its method colour and is marked by rings instead: a white
1.3 px ring at r+6 and a `rgba(255,255,255,.32)` ring at r+13, over a
`rgba(3,4,10,.82)` bed. Hover gets one method-coloured ring at r+5. Adding a
sixth hue for "selected" would break the one thing the field encodes.

### Accents

`#F1F1EE` (fan white) is the active-HUD accent — the tab you're on, the axis
you're reading. `#7a5cc4 / #a184f0` are the search-panel scrollbar only.

---

## 2b. Page 2 — where the detail lives

The field page is specified in seven documents. They are the numbers; this file
is only the posture. Read `LAYOUT.md` first.

**They all live in `instructions/`.** Every reference to a spec by bare name —
here, and in the source comments — means `instructions/<NAME>.md`.

| document | owns |
|---|---|
| `LAYOUT.md` | stack, grid, type scale, palette, **every word on the page** |
| `FIELD.md` | the centre canvas: overlays, navigation, FIELD GROUND toggle |
| `LEFT-OBSERVE.md` | method filter, the shared OBSERVE/FIND tab pair |
| `INTERACTION.md` | the input grammar and **every transition, timed** |
| `LEFT-FIND.md` | search — and how it connects to OBSERVE |
| `RIGHT-TARGET.md` | the TARGET readout and its two actions |
| `AXES.md` | HUD tape formula: domains, envelope, ticks, cross-fade |
| `LOAD_DATA.md` | archive → mapping → render pass, and the morph |
| `OPEN-SYSTEM.md` | the dive, the entry, zoom limits, the return |

Four rules from those documents that outrank anything else on this page:

1. **A tape reads the exact expression that placed the points.** Never a
   re-derived scale. Axis domains are computed over the whole archive and cached,
   so a method filter can never renormalise an axis.
2. **Missing is a value.** `null` is never coerced, never dropped. Unresolved
   records are drawn in a labelled holding cloud outside the 0–1 scientific
   region and counted in the footer.
3. **The amount of axis equals the amount of science.** A display-only
   coordinate (the DISCOVERY TIME y spread, the EARTH DISTANCE angle) gets a
   shape and a disclosure, never ticks.
4. **Panels never mutate the archive.** Switching OBSERVE↔FIND, opening a
   system, or returning from one leaves projection, filter, camera, selection and
   query exactly as they were.

The realised grid is `210px / minmax(0,1fr) / 230px` with an 18 px gap inside
the 26 px ring — the 20/50/20 spine expressed in fixed rails, so the plot column
absorbs every viewport change and the rails never reflow their labels.


## 3. Art style

**Analogue instrument, not sci-fi UI.** References are film-scanner overlays, plate-archive furniture, and 1970s mission graphics — not glass, glow, or neon.

**The theme** The theme colors are black, blue, purple, white. Stripes are the breaker to introduce ambient color layer. However, it does not break the theme.

Do:

- flat colour fields with hard boundaries

Don't:

- gradients as backgrounds (gradients exist only inside a trail streak)
- glow as decoration; glow only marks a live emitter (star, scout, cursor)
- drop shadows, rounded cards, glass blur, emoji, icon sets
- SVG illustration of planets or ships — real imagery or nothing

**Empty black is a material.** The corners the V leaves are meant to stay empty
except for stars. Resist filling them.

## 4. Topology

**`LAYOUT.md` supersedes this section for the field.** The archive page's frame
is specified there in full — fixed 210px / 230px rails with an 18px gap inside a
26px ring, IBM Plex Mono throughout, and the exact copy — and that is what is
built. The diagram below still governs the hero, the seam and the dive; read its
field rows as the original sketch, not as the current measurements.

```
┌─ Hero ───────────────────── 100vh, overflow hidden
│    launch point at top-centre, trails fall outward
│    title floats mid-screen, CTA pinned bottom
└─ seam ─── colour boundaries continue exactly (STRIPE.md §A.4)
┌─ Field ──────────────────── min 100vh, 26px margin ring
│    ┌ header strip (84px) ─────────────────────────┐
│    │ archive id · record count · projection tabs  │
│    ├──────┬──────────────────────────┬────────────┤
│    │ left │        plot field        │   right    │
│    │ rail │   (the only dark ground) │   rail     │
│    │ 20%  │          ~50%            │    20%     │
│    └──────┴──────────────────────────┴────────────┘
│    apex of the V closes in the bottom 190px
└─ dive ─── continuous zoom, 720ms, black veil
┌─ System ─────────────────── full-bleed overlay, escape returns to field
```

The **20 / 50 / 20 column rhythm is the spine of the whole site.** The fan is cut
out of the centre column so points read against plain ground; the side rails sit
*on* the stripes at 30 % and carry all controls and readouts. Nothing floats in
the centre except data.

The V is a load-bearing structure, not decoration: its apex marks the bottom of
the page, its arms frame the field, and the corners it leaves black are where
stars are allowed to be. Never place UI on the apex.

## 5. Type

| Role | Face | Size | Tracking |
|---|---|---|---|
| Hero title | ITC Avant Garde Gothic Bold (fallback Poppins 700) | fluid, ~18vw | .02em |
| Section / panel headings | Space Grotesk 500–700 | 13–19 px | .12–.18em, uppercase |
| Body & labels | Space Grotesk 400 | 11–13 px | .04–.09em |
| All numbers, axes, readouts, IDs | IBM Plex Mono 400–500 | 8–12 px | .10–.22em |

Rules: **every number is mono**, no exceptions — tick values, RA/Dec, periods,
record counts, catalogue IDs. Uppercase + wide tracking marks anything the
instrument says (`DISCOVERED // YEAR`, `[ ENTER OBSERVATORY ]`); sentence case is
only for prose the *author* says. Slashes `//` separate instrument fields.
Brackets `[ ]` wrap actions. Never below 8 px, and 8 px only for axis ticks.

## 6. Motion

| Event | Duration | Curve |
|---|---|---|
| Projection morph | 900 ms | ease-in-out, per-point |
| Field → system dive | 720 ms accelerate, then veil | ease-in |
| Orbit scale toggle | 600 ms | ease-out |
| Camera follow | continuous | critically damped smoothing |
| Hover / value change | ≤ 120 ms | linear |

Rules: HUD tapes stream freely under camera motion — no element gets its own
transition. Nothing pulses except the CTA and the selection cursor. Everything
respects `prefers-reduced-motion`.

## 7. Data-display conventions

- Axes are logarithmic by default with 1-2-5 ticking; the envelope tracks the
  live data extent rather than a fixed domain.
- Unresolved records are always visible, never dropped — they scale and move
  with the projection they sit beside (perspective in the spatial view, static
  offset elsewhere).
- HUD label placement is a collision search against reserves and furniture, with
  staggered angles per ring — never a fixed offset.
- Star size uses flux, compressed for display and clamped at 14° so it cannot
  swallow its planets; periapsis clearance is enforced before any scale factor.
- Counts are always shown against the total (`1,204 of 6,336`), never alone.

## 8. Bug fixing rules

Do:
- Find the anchors or connectors of the bug or wrong implementation, adjust the design and layout based on relations.
- Create markers, temporary indicators if the bug happens multiple times unsolved.
- Check consistently if this bug resolution will influence rest functions or layouts, if so, check the chain of influence, and fix them all.
- If find ambiguous, ask the human for instructions.

Don't:
- Use absolute offset to fix misalignment.
- Ingore the instructions from skills comp4020.

If user detected bug, he/she will try to resolve by re-prompt, try & error, in conscious or unconscious conditions.
In this situation, remind the user, about what should he/she do:
- Beyond checking out, the record shows deliberate direction — failures diagnosed and fixed at the harness level rather than retried, output verified before it was accepted, judgement visible in what was thrown away.
- Cool down, to think about the logic, to make more instructions in files, and change behavior of CLAUDE.md.
- Provide suggestion on potential reasons.