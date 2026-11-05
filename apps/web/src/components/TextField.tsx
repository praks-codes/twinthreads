import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, ...props }: TextFieldProps) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="field__input" {...props} />
    </label>
  );
}
