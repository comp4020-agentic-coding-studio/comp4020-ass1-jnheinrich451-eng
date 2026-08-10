// LEFT-OBSERVE.md and LEFT-FIND.md — the left rail's two tabs.
//
// The rule both documents open with, and the one this file exists to honour:
// switching tabs changes NOTHING about the archive, and FIND never writes
// methodFilter. FIND reaches a record; OBSERVE chooses a population.

import { BUCKET_COLOUR, C, type Archive, type Row } from "./data";
import { renderTarget } from "./target";
import {
  REQUIREMENTS,
  type MethodFilter,
  type SortKey,
  coverage,
  emit,
  results,
  state,
} from "./store";

/** LEFT-OBSERVE.md §3. The labels are the observing ACT, not the catalogue
 *  term — WOBBLE, not "radial velocity". The catalogue term still appears
 *  verbatim in the TARGET panel and in FIND rows, so nothing is renamed away. */
const METHODS: { label: string; id: MethodFilter; dot: string }[] = [
  { label: "All", id: "all", dot: "#dfe4ff" },
  { label: "Transit", id: "Transit", dot: BUCKET_COLOUR.Transit },
  { label: "Wobble", id: "Radial Velocity", dot: BUCKET_COLOUR["Radial Velocity"] },
  { label: "Imaging", id: "Imaging", dot: BUCKET_COLOUR.Imaging },
  { label: "Microlens", id: "Microlensing", dot: BUCKET_COLOUR.Microlensing },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "distance", label: "Distance" },
  { id: "year", label: "Discovery year" },
  { id: "radius", label: "Radius" },
];

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

const fmt = (v: number): string => v.toLocaleString("en-AU");

