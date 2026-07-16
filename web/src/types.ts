export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
  /** Tools the assistant invoked for this reply (assistant messages only). */
  tools?: string[];
  /** True when this assistant message is an error notice. */
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

/** Auth state exposed to the browser — never contains tokens or secrets. */
export interface Session {
  authed: boolean;
  name?: string;
}

export type ThemePref = "system" | "light" | "dark";
