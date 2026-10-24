import type { ChecklistItem } from "../../api/client";
import { PHASES, PHASE_LABEL } from "./labels";

interface Props {
  items: ChecklistItem[];
  readOnly: boolean;
  busy: boolean;
  onToggle: (item: ChecklistItem, checked: boolean) => void;
}

export function ChecklistSection({ items, readOnly, busy, onToggle }: Props) {
  const done = items.filter((i) => i.checked).length;
  return (
    <section aria-labelledby="checklist-title">
      <h3 id="checklist-title">Checklist</h3>
      <p className="meta">
        {done} de {items.length} ítems marcados
      </p>
      {PHASES.map((phase) => (
        <fieldset key={phase} className="phase">
          <legend>{PHASE_LABEL[phase]}</legend>
          {items
            .filter((item) => item.phase === phase)
            .map((item) => (
              <label key={item.id} className="check">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={readOnly || busy}
                  onChange={(e) => onToggle(item, e.target.checked)}
                />
                <span>{item.text}</span>
              </label>
            ))}
        </fieldset>
      ))}
    </section>
  );
}
