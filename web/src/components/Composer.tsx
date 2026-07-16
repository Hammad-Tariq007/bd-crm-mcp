import { useLayoutEffect, useRef, useState } from "react";

/** Bottom-pinned message composer: auto-growing textarea, Enter to send, Shift+Enter newline. */
export function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow to fit content, capped at 200px.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  };

  return (
    <div className="mx-auto w-full max-w-[768px] bg-gradient-to-t from-canvas from-[62%] to-transparent px-[22px] pt-3.5 pb-4">
      <div className="flex items-end gap-2 rounded-[18px] border border-border2 bg-surface py-2 pr-2 pl-4 shadow-sm focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/20">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about win rate, funnel, connects, velocity, forecast, or leads…"
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 leading-normal text-fg outline-none placeholder:text-placeholder"
        />
        <button
          aria-label="Send"
          title="Send"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] bg-brand text-[16px] text-on-brand hover:bg-brand-hover disabled:opacity-35"
        >
          ↑
        </button>
      </div>
      <div className="mt-2 text-center text-[11px] text-fg3">Enter to send · Shift+Enter for a new line</div>
    </div>
  );
}
