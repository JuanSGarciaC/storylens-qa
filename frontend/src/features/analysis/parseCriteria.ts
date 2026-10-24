/** Convierte el texto del formulario (un criterio por línea) en una lista limpia. */
export function parseCriteria(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0);
}
