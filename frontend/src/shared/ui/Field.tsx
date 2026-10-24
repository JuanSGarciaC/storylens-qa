import { Children, cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

type Props = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<Record<string, unknown>>;
};

export function Field({ label, hint, error, children }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const child: ReactNode = Children.only(children);
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {isValidElement<Record<string, unknown>>(child)
        ? cloneElement(child, {
            id,
            "aria-describedby": describedBy || undefined,
            "aria-invalid": error ? true : undefined,
          })
        : child}
      {hint ? (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field__error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