export function initPanels(archive: Archive): void {
  const rail = document.querySelector<HTMLElement>(".panel-left");
  if (!rail) return;
  rail.textContent = "";

  // ---- the tab pair, shared by both panels (LEFT-OBSERVE.md §1) ------------
  const tabs = el("div", "tabs");
  tabs.setAttribute("role", "tablist");
  const tabButtons: HTMLButtonElement[] = ["Observe", "Find"].map((label, i) => {
    const b = el("button", "tab");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => {
      state.panelMode = i === 0 ? "observe" : "find";
      render();
    });
    tabs.append(b);
    return b;
  });
  rail.append(tabs);

  // ---- OBSERVE ------------------------------------------------------------
  const observe = el("div", "tabpanel");
  const oh = el("h3");
  oh.append("Observation", el("br"), "method");
  observe.append(oh);
  const list = el("ul", "methods");
  const methodRows = METHODS.map((m) => {
    const li = el("li");
    const b = el("button", "method-row");
    b.type = "button";
    const dot = el("span", "dot");
    const label = el("span", undefined, m.label);
    b.append(dot, label);
    b.addEventListener("click", () => {
      // §4: click sets methodFilter and NOTHING else. Projection, camera,
      // selection and the FIND query all survive.
      state.methodFilter = m.id;
      state.limit = 80; // §0: a population change resets paging, never the query
      render();
      emit();
    });
    li.append(b);
    list.append(li);
    return { m, b, dot };
  });
  observe.append(list);
  rail.append(observe);

  // ---- FIND ---------------------------------------------------------------
  const find = el("div", "tabpanel find");

  find.append(el("h3", undefined, "Target search"));
  const input = el("input", "find-input");
  input.type = "search";
  input.placeholder = "Search planets or host stars";
  input.setAttribute("aria-label", "Search planets or host stars");
  input.addEventListener("input", () => {
    state.query = input.value;
    state.limit = 80;
    render();
  });
  input.addEventListener("keydown", (e) => {
    // §2: Esc returns to the OBSERVE tab — it does not clear the query.
    if (e.key === "Escape") {
      state.panelMode = "observe";
      render();
    }
  });
  find.append(input);

  // Presets are shortcuts INTO existing controls, never a hidden fourth filter
  // (§2), so each one writes a control the user can also reach directly.
  const chips = el("div", "chips");
  const presets: { label: string; run: () => void }[] = [
    {
      label: "System ready",
      run: () => {
        state.requirements.add("sysready");
      },
    },
    { label: "Nearest", run: () => (state.sort = "distance") },
    { label: "Recent", run: () => (state.sort = "year") },
  ];
  for (const p of presets) {
    const b = el("button", "chip");
    b.type = "button";
    b.textContent = p.label;
    b.addEventListener("click", () => {
      p.run();
      state.limit = 80;
      render();
    });
    chips.append(b);
  }
  find.append(chips);

  find.append(el("h3", undefined, "Require data"));
  find.append(el("p", "micro", "Require all selected"));
  const reqList = el("ul", "requirements");
  const reqRows = REQUIREMENTS.map((r) => {
    const li = el("li");
    const b = el("button", "req-row");
    b.type = "button";
    const box = el("span", "box");
    b.append(box, el("span", undefined, r.label));
    b.addEventListener("click", () => {
      if (state.requirements.has(r.id)) state.requirements.delete(r.id);
      else state.requirements.add(r.id);
      state.limit = 80;
      render();
    });
    li.append(b);
    reqList.append(li);
    return { r, b, box };
  });
  find.append(reqList);

  const sortRow = el("label", "sort-row");
  sortRow.append(el("span", "dim", "Sort"));
  const sortSel = el("select", "sort-select");
  for (const s of SORTS) {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.label;
    sortSel.append(o);
  }
  sortSel.addEventListener("change", () => {
    state.sort = sortSel.value as SortKey;
    render();
  });
  sortRow.append(sortSel);
  find.append(sortRow);

  const countRow = el("div", "count-row");
  const countText = el("p", "readout");
  const clear = el("button", "chip");
  clear.type = "button";
  clear.textContent = "Clear";
  clear.addEventListener("click", () => {
    // §0: CLEAR clears query, requirements and sort — and touches nothing else.
    // methodFilter is OBSERVE's, so it is deliberately not reset here.
    state.query = "";
    input.value = "";
    state.requirements.clear();
    state.sort = "name";
    sortSel.value = "name";
    state.limit = 80;
    render();
  });
  countRow.append(countText, clear);
  find.append(countRow);

  const empty = el("div", "find-empty");
  find.append(empty);
  const rows = el("ul", "find-rows");
  find.append(rows);
  const more = el("button", "show-more");
  more.type = "button";
  more.addEventListener("click", () => {
    state.limit += 120; // §5: 80, then +120
    render();
  });
  find.append(more);
  const showing = el("p", "showing");
  find.append(showing);

  rail.append(find);

  // ---- render -------------------------------------------------------------
  function methodLabel(row: Row): string {
    return archive.methods[row[C.method] as number];
  }

  /** §3 line 3: at most three of R / M / T / D in that priority; with none it
   *  reads NO DISPLAY VALUES rather than an empty line. */
  function values(row: Row): string {
    const bits: string[] = [];
    const n = (i: number): number | null =>
      typeof row[i] === "number" ? (row[i] as number) : null;
    const r = n(C.rade);
    const m = n(C.bmasse);
    const t = n(C.eqt);
    const d = n(C.dist);
    if (r !== null) bits.push(`R ${r} R⊕`);
    if (m !== null) bits.push(`M ${m.toFixed(1)} M⊕`);
    if (t !== null) bits.push(`T ${Math.round(t)} K`);
    if (d !== null) bits.push(`D ${d.toFixed(1)} pc`);
    return bits.length ? bits.slice(0, 3).join(" · ") : "No display values";
  }

  function render(): void {
    const isFind = state.panelMode === "find";
    tabButtons[0].classList.toggle("is-active", !isFind);
    tabButtons[1].classList.toggle("is-active", isFind);
    tabButtons.forEach((b, i) =>
      b.setAttribute("aria-selected", String(isFind === (i === 1))),
    );
    observe.hidden = isFind;
    find.hidden = !isFind;

    for (const { m, b, dot } of methodRows) {
      const on = state.methodFilter === m.id;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
      dot.textContent = on ? "●" : "○";
      dot.style.color = on ? m.dot : "rgba(150,170,255,.45)";
    }

    for (const { r, b, box } of reqRows) {
      const on = state.requirements.has(r.id);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
      box.textContent = on ? "■" : "□";
    }

    if (!isFind) return; // nothing below is visible, so nothing below is built

    const { results: idx, pool } = results(archive);
    countText.textContent = `${fmt(idx.length)} / ${fmt(pool)} current signals`;

    empty.textContent = "";
    if (idx.length === 0) {
      // §5: name WHICH constraint bit, and clear only that constraint.
      const why = state.requirements.size
        ? `Requiring // ${[...state.requirements]
            .map((id) => REQUIREMENTS.find((r) => r.id === id)?.label ?? id)
            .join(" + ")}`
        : state.query
          ? `Query // ${state.query}`
          : `Method // ${state.methodFilter}`;
      empty.append(
        el("p", undefined, "No targets match current filters"),
        el("p", "micro", why),
      );
      if (state.requirements.size) {
        const b = el("button", "chip");
        b.type = "button";
        b.textContent = "[ Clear data filters ]";
        b.addEventListener("click", () => {
          state.requirements.clear();
          state.limit = 80;
          render();
        });
        empty.append(b);
      }
    }

    const shown = idx.slice(0, state.limit);
    rows.textContent = "";
    for (const i of shown) {
      const row = archive.rows[i];
      const li = el("li", "find-row");
      const l1 = el("div", "l1");
      l1.append(el("span", undefined, String(row[C.name])));
      const cov = coverage(row);
      const glyph = el("span", "cov", cov.map((c) => (c ? "●" : "○")).join(""));
      // §3: the marks are never the only carrier.
      glyph.setAttribute(
        "aria-label",
        `${cov.filter(Boolean).length} of 4 visualisation data groups available`,
      );
      l1.append(glyph);
      const year = typeof row[C.year] === "number" ? row[C.year] : "Unresolved";
      li.append(
        l1,
        el("div", "l2", `${methodLabel(row)} · ${year}`),
        el("div", "l3", values(row)),
      );
      // §4: hover is PREVIEW, click is LOCK — and a row hover writes the same
      // state a field hover will, so the two can never fight.
      li.addEventListener("pointerenter", () => {
        if (window.matchMedia("(hover: none)").matches) return; // §4: not narrow
        state.previewIdx = i;
        renderTarget();
      });
      li.addEventListener("pointerleave", () => {
        if (state.previewIdx === i) state.previewIdx = null;
        renderTarget();
      });
      li.addEventListener("click", () => {
        state.selectedIdx = i;
        state.previewIdx = null;
        for (const n of rows.querySelectorAll(".find-row")) n.classList.remove("is-selected");
        li.classList.add("is-selected");
        renderTarget();
      });
      li.tabIndex = 0;
      rows.append(li);
    }

    const remaining = idx.length - shown.length;
    more.hidden = remaining <= 0;
    more.textContent = `[ Show ${fmt(Math.min(120, remaining))} more ]`;
    // §5: the list never pretends to be complete.
    showing.textContent = `Showing ${fmt(shown.length)} of ${fmt(idx.length)}`;
  }

  render();
}
