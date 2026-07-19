import { buildPreviewUrl } from "./plantumlEncoder";

const DEBOUNCE_MS = 300;

export class PreviewPanel {
  private readonly img: HTMLImageElement;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(container: HTMLElement) {
    this.img = document.createElement("img");
    this.img.alt = "PlantUML preview";
    container.appendChild(this.img);
  }

  /** Debounces updates so dragging blocks doesn't trigger a request per frame. */
  scheduleUpdate(plantUmlText: string): void {
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.img.src = buildPreviewUrl(plantUmlText);
    }, DEBOUNCE_MS);
  }
}
