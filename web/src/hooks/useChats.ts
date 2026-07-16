import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, Conversation } from "../types";

const STORAGE_KEY = "bdmcp_chats_v1";

function load(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Conversation history persisted to localStorage (transcripts only — no secrets). */
export function useChats() {
  const [chats, setChats] = useState<Conversation[]>(load);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      /* ignore quota errors */
    }
  }, [chats]);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const ordered = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const startNew = useCallback(() => setActiveId(null), []);
  const open = useCallback((id: string) => setActiveId(id), []);

  const remove = useCallback(
    (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
    },
    []
  );

  /** Append a message to the active chat (creating one on the first user message). */
  const append = useCallback(
    (message: ChatMessage): string => {
      let id = activeId;
      setChats((prev) => {
        const now = Date.now();
        if (id && prev.some((c) => c.id === id)) {
          return prev.map((c) =>
            c.id === id ? { ...c, messages: [...c.messages, message], updatedAt: now } : c
          );
        }
        id = newId();
        const title = message.role === "user" ? message.content.slice(0, 60) : "New chat";
        return [...prev, { id, title, messages: [message], updatedAt: now }];
      });
      if (id !== activeId) setActiveId(id);
      return id as string;
    },
    [activeId]
  );

  /** Append to a specific chat by id (used for the async assistant reply). */
  const appendTo = useCallback((chatId: string, message: ChatMessage) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() } : c
      )
    );
  }, []);

  return { chats: ordered, active, activeId, startNew, open, remove, append, appendTo };
}
