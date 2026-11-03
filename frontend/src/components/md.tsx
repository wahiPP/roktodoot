"use client";

/**
 * Material Design 3 building blocks: buttons, FAB, cards, text fields, chips,
 * switch, list items, progress and snackbar. Styled with the M3 tokens in
 * tailwind.config.ts and globals.css.
 */

import Link from "next/link";
import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./Icon";

// ---------------------------------------------------------------- buttons

type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated" | "success";

const BUTTON: Record<ButtonVariant, string> = {
  filled: "bg-primary text-on-primary hover:shadow-elev-1",
  tonal: "bg-secondary-container text-on-secondary-container hover:shadow-elev-1",
  outlined: "border border-outline text-primary",
  text: "text-primary px-3",
  elevated: "bg-surface-container-low text-primary shadow-elev-1 hover:shadow-elev-2",
  success: "bg-success text-on-success hover:shadow-elev-1",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: IconName;
  size?: "md" | "lg";
  href?: string;
  full?: boolean;
}

export function Button({ variant = "filled", icon, size = "md", href, full, className = "", children, ...rest }: ButtonProps) {
  const cls = `state-layer inline-flex items-center justify-center gap-2 rounded-full font-medium transition-shadow duration-200
    disabled:pointer-events-none disabled:bg-on-surface/[0.12] disabled:text-on-surface/[0.38] disabled:shadow-none disabled:border-on-surface/[0.12]
    ${size === "lg" ? "h-14 px-8 text-title-m" : "h-10 px-6 text-label-l"} ${variant === "text" ? "" : ""} ${full ? "w-full" : ""}
    ${BUTTON[variant]} ${icon && variant !== "text" ? (size === "lg" ? "pl-6" : "pl-4") : ""} ${className}`;
  const content = (
    <>
      {icon && <Icon name={icon} size={size === "lg" ? 24 : 18} />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {content}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  ...rest
}: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button aria-label={label} title={label} className={`state-layer grid h-10 w-10 place-items-center rounded-full text-on-surface-variant ${className}`} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

/** Extended floating action button. */
export function Fab({ icon, label, href }: { icon: IconName; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="state-layer fixed bottom-24 right-4 z-30 inline-flex h-14 items-center gap-3 rounded-lg bg-primary-container pl-4 pr-5 text-label-l text-on-primary-container shadow-elev-3 md:bottom-6 md:right-6"
    >
      <Icon name={icon} />
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------- cards

type CardVariant = "elevated" | "filled" | "outlined";
const CARD: Record<CardVariant, string> = {
  elevated: "bg-surface-container-low shadow-elev-1",
  filled: "bg-surface-container-highest",
  outlined: "border border-outline-variant bg-surface",
};

export function Card({ variant = "filled", className = "", children }: { variant?: CardVariant; className?: string; children: ReactNode }) {
  // A custom background in className replaces the variant's default one.
  const base = /(^|\s)bg-/.test(className) ? CARD[variant].replace(/(^|\s)bg-\S+/g, "") : CARD[variant];
  return <div className={`rounded-md ${base} ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------- text fields

interface FieldBase {
  label: string;
  supporting?: string;
  error?: string | false;
  leadingIcon?: IconName;
  /** Background behind the floating label; must match what the field sits on. */
  labelBg?: string;
}

function fieldClasses(error?: string | false, leading?: boolean) {
  return `peer block w-full rounded-xs border bg-transparent text-body-l text-on-surface outline-none transition-colors
    placeholder:text-transparent focus:placeholder:text-on-surface-variant/60
    ${leading ? "pl-12" : "pl-4"} pr-4
    ${error ? "border-error focus:border-error focus:shadow-[inset_0_0_0_1px_rgb(var(--md-error))]" : "border-outline hover:border-on-surface focus:border-primary focus:shadow-[inset_0_0_0_1px_rgb(var(--md-primary))]"}`;
}

function FloatingLabel({ htmlFor, label, error, leading, always, labelBg, multiline }: {
  htmlFor: string; label: string; error?: string | false; leading?: boolean; always?: boolean; labelBg: string; multiline?: boolean;
}) {
  const floated = "top-0 -translate-y-1/2 text-body-s";
  const resting = multiline ? "top-4 text-body-l" : "top-1/2 -translate-y-1/2 text-body-l";
  return (
    <label
      htmlFor={htmlFor}
      className={`pointer-events-none absolute px-1 transition-all duration-150 ease-emphasized ${labelBg}
        ${leading && !always ? "left-11" : "left-3"}
        ${always ? floated : `${resting} peer-focus:left-3 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-body-s peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-body-s`}
        ${error ? "text-error" : "text-on-surface-variant peer-focus:text-primary"}`}
    >
      {label}
    </label>
  );
}

function Supporting({ text, error }: { text?: string; error?: string | false }) {
  if (!text && !error) return null;
  return <p className={`mt-1 px-4 text-body-s ${error ? "text-error" : "text-on-surface-variant"}`}>{error || text}</p>;
}

export function TextField({ label, supporting, error, leadingIcon, labelBg = "bg-surface", className = "", id, ...rest }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id || auto;
  const always = rest.type === "date" || rest.type === "datetime-local";
  return (
    <div className={className}>
      <div className="relative">
        {leadingIcon && <Icon name={leadingIcon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />}
        <input id={fid} placeholder={rest.placeholder ?? " "} className={`${fieldClasses(error, !!leadingIcon)} h-14`} {...rest} />
        <FloatingLabel htmlFor={fid} label={label} error={error} leading={!!leadingIcon} always={always || !!rest.placeholder?.trim()} labelBg={labelBg} />
      </div>
      <Supporting text={supporting} error={error} />
    </div>
  );
}

export function TextArea({ label, supporting, error, labelBg = "bg-surface", className = "", id, ...rest }: FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={className}>
      <div className="relative">
        <textarea id={fid} placeholder={rest.placeholder ?? " "} className={`${fieldClasses(error)} resize-none py-4`} {...rest} />
        <FloatingLabel htmlFor={fid} label={label} error={error} labelBg={labelBg} multiline />
      </div>
      <Supporting text={supporting} error={error} />
    </div>
  );
}

export function SelectField({ label, supporting, error, labelBg = "bg-surface", className = "", id, children, ...rest }: FieldBase & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={className}>
      <div className="relative">
        <select id={fid} className={`${fieldClasses(error)} h-14 appearance-none pr-10`} {...rest}>
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 text-on-surface-variant" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
          <path d="M480-360 280-560h400L480-360Z" />
        </svg>
        <FloatingLabel htmlFor={fid} label={label} error={error} always labelBg={labelBg} />
      </div>
      <Supporting text={supporting} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------- chips

export function Chip({
  children,
  selected,
  icon,
  onClick,
  className = "",
}: {
  children: ReactNode;
  selected?: boolean;
  icon?: IconName;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`state-layer inline-flex h-8 max-w-full items-center gap-2 rounded-sm px-3 text-label-l ${
        selected ? "bg-secondary-container text-on-secondary-container" : "border border-outline-variant text-on-surface-variant"
      } ${icon || selected ? "pl-2" : ""} ${className}`}
    >
      {selected ? <Icon name="check" size={18} /> : icon ? <Icon name={icon} size={18} className="text-primary" /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------- switch

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full border-2 transition-colors duration-200 ${
        checked ? "border-primary bg-primary" : "border-outline bg-surface-container-highest"
      }`}
    >
      <span
        className={`absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full transition-all duration-200 ease-emphasized ${
          checked ? "left-[22px] h-6 w-6 bg-on-primary text-primary" : "left-1.5 h-4 w-4 bg-outline"
        }`}
      >
        {checked && <Icon name="check" size={16} />}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- lists

export function ListItem({
  leading,
  headline,
  supporting,
  trailing,
  href,
  onClick,
}: {
  leading?: ReactNode;
  headline: ReactNode;
  supporting?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-l text-on-surface">{headline}</span>
        {supporting && <span className="block text-body-m text-on-surface-variant">{supporting}</span>}
      </span>
      {trailing && <span className="shrink-0 text-label-s text-on-surface-variant">{trailing}</span>}
    </>
  );
  const cls = "flex min-h-[72px] items-center gap-4 px-4 py-3 text-left";
  if (href)
    return (
      <Link href={href} onClick={onClick} className={`state-layer ${cls}`}>
        {inner}
      </Link>
    );
  return <div className={cls}>{inner}</div>;
}

// ---------------------------------------------------------------- progress

export function LinearProgress({ value, className = "", tone = "primary" }: { value?: number; className?: string; tone?: "primary" | "success" }) {
  const bar = tone === "success" ? "bg-success" : "bg-primary";
  const track = tone === "success" ? "bg-success-container" : "bg-primary-container";
  return (
    <div className={`relative h-1 overflow-hidden rounded-full ${track} ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`absolute inset-y-0 left-0 rounded-full ${bar} transition-[width] duration-1000 ease-linear`} style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- snackbar

export function Snackbar({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-2 rounded-xs bg-inverse-surface py-1 pl-4 pr-1 text-body-m text-inverse-on-surface shadow-elev-3 md:bottom-6"
    >
      <span className="flex-1 py-2.5">{message}</span>
      <button onClick={onClose} aria-label="Dismiss" className="state-layer grid h-10 w-10 place-items-center rounded-full">
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- page header

export function PageTitle({ children, supporting }: { children: ReactNode; supporting?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-headline-m text-on-surface">{children}</h1>
      {supporting && <p className="mt-1 text-body-l text-on-surface-variant">{supporting}</p>}
    </div>
  );
}
