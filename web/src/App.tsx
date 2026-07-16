import { useCallback, useEffect, useState } from "react";
import { getSession } from "./lib/api";
import type { Session } from "./types";
import { ThemeToggle } from "./components/ThemeToggle";
import { Login } from "./components/Login";
import { ChatView } from "./components/ChatView";

/** Root: resolves session state, then shows Login or the chat experience. */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(() => {
    getSession()
      .then(setSession)
      .catch(() => setSession({ authed: false }));
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <>
      <ThemeToggle />
      {session === null ? (
        <div className="grid h-dvh place-items-center text-fg3">Loading…</div>
      ) : session.authed ? (
        <ChatView name={session.name || "there"} onSignedOut={() => setSession({ authed: false })} />
      ) : (
        <Login onAuthed={refresh} />
      )}
    </>
  );
}
