import { useEffect, useRef, useState } from "react";
import type { ThemePref } from "../types";
import { useTheme } from "../hooks/useTheme";

const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: "system", label: "System", icon: "🖥" },
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
];

/** Fixed top-right System/Light/Dark picker, matching the CRM's appearance control. */
export function ThemeToggle() {
  const { pref, isDark, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <div ref={ref} className="fixed top-3 right-4 z-50">
      <button
        aria-label="Theme"
        title="Theme"
        onClick={() => setOpen((v) => !v)}
        className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-border bg-surface text-[15px] text-fg2 hover:bg-hover"
      >
        {isDark ? "☾" : "☀"}
      </button>
      {open && (
        <div className="absolute right-0 top-[42px] flex min-w-[150px] flex-col gap-0.5 rounded-[11px] border border-border bg-surface p-1.5 shadow-lg">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                setTheme(o.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] hover:bg-hover ${
                pref === o.value ? "font-semibold text-fg" : "text-fg2"
              }`}
            >
              <span>{o.icon}</span>
              {o.label}
              {pref === o.value && <span className="ml-auto text-brand">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
