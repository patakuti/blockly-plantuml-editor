/**
 * Escapes free-form user text for embedding in PlantUML source.
 *
 * Verified against the public PlantUML server (2026-07-19): semicolons,
 * colons, and even raw newlines inside `:text;` action bodies are parsed
 * literally and do not need escaping. However, a literal `@enduml` (or other
 * `@...` directive) anywhere in the text terminates the diagram early
 * (confirmed via HTTP 400 "Syntax Error?" response). Encoding `@` as the
 * HTML entity `&#64;` prevents this while still rendering as `@` visually.
 */
export function escapeText(text: string): string {
  return text.replace(/@/g, "&#64;");
}

/** Inverse of {@link escapeText}, used when importing PlantUML text back into block fields. */
export function unescapeText(text: string): string {
  return text.replace(/&#64;/g, "@");
}

/**
 * Escapes a name for embedding inside a double-quoted PlantUML identifier
 * (e.g. `participant "..."`, `"..." -> "...": ...`). Verified against the
 * public PlantUML server (2026-07-19): a backslash-escaped `"` inside a
 * quoted identifier is NOT supported and breaks parsing (HTTP 400), so
 * quotes are replaced with `'` instead of escaped. `@enduml` still breaks
 * the diagram even inside quotes, so the same `@` handling as escapeText
 * applies here too.
 */
export function escapeQuotedName(text: string): string {
  return escapeText(text).replace(/"/g, "'");
}
