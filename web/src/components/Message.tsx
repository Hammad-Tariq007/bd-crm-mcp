import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";

/** A single turn: user messages as a right-aligned bubble, assistant as full-width markdown. */
export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end py-2.5">
        <div className="max-w-[82%] rounded-[16px] rounded-br-[4px] bg-brand-subtle px-[15px] py-2.5 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-2.5">
      <div className="mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md bg-brand text-[12px] font-bold text-on-brand">
        ✳
      </div>
      <div className={`min-w-0 flex-1 ${message.error ? "text-danger" : ""}`}>
        <Markdown>{message.content}</Markdown>
        {message.tools && message.tools.length > 0 && (
          <div className="mt-2 border-t border-border pt-1.5 text-[11px] text-fg3">
            Used: {message.tools.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

/** Animated "thinking" placeholder shown while awaiting a reply. */
export function PendingMessage() {
  return (
    <div className="flex gap-3 py-2.5">
      <div className="mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md bg-brand text-[12px] font-bold text-on-brand">
        ✳
      </div>
      <div className="flex items-center gap-1 py-2">
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
