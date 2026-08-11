// SCOUT-SHIP.md — the two crossings.
//
// This module owns exactly one thing: §1's routes, which are MEASURED from the
// title box rather than hard-coded, so the two passes bracket the word at any
// size. Everything else — the five layers, the gradients, the masks, the 60s
// cycle — is CSS, because none of it needs to know anything JavaScript knows.
//
// §6: "if the title reflows the routes must move with it", which is why this is
// called from hero.ts's fitTitle path and not just once on load. The title is
// re-fitted on resize, on font load, and whenever the globe's measured radius
// changes, and the routes have to follow all three.

export function placeScoutRoutes(): void {
  const hero = document.getElementById("hero");
  const title = document.getElementById("hero-title");
  if (!(hero instanceof HTMLElement) || !(title instanceof HTMLElement)) return;

  const heroBox = hero.getBoundingClientRect();
  const box = title.getBoundingClientRect();
  if (!box.height) return;

  // The title floats +/-6px on a 9s loop, and getBoundingClientRect includes
  // that transform — so measuring naively gives a different answer depending on
  // which frame it lands on, and the routes end up wherever the float happened
  // to be. Subtract just the translation and keep the scale: the scale is what
  // makes the word its visible size, the float is what makes the measurement
  // non-deterministic. Caught by arithmetic, not by eye — the measured route
  // was 375.6 where titleTop 408 and a gap of 408/18 predict 385.3.
  const transform = getComputedStyle(title).transform;
  const floatY =
    transform && transform !== "none" ? new DOMMatrixReadOnly(transform).f : 0;

  // Relative to the hero, since the anchors are absolutely positioned inside it
  // and the hero is not always at the top of the document once you have
  // scrolled.
  const titleTop = box.top - heroBox.top - floatY;
  const titleBottom = box.bottom - heroBox.top - floatY;

  // One FIFTEENTH of the distance from the top of the frame, at the author's
  // call — §1 said one eighteenth, and the routes sat further off the word than
  // intended once the title stopped being so tall. Still taken as the clearance
  // on BOTH sides from the same figure, which is what keeps the pair symmetric
  // about the word: the trails are the word's boundary, so they have to move
  // when it does.
  const gap = titleTop / 15;
  hero.style.setProperty("--scout-top-y", `${titleTop - gap}px`);
  hero.style.setProperty("--scout-bot-y", `${titleBottom + gap}px`);
}
