const STORAGE_KEY = "bpe:plantumlServerBase";
const DEFAULT_SERVER_BASE = "https://www.plantuml.com/plantuml";

/** Hex-encodes UTF-8 bytes for the PlantUML server's `~h` request form. */
export function hexEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Returns the configured PlantUML server root (no trailing slash), or the official server. */
export function getPlantUmlServerBase(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? stored.replace(/\/+$/, "") : DEFAULT_SERVER_BASE;
}

/** Persists the PlantUML server root to use for future preview requests (01_requirements.md FR-COM-11). */
export function setPlantUmlServerBase(base: string): void {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
  else localStorage.removeItem(STORAGE_KEY);
}

export function buildPreviewUrl(plantUmlText: string): string {
  return `${getPlantUmlServerBase()}/svg/~h${hexEncode(plantUmlText)}`;
}

export function buildPngUrl(plantUmlText: string): string {
  return `${getPlantUmlServerBase()}/png/~h${hexEncode(plantUmlText)}`;
}
