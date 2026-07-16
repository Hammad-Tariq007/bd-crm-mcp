import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";

function Avatar() {
  return (
    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand text-[13px] font-bold text-on-brand">
      ✳
    </div>
  );
}

/** A single turn: user messages as a right-aligned bubble, assistant as a contained card. */
export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end py-2.5">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-brand-subtle px-4 py-2.5 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-2.5">
      <Avatar />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
          <div className={`text-[14px] leading-relaxed ${message.error ? "text-danger" : ""}`}>
            <Markdown>{message.content}</Markdown>
          </div>
          {message.tools && message.tools.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5 text-[11px] text-fg3">
              <span>Used</span>
              {message.tools.map((t) => (
                <span key={t} className="rounded-full bg-surface2 px-2 py-0.5 font-mono text-fg2">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Animated "thinking" placeholder shown while awaiting a reply. */
export function PendingMessage() {
  return (
    <div className="flex gap-3 py-2.5">
      <Avatar />
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface px-4 py-4 shadow-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg3"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
