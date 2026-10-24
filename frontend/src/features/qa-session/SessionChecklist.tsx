import type { ChecklistItem } from "../../api/client";
import { PHASES, PHASE_LABEL } from "./labels";

interface Props {
  items: ChecklistItem[];
  disabled: boolean;
  error: string;
  onToggle: (item: ChecklistItem, checked: boolean) => void;
}

export function SessionChecklist({ items, disabled, error, onToggle }: Props) {
  const done = items.filter((i) => i.checked).length;
  return (
    <section aria-labelledby="checklist-title" className="stack">
      <h2 id="checklist-title">Checklist</h2>
      <p className="hint">
        {done} de {items.length} ítems marcados
      </p>
      {PHASES.map((phase) => {
        const group = items.filter((item) => item.phase === phase);
        if (group.length === 0) return null;
        return (
          <fieldset key={phase} className="phase">
            <legend>{PHASE_LABEL[phase]}</legend>
            {group.map((item) => (
              <label key={item.id} className="check">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={disabled}
                  onChange={(e) => onToggle(item, e.target.checked)}
                />
                <span className="wrap">{item.text}</span>
              </label>
            ))}
          </fieldset>
        );
      })}
      {error ? (
        <p role="alert" className="field__error wrap">
          {error}
        </p>
      ) : null}
    </section>
  );
}
