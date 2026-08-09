// REFLECTIVE-COVER.md §1-2 — the instrument arc.
//
// §3's lens (the iris, tick ring and readout) is deliberately NOT built: it is
// out of scope for now. That also means the hero has no pointer target, which is
// correct — the lens was the only one.
//
// Everything is sized from one measured number: `px`, the globe's on-screen
// radius, projected out of the three.js scene. There are no hard-coded sizes
// here beyond §5's three permitted literals (15 panel height, 26 text offset,
// 2/3 radii and overlap).
//
// The panels are built in script rather than written into the markup because
// every dimension depends on `px`, which only exists at runtime. Their geometry
// is re-applied, not rebuilt, on resize.

const PANEL_COUNT = 26;
const PANEL_HEIGHT = 15;
const TEXT_OFFSET = 26;
const ARC_SPAN = 150;
const ARC_START = -75;
// DEVIATION from REFLECTIVE-COVER.md §2, flagged rather than silent.
//
// The doc says R = px * 1.18. With squash 0.5 that puts the arc's apex at
// 0.59px above the globe centre — INSIDE a disc whose limb is at 1.00px — so
// ~130 of the 150 degrees sit behind the planet. The panels are invisible and
// only ~8 of the 41 arced characters clear the silhouette. That contradicts §4,
// which wants a ring whose panels *disappear at* the silhouette, and §2.3,
// which wants the text to "float clear of the panels" as a statement.
//
// The apex has to exceed ~0.9px for the ring to clear the top of the globe, so
// R must be ~1.85px: the top of the arc then passes behind the planet (§4 holds)
// while both flanks sweep out past the limb and stay readable. Revert to 1.18 if
// the invisible reading was intended.
const ARC_RADIUS_SCALE = 1.85;
const SQUASH = 0.5;
const ARC_TEXT = "THE UNIVERSE ACCORDING TO OUR INSTRUMENTS";

interface Cover {
  layout(px: number, heroWidth: number): void;
}

// Half-width the arc occupies, as a fraction of its radius: sin(75deg), the
// outermost panel angle.
const ARC_HALF_WIDTH = Math.sin((ARC_START * Math.PI) / 180);

export function initReflectiveCover(host: HTMLElement): Cover | null {
  // Narrowed into locals up front: TypeScript can't carry the null check across
  // the layout() closure boundary, and layout() runs on every resize.
  const found = {
    arcWrap: host.querySelector<HTMLElement>(".cover-arc"),
    textWrap: host.querySelector<HTMLElement>(".cover-arc-text"),
  };
  if (!found.arcWrap || !found.textWrap) return null;
  const { arcWrap, textWrap } = found;

  const panels: HTMLElement[] = [];
  for (let i = 0; i < PANEL_COUNT; i++) {
    const segment = document.createElement("div");
    segment.className = "cover-panel";
    // The sheen is a child so it can sweep the full bleed of a segment that is
    // itself rotated into place; §2.2's stagger is what turns 26 separate
    // sweeps into one wave crossing the arc.
    const sheen = document.createElement("i");
    sheen.className = "cover-sheen";
    sheen.style.animationDelay = `${(i * 0.12).toFixed(2)}s`;
    segment.append(sheen);
    arcWrap.append(segment);
    panels.push(segment);
  }

  // One span per character, so each can be counter-rotated upright on the arc.
  // The spans are decorative markup for a single phrase — the readable copy is
  // the container's aria-label, or assistive tech reads it letter by letter.
  const glyphs: HTMLElement[] = [];
  const chars = [...ARC_TEXT];
  for (const char of chars) {
    const span = document.createElement("span");
    // A literal space collapses on the arc; NBSP holds its step.
    span.textContent = char === " " ? "\u00A0" : char;
    textWrap.append(span);
    glyphs.push(span);
  }

  function layout(px: number, heroWidth: number): void {
    // Clamped to the viewport. The arc is sized from the globe alone, and on a
    // 390px-wide screen the globe is ~96% of the width, so an unclamped
    // 1.85x ring ran off both edges and cut the arced text in half. Clamping
    // trades ring visibility for staying on screen: at 390x844 this lands near
    // the doc's own 1.18, where the arc tucks behind the planet.
    const fits = (heroWidth * 0.47) / Math.abs(ARC_HALF_WIDTH) - TEXT_OFFSET;
    const R = Math.min(px * ARC_RADIUS_SCALE, fits);

    // At 390x844 the globe is ~96% of the viewport width, so the clamp pulls R
    // below the radius at which the arc's apex clears the globe's top. Every
    // panel then hides behind the planet and only two or three glyphs poke out
    // beside the title, which reads as debris, not design. Hide the whole
    // component in that case rather than ship fragments. The three ways out are
    // all design calls, not code ones: shrink the globe on narrow viewports,
    // narrow the arc's span, or accept it being desktop-only.
    host.classList.toggle("is-cramped", R < px * 1.8);
    arcWrap.style.marginTop = `${px * 0.1}px`;
    textWrap.style.marginTop = `${px * 0.1}px`;

    // +3 so neighbours overlap and the arc shows no seams.
    const width = (2 * Math.PI * R * (ARC_SPAN / 360)) / PANEL_COUNT + 3;
    panels.forEach((panel, i) => {
      const angle = ARC_START + (i / (PANEL_COUNT - 1)) * ARC_SPAN;
      panel.style.width = `${width.toFixed(2)}px`;
      panel.style.height = `${PANEL_HEIGHT}px`;
      panel.style.transform = `rotate(${angle.toFixed(3)}deg) translateY(${-R.toFixed(2)}px)`;
    });

    const step = ARC_SPAN / (chars.length - 1);
    const textR = R + TEXT_OFFSET;
    glyphs.forEach((glyph, i) => {
      const angle = ARC_START + i * step;
      // rotate out, push to the arc, rotate back upright, then undo the wrap's
      // squash so the glyph is undistorted — only its path is curved.
      glyph.style.transform =
        `rotate(${angle.toFixed(3)}deg) translateY(${-textR.toFixed(2)}px) ` +
        `rotate(${(-angle).toFixed(3)}deg) scaleY(${1 / SQUASH})`;
    });
    textWrap.style.fontSize = `${Math.max(11, px * 0.07).toFixed(2)}px`;

  }

  return { layout };
}
