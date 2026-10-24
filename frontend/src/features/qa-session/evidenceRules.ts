/** El backend rechaza imágenes de más de `max_evidence_mb` (1 MB = 1 000 000 bytes). */
export const MAX_IMAGE_BYTES = 1_000_000;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Devuelve la URL solo si es http o https; cualquier otro esquema se descarta. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Mensaje de error en español, o cadena vacía si el enlace es válido. */
export function linkError(value: string): string {
  return safeHttpUrl(value)
    ? ""
    : "El enlace debe ser una URL que empiece con http:// o https://.";
}

/** Mensaje de error en español, o cadena vacía si la imagen es válida. */
export function imageError(file: File): string {
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1_000_000).toFixed(1).replace(".", ",");
    return `La imagen pesa ${mb} MB y supera el límite de 1 MB. Elige una más liviana.`;
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return "La imagen debe ser PNG, JPEG o WebP.";
  }
  return "";
}

/** Los archivos de evidencia solo se cargan desde el endpoint propio de la API. */
export function evidenceFileUrl(value: string | null): string | null {
  return value && /^\/api\/v1\/evidences\/[^/?#]+\/file$/.test(value)
    ? value
    : null;
}
