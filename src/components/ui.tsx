"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-5 ${className}`}>{children}</div>;
}

type Variant = "primary" | "secondary" | "ghost" | "accent";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/85",
  accent: "bg-accent text-white hover:bg-accent/90",
  secondary: "border border-line bg-white text-ink hover:bg-soft",
  ghost: "text-muted hover:text-ink",
};

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none transition placeholder:text-muted/70 focus:border-ink disabled:bg-soft ${props.className ?? ""}`}
    />
  );
}

/** ตัวเลขเหรียญ: วงกลมเล็ก + ตัวเลข */
export function Coins({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${className}`}>
      <span className="inline-block h-[0.7em] w-[0.7em] rounded-full border-[1.5px] border-current" aria-hidden />
      {value.toLocaleString("th-TH")}
    </span>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full border border-line object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-soft font-medium text-ink"
      aria-label={name}
    >
      {/* ข้ามสระหน้า (เ แ โ ใ ไ) → "เคนนี่" แสดง "ค" */}
      {[...name.replace(/^[เแโใไ]+/, "")][0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** แจ้งเตือนลอยด้านล่าง หายเองใน 3.5 วิ */
export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        role="alert"
        onClick={onClose}
        className="animate-rise pointer-events-auto max-w-sm rounded-xl bg-ink px-4 py-3 text-center text-sm text-white"
      >
        {message}
      </div>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted">{children}</h3>
      {right ? <span className="text-xs text-muted">{right}</span> : null}
    </div>
  );
}

// ------------------------------------------------------------------ icons
// ไอคอนเส้นบาง ๆ แบบเดียวกันทั้งเว็บ (ไม่ใช้ emoji)

type IconName = "back" | "plus" | "close" | "check" | "lock" | "pin" | "copy" | "share" | "logout" | "chevron";

const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 012-2h9" />
    </>
  ),
  share: <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" />,
  logout: <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
  chevron: <path d="M9 6l6 6-6 6" />,
};

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
