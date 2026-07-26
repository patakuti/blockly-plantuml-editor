let serverBase: string | null = null;

interface PlantUmlConfig {
  plantUmlServerBase?: string;
}

/** Hex-encodes UTF-8 bytes for the PlantUML server's `~h` request form. */
export function hexEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Fetches config.json once at startup and caches the PlantUML server base
 * for getPlantUmlServerBase(). Does NOT fall back to the public server on
 * failure (01_requirements.md FR-COM-11): silently substituting a different
 * server risks sending diagram content somewhere the deployer didn't
 * intend. console.warn is a diagnostic aid only -- previewPanel.ts is what
 * actually surfaces "not configured" to whoever has the page open, since a
 * console message alone isn't reliably seen.
 */
export async function loadPlantUmlServerConfig(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`);
    if (!response.ok) {
      console.warn(`config.json: HTTP ${response.status}. PlantUML preview will be unavailable until it's fixed.`);
      return;
    }
    const config = (await response.json()) as PlantUmlConfig;
    const trimmed = config.plantUmlServerBase?.trim().replace(/\/+$/, "");
    if (trimmed) {
      serverBase = trimmed;
    } else {
      console.warn('config.json: "plantUmlServerBase" is missing or empty. PlantUML preview will be unavailable until it\'s fixed.');
    }
  } catch (error) {
    console.warn("config.json could not be loaded. PlantUML preview will be unavailable until it's fixed.", error);
  }
}

/** Returns the PlantUML server root (no trailing slash) resolved by loadPlantUmlServerConfig(), or null if config.json hasn't resolved to a usable value. */
export function getPlantUmlServerBase(): string | null {
  return serverBase;
}

export function buildPreviewUrl(plantUmlText: string): string | null {
  const base = getPlantUmlServerBase();
  return base ? `${base}/svg/~h${hexEncode(plantUmlText)}` : null;
}

export function buildPngUrl(plantUmlText: string): string | null {
  const base = getPlantUmlServerBase();
  return base ? `${base}/png/~h${hexEncode(plantUmlText)}` : null;
}
