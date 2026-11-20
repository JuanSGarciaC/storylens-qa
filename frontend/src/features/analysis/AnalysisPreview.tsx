import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../shared/ui/motion";
import { useCountUp } from "../../shared/ui/useCountUp";
import { Badge } from "../../shared/ui/Badge";

/*
 * H2 live demo mock: recreación animada del análisis de la historia de ejemplo
 * de TryPage. Los textos reproducen lo que devuelve el motor de reglas para ese
 * ejemplo (catálogo 1.0.0); si cambian las reglas, actualizar aquí.
 * Pasos: 1 barrido · 2–4 términos vagos · 5 hallazgos · 6 puntaje.
 */
const FINAL_STEP = 6;
const SCHEDULE = [
  [1, 250],
  [2, 1050],
  [3, 1350],
  [4, 1650],
  [5, 2050],
  [6, 2850],
] as const;
const EXAMPLE_SCORE = 46;

function playable(): boolean {
  return (
    !prefersReducedMotion() &&
    typeof IntersectionObserver === "function" &&
    window.innerWidth >= 600
  );
}

export function AnalysisPreview() {
  const figure = useRef<HTMLElement>(null);
  const [animated] = useState(playable);
  const [step, setStep] = useState(animated ? 0 : FINAL_STEP);
  const [run, setRun] = useState(0);
  const score = useCountUp(EXAMPLE_SCORE, animated && step >= FINAL_STEP);

  // Empieza cuando el ejemplo se ve (y se pausa fuera de pantalla: no hay nada que mover).
  useEffect(() => {
    const node = figure.current;
    if (!animated || !node) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        for (const [value, at] of SCHEDULE)
          timers.push(window.setTimeout(() => setStep(value), at));
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [animated, run]);

  const on = (n: number) => (step >= n ? " is-on" : "");

  return (
    <figure
      ref={figure}
      className={`preview${animated ? " preview--animated" : ""}`}
      data-step={step}
      aria-labelledby="preview-title"
    >
      <figcaption className="preview__head">
        <Badge tone="info">Ejemplo</Badge>
        <span id="preview-title">
          Así revisa StoryLens la historia de ejemplo
        </span>
      </figcaption>

      <div className={`preview__story${on(1)}`}>
        <span className="preview__scan" aria-hidden="true" />
        <p className="preview__label">Descripción</p>
        <p>
          Como cliente quiero transferir dinero de forma{" "}
          <mark className={`preview__mark${on(2)}`}>rápida</mark> y{" "}
          <mark className={`preview__mark${on(3)}`}>fácil</mark>
        </p>
        <p className="preview__label">Criterios de aceptación</p>
        <ul>
          <li>
            La transferencia debe ser{" "}
            <mark className={`preview__mark${on(2)}`}>rápida</mark>
          </li>
          <li>
            El sistema debe ser{" "}
            <mark className={`preview__mark${on(4)}`}>amigable</mark>
          </li>
        </ul>
      </div>

      <ul className="preview__findings">
        <li className={`preview__finding${on(5)}`}>
          <code className="mono">US-AMB-001</code>
          <span>Términos vagos: «rápida», «fácil», «amigable».</span>
          <Badge tone="warn">Mayor</Badge>
        </li>
        <li className={`preview__finding${on(5)}`}>
          <code className="mono">US-FMT-001</code>
          <span>A la historia le falta: beneficio.</span>
          <Badge tone="warn">Mayor</Badge>
        </li>
        <li className={`preview__finding${on(5)}`}>
          <code className="mono">US-AC-003</code>
          <span>Ningún criterio usa Dado/Cuando/Entonces.</span>
          <Badge tone="neutral">Menor</Badge>
        </li>
      </ul>

      <p className={`preview__score${on(6)}`}>
        <span className="preview__value gradient-text mono">{score}</span>
        <span className="score__max">/ 100</span>
        <Badge tone="danger">No lista</Badge>
        {animated ? (
          <button
            type="button"
            className="link-button preview__replay"
            onClick={() => {
              setStep(0);
              setRun((n) => n + 1);
            }}
          >
            Repetir el ejemplo
          </button>
        ) : null}
      </p>
    </figure>
  );
}
