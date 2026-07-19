import { buildPreviewUrl } from "./plantumlEncoder";

const DEBOUNCE_MS = 300;

/**
 * Shows the rendered SVG plus the generated PlantUML source text. The
 * source view doubles as the block-selection highlight target: PlantUML
 * SVGs from the public server carry no per-element source mapping, so
 * highlighting the corresponding source text is the documented fallback
 * for FR-SEQ-08 (02_design.md section 7).
 */
export class PreviewPanel {
  private readonly img: HTMLImageElement;
  private readonly sourceView: HTMLPreElement;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private currentSource = "";

  constructor(container: HTMLElement) {
    this.img = document.createElement("img");
    this.img.alt = "PlantUML preview";
    container.appendChild(this.img);

    this.sourceView = document.createElement("pre");
    this.sourceView.className = "preview-source";
    container.appendChild(this.sourceView);
  }

  /** Debounces updates so dragging blocks doesn't trigger a request per frame. */
  scheduleUpdate(plantUmlText: string): void {
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.currentSource = plantUmlText;
      this.img.src = buildPreviewUrl(plantUmlText);
      this.renderSource(null);
    }, DEBOUNCE_MS);
  }

  /** Highlights the first occurrence of `snippet` in the current source, or clears highlighting. */
  highlight(snippet: string | null): void {
    this.renderSource(snippet);
  }

  private renderSource(snippet: string | null): void {
    this.sourceView.replaceChildren();
    const index = snippet ? this.currentSource.indexOf(snippet) : -1;
    if (index === -1) {
      this.sourceView.textContent = this.currentSource;
      return;
    }
    this.sourceView.append(
      document.createTextNode(this.currentSource.slice(0, index)),
      Object.assign(document.createElement("mark"), {
        textContent: this.currentSource.slice(index, index + (snippet?.length ?? 0)),
      }),
      document.createTextNode(this.currentSource.slice(index + (snippet?.length ?? 0))),
    );
  }
}
