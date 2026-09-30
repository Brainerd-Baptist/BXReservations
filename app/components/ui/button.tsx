"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

/**
 * The one button. Variants carry meaning, not decoration:
 *   primary   — the main action on a screen (teal fill, navy text: 5.7:1)
 *   secondary — an alternative action (glass, hairline)
 *   danger    — permanently destructive only
 *   ghost     — Cancel / Back / low-emphasis
 * Sizes keep at least a 44px tap target on touch screens.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

function classes(variant: ButtonVariant, size: ButtonSize, block?: boolean, extra?: string) {
  return ["bx-btn", `bx-btn--${variant}`, `bx-btn--${size}`, block ? "bx-btn--block" : "", extra ?? ""].filter(Boolean).join(" ");
}

function Spinner() {
  return (
    <svg className="bx-btn__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  loadingText,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingText?: string }) {
  return (
    <button
      type={type}
      className={classes(variant, size, block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={classes(variant, size, block, className)} {...rest}>
      {children}
    </Link>
  );
}
