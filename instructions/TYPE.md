# TYPE.md — typography

Three faces, each with one job. Nothing is set in a face outside its job.

| Face | Weight | Job |
|---|---|---|
| **ITC Avant Garde Gothic Bold** (fallbacks: ITC Avant Garde Gothic → Century Gothic → Poppins 700 → sans-serif) | 700 | The hero title. Nothing else, ever. |
| **Space Grotesk** | 400 / 500 / 700 | Headings, labels, UI, prose. |
| **IBM Plex Mono** | 400 / 500 | Every number, every machine utterance. |

Loaded as one Google Fonts request:
`Space+Grotesk:wght@400;500;700` + `Poppins:wght@700` + `IBM+Plex+Mono:wght@400;500`,
with `preconnect` to both `fonts.googleapis.com` and `fonts.gstatic.com`.
Avant Garde is a local/licensed face — the Poppins 700 fallback exists because
the layout must not shift if it is absent.

---

## 1. The hero title

```
content:      BLINDSPOTS            (one word, no punctuation, no subtitle)
font-size:    max(28, earthPx * 0.36) px      — 36% of the globe radius
letter-spacing: .08em
color:        #ffffff
white-space:  nowrap
text-shadow:  0 0 12px  rgba(255,255,255,.35)
              0 0 34px  rgba(255,255,255,.22)
              0 0 80px  rgba(210,225,255,.16)
animation:    titleFloat 9s ease-in-out infinite
```

```css
@keyframes titleFloat {
  0%,100% { transform: translateY(-6px); opacity: .94 }
  50%     { transform: translateY( 6px); opacity: 1   }
}
```

### 1.1 Position — it is anchored to the globe, not the viewport

```
wrap: position:absolute;
      left: earthCx%;  top: earthCy%;        // the globe's projected centre
      width:0; height:0;                     // zero-size anchor
      display:flex; align-items:center; justify-content:center;
      z-index:5; pointer-events:none;
```

A zero-size flex box centred on the globe centre means the word is centred on
the planet at any size, with no transform maths and no reflow. The title floats
±6 px over 9 s — a slow breath, deliberately out of sync with everything else on
the page (4.6 s sheen, 60 s scouts), so the hero never develops a beat.

### 1.2 Measuring the cap box

The scout routes bracket the word, so its **cap height** — not its line box —
must be known:

```ts
const r = titleEl.getBoundingClientRect();
const h = heroEl.getBoundingClientRect();
const fs  = parseFloat(getComputedStyle(titleEl).fontSize) || 60;
const cap = fs * 0.72;                       // Avant Garde cap-height ratio
const capTop = (r.top - h.top) + (r.height - cap) / 2;
titleTop    = round(capTop);
titleBottom = round(capTop + cap);
```

Run it on mount, again at +60 ms, on `document.fonts.ready`, and on every
resize; only `setState` when a value actually changed (it runs inside a render
path). The `0.72` is Avant Garde's cap ratio — if the face is swapped, this
number must be re-measured, or the scouts will graze the letters.

---

## 2. Space Grotesk — the voice of the page

| Use | Size | Weight | Tracking | Case |
|---|---|---|---|---|
| Panel / section heading | 13–19 px | 500–700 | .12–.18em | UPPER |
| Control labels, tabs | 11–12 px | 500 | .10–.16em | UPPER |
| Body, captions, prose | 11–13 px | 400 | .04–.09em | Sentence |

Set as `body` default so nothing falls back to a browser font.

---

## 3. IBM Plex Mono — the voice of the instrument

Every one of these is mono, without exception: axis ticks, tick labels, record
counts, catalogue IDs, RA/Dec, periods, distances, years, the HUD readouts, the
CTA, the hero code blocks, the arced text on the reflective cover.

| Use | Size | Weight | Tracking |
|---|---|---|---|
| Axis ticks | 8–9.5 px | 400 | .10–.14em |
| HUD readouts (`DISCOVERED // 2016`) | 10–11 px | 500 | .16–.22em |
| Hero code blocks | 10.5 px | 400 | .02em |
| Arc text (reflective cover) | max(11, earthPx*0.07) | 500 | .04em |
| CTA | 15 px | 400 | .18em |

### 3.1 Machine-voice grammar

- `//` separates instrument fields — `SPATIAL // RA + DEC`, `T // DISCOVERY YEAR`.
- `[ ]` wraps an action — `[ ENTER OBSERVATORY ]`, with spaces inside the brackets.
- `[ ]` also wraps units on axes — `X: ORBITAL PERIOD [D]`, `Y: RADIUS [R⊕]`.
- `....` dot leaders pad a key to a fixed width — `STATUS... TRANSMITTING`.
- Missing values print as an em-dash `—`, never as blank or `null`.
- Counts always carry their denominator: `1,204 of 6,336`.
- Columns are padded, never tabbed: `padEnd` for text, `padStart` for numbers,
  truncated hard at the column width.

---

## 4. Scale and floors

Sizes in use: 8 · 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 13 · 14 · 15 · 19 px, plus
the fluid title. Do not add values between these.

- **8 px is the absolute floor**, and only for axis tick numbers.
- Tracking rises as size falls — nothing under 12 px is set tighter than `.04em`.
- Line-height is 1.55 in the code blocks, 1.2–1.35 everywhere else.
- Legibility over a busy ground is bought with `text-shadow` stacks, never with
  a plate. The standard knockout is
  `0 0 2px #04050a, 0 0 6px rgba(4,5,10,.98)`; the arc text uses a five-stop
  version of the same idea.

---

## 5. Colour of type

```
#e8ecff   primary       #cfd6f6   secondary
#9aa3ca   labels        #6c7699   disabled
#f2f5ff   arc text      #cfe0ff   lens readout
#ffffff   title, active HUD accent
```

Type is never given a fan colour. The fan is structure; text is instrument.
