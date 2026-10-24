import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../shared/ui/Button";
import { Icon } from "../shared/ui/Icon";

export type PaletteItem = {
  id: string;
  label: string;
  hint: string;
  to: string;
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function filterItems(
  items: PaletteItem[],
  query: string,
): PaletteItem[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;
  return items.filter((item) => {
    const haystack = normalize(`${item.label} ${item.hint}`);
    return terms.every((term) => haystack.includes(term));
  });
}

const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function CommandPalette({
  items,
  onClose,
}: {
  items: PaletteItem[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => filterItems(items, query), [items, query]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  // Al abrir, el foco pasa al campo; al cerrar vuelve a donde estaba.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    document
      .getElementById(`${listId}-opt-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, listId]);

  function choose(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (event.key === "Home" || event.key === "End") {
      if (event.target !== inputRef.current || results.length === 0) return;
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : results.length - 1);
    } else if (event.key === "Enter" && event.target === inputRef.current) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Tab") {
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const optionId = (index: number) => `${listId}-opt-${index}`;

  return (
    <div className="palette__backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette__head">
          <Icon name="search" />
          <input
            ref={inputRef}
            className="palette__input"
            role="combobox"
            aria-label="Buscar pantalla o proyecto"
            aria-expanded={results.length > 0}
            aria-controls={results.length ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              results.length ? optionId(activeIndex) : undefined
            }
            placeholder="Buscar pantalla o proyecto…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
          />
          <Button variant="ghost" onClick={onClose} aria-label="Cerrar paleta">
            <Icon name="close" />
          </Button>
        </div>
        {results.length > 0 ? (
          <ul
            id={listId}
            className="palette__list"
            role="listbox"
            aria-label="Resultados"
          >
            {results.map((item, index) => (
              <li
                key={item.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                className={`palette__option${index === activeIndex ? " is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
              >
                <span>{item.label}</span>
                <span className="palette__hint">{item.hint}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {results.length === 0 ? (
          <p className="palette__empty" role="status">
            Sin resultados para «{query}».
          </p>
        ) : null}
      </div>
    </div>
  );
}
