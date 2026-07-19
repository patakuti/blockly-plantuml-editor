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
