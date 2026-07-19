const STORAGE_KEY = "bpe:splitRatio";
const DEFAULT_RATIO = 0.5;
const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

/**
 * Inserts a draggable splitter between `left` and `right` (both direct
 * children of `layout`, a flex row) so the user can resize the two panes.
 * The ratio is persisted to localStorage and restored on next load
 * (01_requirements.md FR-COM-10, 02_design.md 12.4).
 */
export function installSplitter(
  layout: HTMLElement,
  left: HTMLElement,
  right: HTMLElement,
  onResize: () => void,
): void {
  const splitter = document.createElement("div");
  splitter.className = "splitter";
  layout.insertBefore(splitter, right);

  applyRatio(left, readStoredRatio());

  let dragging = false;

  splitter.addEventListener("pointerdown", (event) => {
    dragging = true;
    splitter.setPointerCapture(event.pointerId);
    document.body.style.userSelect = "none";
  });

  splitter.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    applyRatio(left, ratioFromClientX(layout, event.clientX));
    onResize();
  });

  const stopDragging = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    splitter.releasePointerCapture(event.pointerId);
    document.body.style.userSelect = "";
    localStorage.setItem(STORAGE_KEY, String(ratioFromClientX(layout, event.clientX)));
    onResize();
  };
  splitter.addEventListener("pointerup", stopDragging);
  splitter.addEventListener("pointercancel", stopDragging);
}

function ratioFromClientX(layout: HTMLElement, clientX: number): number {
  const rect = layout.getBoundingClientRect();
  return clamp((clientX - rect.left) / rect.width, MIN_RATIO, MAX_RATIO);
}

function readStoredRatio(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return stored > 0 && stored < 1 ? stored : DEFAULT_RATIO;
}

function applyRatio(left: HTMLElement, ratio: number): void {
  left.style.flex = `0 0 ${ratio * 100}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
