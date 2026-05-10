/**
 * Settings — bearer token management, auto-launch toggle, offline mode.
 * Account switcher is a v0.1 placeholder (single-account only).
 * @version v0.1
 */
import { useEffect, useState } from "react";
import { clearToken, getToken, pushTokenToRelay, setToken } from "../lib/auth";

export default function Settings() {
  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [savingTok, setSavingTok] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      setHasToken(!!t);
      setTokenInput(t ? maskToken(t) : "");
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        setAutoLaunch(await isEnabled());
      } catch {
        // browser-dev mode: leave as default
      }
    })();
  }, []);

  const onSaveToken = async () => {
    if (!tokenInput || tokenInput.includes("•")) return;
    setSavingTok(true);
    try {
      await setToken(tokenInput.trim());
      await pushTokenToRelay(tokenInput.trim());
      setHasToken(true);
      setTokenInput(maskToken(tokenInput.trim()));
      setSavedNote("Token saved + pushed to relay.");
    } finally {
      setSavingTok(false);
    }
  };
  const onClearToken = async () => {
    await clearToken();
    setTokenInput("");
    setHasToken(false);
    setSavedNote("Token cleared.");
  };

  const onAutoLaunchToggle = async () => {
    try {
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      if (autoLaunch) await disable();
      else await enable();
      setAutoLaunch(!autoLaunch);
    } catch (e) {
      console.warn("autostart toggle failed", e);
    }
  };

  const onOfflineToggle = async () => {
    const next = !offlineMode;
    setOfflineMode(next);
    try {
      await fetch("http://127.0.0.1:8732/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offline_mode: next }),
      });
    } catch {
      // relay may not be up
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>

      <Section title="Bearer token" hint="From mentionfox.com → Settings → MCP. Stored in OS keyring.">
        <div className="flex gap-2">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="mfx_live_..."
            className="flex-1 bg-ink border border-slate2 rounded px-3 py-2 text-sm mono focus:border-cyan outline-none"
          />
          <button
            onClick={onSaveToken}
            disabled={savingTok || !tokenInput || tokenInput.includes("•")}
            className="px-3 py-2 rounded bg-cyan text-navy font-semibold text-sm disabled:opacity-50"
          >
            Save
          </button>
          {hasToken && (
            <button onClick={onClearToken} className="px-3 py-2 rounded border border-slate2 text-sm">
              Clear
            </button>
          )}
        </div>
        {savedNote && <div className="text-xs text-lime mt-2">{savedNote}</div>}
      </Section>

      <Section title="Auto-launch" hint="Start FoxAPIs Desktop on login.">
        <Toggle on={autoLaunch} onChange={onAutoLaunchToggle} label={autoLaunch ? "Enabled" : "Disabled"} />
      </Section>

      <Section title="Offline mode" hint="Read cached dossiers / vetting reports without hitting the cloud.">
        <Toggle on={offlineMode} onChange={onOfflineToggle} label={offlineMode ? "On" : "Off"} />
        <div className="text-[11px] text-muted mt-2">
          v0.1 ships read-only offline. Writes are queued and replay when online — TODO.
        </div>
      </Section>

      <Section title="Account" hint="Multi-account switcher coming in v0.2 — TODO.">
        <div className="text-sm text-muted">Single account, single tenant. Switcher is a v0.2 scaffold.</div>
      </Section>

      <Section title="Diagnostics" hint="">
        <div className="space-y-1 mono text-xs">
          <div>Relay: <span className="text-cyan">http://127.0.0.1:8732</span></div>
          <div>Cloud: <span className="text-cyan">https://www.mentionfox.com/mcp</span></div>
          <div>Version: <span className="text-cyan">v0.1</span></div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate2 bg-ink/60 p-4">
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className={`flex items-center gap-3 px-3 py-1.5 rounded border ${
        on ? "border-lime bg-lime/10 text-lime" : "border-slate2 text-muted"
      }`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${on ? "bg-lime" : "bg-muted"}`} />
      <span className="text-sm">{label}</span>
    </button>
  );
}

function maskToken(t: string): string {
  if (t.length <= 10) return t;
  return t.slice(0, 6) + "•".repeat(8) + t.slice(-4);
}
