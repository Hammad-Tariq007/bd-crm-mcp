import type { Conversation } from "../types";

interface SidebarProps {
  chats: Conversation[];
  activeId: string | null;
  name: string;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCollapse: () => void;
  onLogout: () => void;
}

/** Conversation sidebar: new chat, history list, collapse control, user footer. */
export function Sidebar({ chats, activeId, name, onNew, onOpen, onDelete, onCollapse, onLogout }: SidebarProps) {
  const initial = (name.trim()[0] || "U").toUpperCase();

  return (
    <aside className="flex min-w-0 flex-col overflow-hidden border-r border-border bg-sidebar">
      <div className="px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between gap-2 px-1 pb-3">
          <div className="flex items-center gap-2.5 text-[14.5px] font-semibold whitespace-nowrap">
            <span className="h-[9px] w-[9px] rounded-full bg-brand" /> BD CRM Analytics
          </div>
          <button
            aria-label="Hide sidebar"
            title="Hide sidebar"
            onClick={onCollapse}
            className="grid place-items-center rounded-lg px-2 py-1.5 text-[15px] text-fg3 hover:bg-hover hover:text-fg"
          >
            ‹
          </button>
        </div>
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2.5 rounded-[10px] border border-border2 bg-surface px-3 py-2.5 font-medium hover:bg-hover"
        >
          <span className="text-[16px] leading-none text-fg2">+</span> New chat
        </button>
      </div>

      <div className="px-3 pt-2.5 pb-1.5 text-[11px] tracking-wider text-fg3 uppercase">Chats</div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {chats.length === 0 ? (
          <div className="px-3 py-2 text-[12.5px] text-fg3">No conversations yet.</div>
        ) : (
          chats.map((c) => (
            <div
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 text-[13.5px] hover:bg-hover ${
                c.id === activeId ? "bg-hover text-fg" : "text-fg2"
              }`}
            >
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{c.title || "New chat"}</span>
              <button
                aria-label="Delete conversation"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="rounded px-1 text-[13px] text-fg3 opacity-0 group-hover:opacity-75 hover:bg-surface2 hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2.5 border-t border-border px-3.5 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-semibold text-on-brand">
          {initial}
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-fg2">{name}</span>
        <button
          onClick={onLogout}
          className="rounded-[7px] border border-border2 bg-surface px-2.5 py-1.5 text-[12.5px] text-fg2 hover:bg-hover"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
