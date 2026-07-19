const PLANTUML_SERVER_BASE = "https://www.plantuml.com/plantuml/svg/~h";

/** Hex-encodes UTF-8 bytes for the PlantUML server's `~h` request form. */
export function hexEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildPreviewUrl(plantUmlText: string): string {
  return PLANTUML_SERVER_BASE + hexEncode(plantUmlText);
}
