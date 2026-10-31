import { apiUrl } from "../../api/client";

interface Props {
  /** Ruta del reporte sin formato, p. ej. `/analyses/ID/report`. */
  path: string;
  /** Qué se descarga, p. ej. «reporte del análisis»; da el nombre accesible del enlace. */
  what: string;
}

const FORMATS = [
  { format: "md", label: "Markdown" },
  { format: "pdf", label: "PDF" },
] as const;

/** Descargas directas del reporte (lo genera el servidor). Visibles como botones cortos. */
export function ReportLinks({ path, what }: Props) {
  return (
    <span className="report-links">
      <span className="hint" aria-hidden="true">
        Descargar
      </span>
      {FORMATS.map(({ format, label }) => (
        <a
          key={format}
          className="btn btn--ghost btn--sm"
          href={apiUrl(`${path}?format=${format}`)}
          download
        >
          {/* El nombre accesible contiene el texto visible (WCAG 2.5.3). */}
          <span className="visually-hidden">{`Descargar ${what} (`}</span>
          {label}
          <span className="visually-hidden">)</span>
        </a>
      ))}
    </span>
  );
}
