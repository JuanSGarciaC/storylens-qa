interface Props {
  /** Ruta del reporte sin formato, p. ej. `/analyses/ID/report`. */
  path: string;
  /** Qué se descarga, p. ej. «reporte del análisis». */
  what: string;
}

const FORMATS = [
  { format: "md", label: "Markdown" },
  { format: "pdf", label: "PDF" },
] as const;

/** Descargas directas del reporte (lo genera el servidor). */
export function ReportLinks({ path, what }: Props) {
  return (
    <p className="report-links">
      {FORMATS.map(({ format, label }, index) => (
        <span key={format}>
          {index > 0 && " · "}
          <a href={`/api/v1${path}?format=${format}`} download>
            {`Descargar ${what} (${label})`}
          </a>
        </span>
      ))}
    </p>
  );
}
