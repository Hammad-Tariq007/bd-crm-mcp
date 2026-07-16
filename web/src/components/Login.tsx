import { useState } from "react";
import { ApiError, login } from "../lib/api";

/** Token-paste login. On success the server sets the session cookie; we notify the parent. */
export function Login({ onAuthed }: { onAuthed: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(token);
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
      setToken("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[440px] px-5 pt-[12vh]">
      <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5 text-[15px] font-semibold">
          <span className="h-[9px] w-[9px] rounded-full bg-brand" /> BD CRM Analytics
        </div>
        <h2 className="mb-1.5 text-[19px] font-semibold">Sign in</h2>
        <p className="mb-5 text-[13px] text-fg3">
          Paste your <strong>own</strong> CRM personal access token. We use it once to confirm you're an
          analytics-authorized workspace admin, then discard it — it is never stored.
        </p>
        <form onSubmit={submit} autoComplete="off">
          <label htmlFor="tok" className="mb-1.5 block text-[13px] font-medium text-fg2">
            CRM personal token
          </label>
          <input
            id="tok"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="plane_api_…"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg border border-border2 bg-surface px-3 py-2.5 text-fg outline-none placeholder:text-placeholder focus:border-brand focus:ring-[3px] focus:ring-brand/20"
          />
          <p className="mt-2 text-[12px] leading-normal text-fg3">
            Profile → Settings → Personal access tokens in the CRM. Read-only; it only proves your admin access
            here.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="mt-[18px] w-full rounded-lg bg-brand py-2.5 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60"
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          {error && <div className="mt-3 text-[13px] text-danger">{error}</div>}
        </form>
      </div>
    </div>
  );
}
