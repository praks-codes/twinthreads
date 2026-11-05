import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const className =
    variant === "secondary" ? "button button--secondary" : "button";
  return <button type={type} className={className} {...props} />;
}
