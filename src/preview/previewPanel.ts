import { buildPngUrl, buildPreviewUrl } from "./plantumlEncoder";
import { exportPlantUmlText, saveFile } from "../workspace/persistence";

const DEBOUNCE_MS = 300;

/** Swaps a filename's extension, e.g. "activity-diagram.puml" -> "activity-diagram.svg". */
function replaceExtension(filename: string, extension: string): string {
  return filename.replace(/\.[^./]+$/, extension);
}

/**
 * Shows the rendered SVG plus the generated PlantUML source text. The
 * source view doubles as the block-selection highlight target: PlantUML
 * SVGs from the public server carry no per-element source mapping, so
 * highlighting the corresponding source text is the documented fallback
 * for FR-SEQ-08 (02_design.md section 7).
 *
 * Export PlantUML and Copy as Markdown live next to the source text they
 * act on; Export SVG and Export PNG live just above the rendered image they
 * act on instead, rather than in the global toolbar or mixed in with the
 * text actions (01_requirements.md FR-SAVE-07/FR-SAVE-08, 02_design.md
 * 12.7/45.4).
 */
const SERVER_UNCONFIGURED_MESSAGE =
  "PlantUML server is not configured. Check config.json (see README) and reload the page.";

export class PreviewPanel {
  private readonly img: HTMLImageElement;
  private readonly serverUnconfigured: HTMLParagraphElement;
  private readonly sourceView: HTMLPreElement;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private currentSource = "";
  private currentFilename = "diagram.puml";

  constructor(container: HTMLElement) {
    const imageActions = document.createElement("div");
    imageActions.className = "preview-actions";

    const exportSvgButton = document.createElement("button");
    exportSvgButton.textContent = "Export SVG";
    exportSvgButton.addEventListener("click", () => {
      const url = buildPreviewUrl(this.currentSource);
      if (!url) {
        window.alert(SERVER_UNCONFIGURED_MESSAGE);
        return;
      }
      void this.exportImage(url, replaceExtension(this.currentFilename, ".svg"), "image/svg+xml", [".svg"]);
    });

    const exportPngButton = document.createElement("button");
    exportPngButton.textContent = "Export PNG";
    exportPngButton.addEventListener("click", () => {
      const url = buildPngUrl(this.currentSource);
      if (!url) {
        window.alert(SERVER_UNCONFIGURED_MESSAGE);
        return;
      }
      void this.exportImage(url, replaceExtension(this.currentFilename, ".png"), "image/png", [".png"]);
    });

    imageActions.append(exportSvgButton, exportPngButton);
    container.appendChild(imageActions);

    this.img = document.createElement("img");
    this.img.alt = "PlantUML preview";
    container.appendChild(this.img);

    this.serverUnconfigured = document.createElement("p");
    this.serverUnconfigured.className = "preview-server-unconfigured";
    this.serverUnconfigured.textContent = SERVER_UNCONFIGURED_MESSAGE;
    this.serverUnconfigured.style.display = "none";
    container.appendChild(this.serverUnconfigured);

    const textActions = document.createElement("div");
    textActions.className = "preview-actions";

    const exportButton = document.createElement("button");
    exportButton.textContent = "Export PlantUML";
    exportButton.addEventListener("click", () => {
      void exportPlantUmlText(this.currentFilename, this.currentSource);
    });

    const copyButton = document.createElement("button");
    copyButton.textContent = "Copy as Markdown";
    copyButton.addEventListener("click", () => {
      void navigator.clipboard.writeText("```plantuml\n" + this.currentSource + "\n```");
    });

    textActions.append(exportButton, copyButton);
    container.appendChild(textActions);

    this.sourceView = document.createElement("pre");
    this.sourceView.className = "preview-source";
    container.appendChild(this.sourceView);
  }

  /** Sets the filename Export PlantUML should suggest, e.g. when the active diagram tab changes. */
  setActiveFilename(filename: string): void {
    this.currentFilename = filename;
  }

  /** Debounces updates so dragging blocks doesn't trigger a request per frame. */
  scheduleUpdate(plantUmlText: string): void {
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.currentSource = plantUmlText;
      const url = buildPreviewUrl(plantUmlText);
      this.img.style.display = url ? "" : "none";
      this.serverUnconfigured.style.display = url ? "none" : "";
      if (url) this.img.src = url;
      this.renderSource(null);
    }, DEBOUNCE_MS);
  }

  /** Highlights the first occurrence of `snippet` in the current source, or clears highlighting. */
  highlight(snippet: string | null): void {
    this.renderSource(snippet);
  }

  /** Fetches the rendered image from the PlantUML server and saves it; alerts instead of saving on failure (01_requirements.md FR-SAVE-08). */
  private async exportImage(
    url: string,
    filename: string,
    mimeType: string,
    extensions: string[],
  ): Promise<void> {
    let blob: Blob;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      blob = await response.blob();
    } catch (error) {
      window.alert(
        `Failed to fetch the diagram image from the PlantUML server.\n${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }
    await saveFile(filename, blob, mimeType, extensions);
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
