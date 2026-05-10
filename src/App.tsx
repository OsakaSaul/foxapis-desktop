/**
 * FoxAPIs Desktop — App shell.
 * @version v0.1
 *
 * Six top-level surfaces:
 *   Home         — quick actions (5 buttons, modal-driven)
 *   Catalog      — full MCP tool list, "Try it" sandbox
 *   Activity     — live MCP call log streamed from Tauri
 *   Connectors   — one-click writers for Claude Desktop / Cursor / etc.
 *   Settings     — bearer token, auto-launch, offline mode, account
 *   (tray)       — credit-balance widget rendered into the system tray
 */
import { useEffect, useState } from "react";
import ToolCatalog from "./components/ToolCatalog";
import ActivityLog from "./components/ActivityLog";
import QuickActions from "./components/QuickActions";
import ConnectorHub from "./components/ConnectorHub";
import CreditWidget from "./components/CreditWidget";
import Settings from "./components/Settings";
import { getRelayHealth } from "./lib/mcp";

type Tab = "home" | "catalog" | "activity" | "connectors" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [relayUp, setRelayUp] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const ping = async () => {
      try {
        const h = await getRelayHealth();
        if (mounted) setRelayUp(!!h.ok);
      } catch {
        if (mounted) setRelayUp(false);
      }
    };
    ping();
    const t = setInterval(ping, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-navy text-white" data-foxchat-id="foxapis-desktop-v0.1">
      <Header tab={tab} setTab={setTab} relayUp={relayUp} />
      <main className="flex-1 overflow-auto">
        {tab === "home" && (
          <div className="max-w-5xl mx-auto p-6 space-y-8">
            <Hero />
            <QuickActions />
            <CreditWidget compact />
          </div>
        )}
        {tab === "catalog" && <ToolCatalog />}
        {tab === "activity" && <ActivityLog />}
        {tab === "connectors" && <ConnectorHub />}
        {tab === "settings" && <Settings />}
      </main>
      <footer className="border-t border-slate2 px-4 py-2 flex items-center justify-between text-[11px] text-muted">
        <span className="mono">localhost:8732/mcp</span>
        <span className="mono">FoxAPIs Desktop v0.1</span>
      </footer>
    </div>
  );
}

function Header({ tab, setTab, relayUp }: { tab: Tab; setTab: (t: Tab) => void; relayUp: boolean | null }) {
  const tabs: { k: Tab; label: string }[] = [
    { k: "home", label: "Home" },
    { k: "catalog", label: "Tools" },
    { k: "activity", label: "Activity" },
    { k: "connectors", label: "Connectors" },
    { k: "settings", label: "Settings" },
  ];
  return (
    <header className="border-b border-slate2 bg-ink/80 backdrop-blur px-4 py-3 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-cyan font-bold tracking-tight text-lg">Fox</span>
        <span className="text-white font-bold tracking-tight text-lg">APIs</span>
        <span className="ml-2 mono text-[10px] uppercase text-muted">Desktop</span>
      </div>
      <nav className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-3 py-1.5 text-sm rounded ${
              tab === t.k ? "bg-slate2 text-cyan" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-2 mono text-[11px]">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            relayUp === null ? "bg-yellow-500" : relayUp ? "bg-lime" : "bg-red-500"
          }`}
          aria-label={relayUp ? "relay up" : "relay down"}
        />
        <span className="text-muted">
          {relayUp === null ? "checking..." : relayUp ? "relay live" : "relay offline"}
        </span>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="rounded-xl border border-slate2 bg-ink/60 p-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Your local <span className="text-cyan">agentic workspace</span>.
      </h1>
      <p className="text-muted mt-2 max-w-2xl">
        FoxAPIs Desktop runs a local MCP relay on{" "}
        <span className="mono text-cyan">localhost:8732/mcp</span> and proxies every call to MentionFox in the cloud
        with your bearer token. Connect once here — every local LLM client (Claude Desktop, Cursor, Continue, Goose,
        n8n, LibreChat) talks to one URL and gets the same 18 tools.
      </p>
    </section>
  );
}
