import { EmptyState } from "./EmptyState";
import type { Tone } from "./Badge";

export type RingSegment = { label: string; value: number; tone: Tone };

const RADIUS = 40;
const CIRC = 2 * Math.PI * RADIUS;
const COLORS: Record<Tone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  info: "var(--accent)",
  neutral: "var(--muted)",
};

export function Ring({ segments }: { segments: RingSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return (
      <EmptyState
        title="Sin datos"
        body="Todavía no hay valores para mostrar en este gráfico."
      />
    );
  }
  const visible = segments
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, len: (s.value / total) * CIRC }));
  const starts = visible.map((_, i) =>
    visible.slice(0, i).reduce((sum, v) => sum + v.len, 0),
  );
  const summary = segments.map((s) => `${s.label} ${s.value}`).join(", ");
  return (
    <div className="ring">
      <svg
        className="ring__svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Distribución: ${summary}`}
      >
        {visible.map((s, i) => (
          <circle
            key={`${i}-${s.label}`}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={COLORS[s.tone]}
            strokeWidth="10"
            strokeDasharray={`${s.len} ${CIRC - s.len}`}
            strokeDashoffset={-starts[i]}
            transform="rotate(-90 50 50)"
          />
        ))}
      </svg>
      <ul className="ring__legend">
        {segments.map((s, i) => (
          <li key={`${i}-${s.label}`}>
            <span
              className="ring__swatch"
              style={{ background: COLORS[s.tone] }}
              aria-hidden="true"
            />
            <span>{`${s.label} ${s.value}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
