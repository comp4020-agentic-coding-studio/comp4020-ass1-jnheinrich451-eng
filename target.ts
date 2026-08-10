// RIGHT-TARGET.md — one record, read-only, plus the two actions on it.
//
// §6 is the rule the whole panel obeys: this is a READOUT. It never edits,
// never rounds silently, never substitutes. Every number here is an archive
// value; anything derived or compressed belongs in the system view, labelled as
// such. So a missing value prints UNRESOLVED in its slot rather than a dash, a
// zero, or a blank.

import { C, type Archive, type Projection, missingFor } from "./data";
import { state, targetIdx } from "./store";

/** §3's six rows, in fixed order at fixed precision. */
const ROWS: { label: string; col: number; dp: number; unit: string }[] = [
  { label: "Orbit", col: C.orbsmax, dp: 3, unit: "AU" },
  { label: "Period", col: C.orbper, dp: 1, unit: "D" },
  { label: "Radius", col: C.rade, dp: 2, unit: "R⊕" },
  { label: "Mass", col: C.bmasse, dp: 1, unit: "M⊕" },
  { label: "Eq temp", col: C.eqt, dp: 0, unit: "K" },
  { label: "Dist", col: C.dist, dp: 1, unit: "PC" },
];

const WIDTH = Math.max(...ROWS.map((r) => r.label.length)) + 2;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

export function initTarget(archive: Archive): void {
  const rail = document.querySelector<HTMLElement>(".panel-right");
  if (!rail) return;

  function render(): void {
    if (!rail) return;
    rail.textContent = "";

    // §2: the header is always present, and carries the clear only when there
    // is something to clear.
    const head = el("div", "target-head");
    head.append(el("h3", undefined, "Target"));
    const idx = targetIdx();
    if (idx !== null) {
      const x = el("button", "target-clear");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", "Clear selection");
      x.addEventListener("click", () => {
        state.selectedIdx = null;
        state.previewIdx = null;
        render();
      });
      head.append(x);
    }
    rail.append(head);

    if (idx === null) {
      // §2: sentence case, because it is a status and not a label.
      const p = el("p", "target-empty");
      p.append("No target", el("br"), "selected");
      rail.append(p);
      return;
    }

    const row = archive.rows[idx];

    // §2: the preview banner. The panel is otherwise identical, so scanning
    // FIND reads full records without committing to one.
    if (state.previewIdx !== null) {
      rail.append(el("p", "target-preview", "Preview · not locked"));
    }

    rail.append(el("p", "target-name", String(row[C.name])));
    rail.append(el("p", "target-host", String(row[C.host])));
    const year = typeof row[C.year] === "number" ? row[C.year] : "Unresolved";
    rail.append(
      el("p", "target-method", `${archive.methods[row[C.method] as number]} · ${year}`),
    );

    // §3: a leader-dot row, NOT a table — labels padded to equal width so the
    // values form a hard left column.
    const block = el("pre", "target-rows");
    block.textContent = ROWS.map((r) => {
      const v = row[r.col];
      const value =
        typeof v === "number" ? `${v.toFixed(r.dp)} ${r.unit}` : "UNRESOLVED";
      return `${(r.label.toUpperCase() + " ").padEnd(WIDTH, "…")} ${value}`;
    }).join("\n");
    rail.append(block);

    // §4: why this record sits in the holding cloud instead of the plot. It
    // changes with the projection; the record above it does not.
    const missing = missingFor(row, state.projection as Projection);
    if (missing.length) {
      const note = el("div", "target-note");
      note.append(
        el("p", undefined, "Current projection // unresolved"),
        el("p", undefined, `Missing // ${missing.join(", ").toUpperCase()}`),
      );
      rail.append(note);
    }

    // §5. Both actions are rendered here; what they DO belongs to
    // INTERACTION.md and OPEN-SYSTEM.md, which the author scheduled last. They
    // are marked disabled rather than left live-looking, because a control that
    // silently does nothing is worse than one that says it cannot yet.
    if (!missing.length) {
      const centre = el("button", "action action-centre", "[ Center target ]");
      centre.type = "button";
      centre.disabled = true;
      centre.title = "Behaviour defined in INTERACTION.md — not yet wired";
      rail.append(centre);
    }
    const open = el("button", "action action-open", "[ Open system ]");
    open.type = "button";
    open.disabled = true;
    open.title = "Behaviour defined in OPEN-SYSTEM.md — not yet wired";
    rail.append(open);
  }

  redraw = render;
  render();
}

// Let the other panels ask for a redraw without importing each other.
let redraw: () => void = () => {};
export const renderTarget = (): void => redraw();
