import { useEffect, useRef, useState } from "react";
import { ApiError, logout, sendChat } from "../lib/api";
import { useChats } from "../hooks/useChats";
import { Sidebar } from "./Sidebar";
import { Composer } from "./Composer";
import { Welcome } from "./Welcome";
import { Message, PendingMessage } from "./Message";

const SIDEBAR_KEY = "bdmcp_sidebar";

interface ChatViewProps {
  name: string;
  onSignedOut: () => void;
}

/** The signed-in chat experience: sidebar + conversation thread + composer. */
export function ChatView({ name, onSignedOut }: ChatViewProps) {
  const { chats, active, activeId, startNew, open, remove, clear, append, appendTo } = useChats();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = active?.messages ?? [];
  const isEmpty = messages.length === 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  const setCollapse = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(SIDEBAR_KEY, v ? "collapsed" : "open");
    } catch {
      /* ignore */
    }
  };

  const send = async (text: string) => {
    if (pending) return;
    const history = active?.messages ?? [];
    const chatId = append({ role: "user", content: text });
    setPending(true);
    try {
      const res = await sendChat(text, history);
      appendTo(chatId, { role: "assistant", content: res.reply, tools: res.toolsUsed });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSignedOut();
        return;
      }
      const msg = err instanceof Error ? err.message : "Could not reach the server.";
      appendTo(chatId, { role: "assistant", content: `⚠ ${msg}`, error: true });
    } finally {
      setPending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    clear();
    onSignedOut();
  };

  return (
    <div className="relative flex h-dvh overflow-hidden">
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-20 bg-black/40 md:hidden" />
      )}

      <div
        className={`z-30 shrink-0 overflow-hidden max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[264px] max-md:shadow-2xl max-md:transition-transform max-md:duration-200 md:transition-[width] md:duration-200 ${
          drawerOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        } ${collapsed ? "md:w-0" : "md:w-[264px]"}`}
      >
        <Sidebar
          chats={chats}
          activeId={activeId}
          name={name}
          onNew={() => {
            startNew();
            setDrawerOpen(false);
          }}
          onOpen={(id) => {
            open(id);
            setDrawerOpen(false);
          }}
          onDelete={remove}
          onCollapse={() => (window.innerWidth < 768 ? setDrawerOpen(false) : setCollapse(true))}
          onLogout={handleLogout}
        />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col">
        {collapsed && (
          <button
            aria-label="Show sidebar"
            title="Show sidebar"
            onClick={() => setCollapse(false)}
            className="absolute top-3 left-3 z-10 hidden h-[34px] w-[34px] place-items-center rounded-[9px] border border-border bg-surface text-fg2 hover:bg-hover md:grid"
          >
            ☰
          </button>
        )}

        <div className="flex items-center gap-2.5 border-b border-border bg-surface px-3.5 py-2.5 md:hidden">
          <button aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="px-1.5 text-[20px] text-fg2">
            ☰
          </button>
          <span className="text-[14px] font-semibold">BD CRM Analytics</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[768px] px-[22px] pt-6 pb-[132px]">
            {isEmpty ? (
              <Welcome name={name} onPick={send} />
            ) : (
              messages.map((m) => <Message key={m.id} message={m} />)
            )}
            {pending && <PendingMessage />}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0">
          <Composer onSend={send} disabled={pending} />
        </div>
      </main>
    </div>
  );
}
