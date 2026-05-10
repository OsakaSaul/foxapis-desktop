/**
 * ActivityLog — live stream of MCP calls flowing through the local relay.
 * Subscribes to the Tauri event 'mcp-relay-event' emitted from
 * src-tauri/src/mcp_relay.rs whenever a /mcp request completes.
 * @version v0.1
 */
import { useEffect, useState } from "react";

interface RelayEvent {
  ts: string;
  tool: string | null;
  status: number;
  duration_ms: number;
  cached: boolean;
  error?: string | null;
  client?: string | null;
}

export default function ActivityLog() {
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [filter, setFilter] = useState("");
  const [tauriAvailable, setTauriAvailable] = useState(true);

  useEffect(() => {
    let unsub: undefined | (() => void);
    let cancelled = false;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const u = await listen<RelayEvent>("mcp-relay-event", (e) => {
          setEvents((prev) => [e.payload, ...prev].slice(0, 500));
        });
        if (cancelled) {
          u();
          return;
        }
        unsub = u;
      } catch {
        // Browser-only mode (`npm run dev` without Tauri) — fall back to polling /activity.
        setTauriAvailable(false);
        const t = setInterval(async () => {
          try {
            const r = await fetch("http://127.0.0.1:8732/activity");
            if (!r.ok) return;
            const j = await r.json();
            setEvents(Array.isArray(j) ? j : j?.events || []);
          } catch {
            // ignore
          }
        }, 2500);
        unsub = () => clearInterval(t);
      }
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const visible = events.filter((e) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      (e.tool || "").toLowerCase().includes(q) ||
      (e.client || "").toLowerCase().includes(q) ||
      (e.error || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Activity</h2>
        <span className="mono text-[10px] text-muted">
          {events.length} events · {tauriAvailable ? "live" : "polled (browser mode)"}
        </span>
        <div className="flex-1" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by tool / client / error..."
          className="w-72 bg-ink border border-slate2 rounded px-3 py-1.5 text-sm focus:border-cyan outline-none"
        />
      </header>

      {events.length === 0 ? (
        <div className="text-muted text-sm">
          No calls yet. Trigger one via the Tools tab or from any connected MCP client (Claude Desktop, Cursor, ...).
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-slate2">
            <tr>
              <th className="py-2">Time</th>
              <th>Tool</th>
              <th>Client</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Cache</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e, i) => (
              <tr key={i} className="border-b border-slate2/40 hover:bg-slate2/30">
                <td className="py-1.5 mono text-[11px] text-muted">{fmt(e.ts)}</td>
                <td className="mono text-cyan text-xs">{e.tool || "—"}</td>
                <td className="text-muted">{e.client || "—"}</td>
                <td className={e.status >= 200 && e.status < 300 ? "text-lime" : "text-red-400"}>{e.status}</td>
                <td className="mono text-[11px]">{e.duration_ms}ms</td>
                <td>{e.cached ? <span className="text-gold">HIT</span> : <span className="text-muted">miss</span>}</td>
                <td className="text-red-400 text-xs truncate max-w-[200px]">{e.error || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}
