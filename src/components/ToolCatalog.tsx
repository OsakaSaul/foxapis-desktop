/**
 * ToolCatalog — fetches the MCP tools/list from the local relay and
 * renders a browsable, "Try it" sandbox for each tool.
 * @version v0.1
 */
import { useEffect, useMemo, useState } from "react";
import { callTool, listTools, ToolDef, unwrapResult } from "../lib/mcp";

export default function ToolCatalog() {
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<ToolDef | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await listTools();
        if (!alive) return;
        setTools(t);
        setSelected(t[0] || null);
      } catch (e: any) {
        if (alive) setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.annotations?.title?.toLowerCase().includes(q)
    );
  }, [tools, filter]);

  return (
    <div className="grid grid-cols-12 h-full">
      <aside className="col-span-4 border-r border-slate2 overflow-auto">
        <div className="p-3 sticky top-0 bg-navy z-10 border-b border-slate2">
          <input
            type="text"
            placeholder="Filter tools..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-ink border border-slate2 rounded px-3 py-2 text-sm focus:border-cyan outline-none"
          />
          <div className="mt-2 text-[11px] text-muted mono">
            {tools.length} tools · localhost:8732
          </div>
        </div>
        {loading && <div className="p-4 text-muted text-sm">Loading tools...</div>}
        {err && (
          <div className="p-4 text-sm text-red-400">
            <div>Failed to reach relay.</div>
            <div className="mono text-[10px] mt-1">{err}</div>
            <div className="mt-2 text-muted text-[11px]">
              Check that the Tauri shell is running and the bearer token is set in Settings.
            </div>
          </div>
        )}
        <ul>
          {filtered.map((t) => (
            <li key={t.name}>
              <button
                onClick={() => setSelected(t)}
                className={`w-full text-left px-3 py-2 border-b border-slate2/60 hover:bg-slate2/40 ${
                  selected?.name === t.name ? "bg-slate2/60" : ""
                }`}
              >
                <div className="text-sm font-medium">{t.annotations?.title || t.name}</div>
                <div className="mono text-[10px] text-cyan">{t.name}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="col-span-8 overflow-auto">
        {selected ? <ToolDetail tool={selected} /> : <div className="p-6 text-muted">Pick a tool.</div>}
      </section>
    </div>
  );
}

function ToolDetail({ tool }: { tool: ToolDef }) {
  const [args, setArgs] = useState<string>(() => buildSampleArgs(tool));
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<string>("");
  const [outErr, setOutErr] = useState<string | null>(null);

  useEffect(() => {
    setArgs(buildSampleArgs(tool));
    setOut("");
    setOutErr(null);
  }, [tool.name]);

  const run = async () => {
    setRunning(true);
    setOut("");
    setOutErr(null);
    try {
      const parsed = args.trim() ? JSON.parse(args) : {};
      const rpc = await callTool(tool.name, parsed);
      const { text, error } = unwrapResult(rpc);
      if (error) setOutErr(error);
      setOut(text || JSON.stringify(rpc, null, 2));
    } catch (e: any) {
      setOutErr(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <header>
        <h2 className="text-xl font-bold">{tool.annotations?.title || tool.name}</h2>
        <div className="mono text-cyan text-xs mt-1">{tool.name}</div>
      </header>
      <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{tool.description}</p>

      <details open className="rounded border border-slate2 bg-ink/60">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Input schema</summary>
        <pre className="mono text-[11px] p-3 overflow-auto">{JSON.stringify(tool.inputSchema || {}, null, 2)}</pre>
      </details>

      <div>
        <label className="text-xs uppercase tracking-wide text-muted block mb-1">Try it — arguments JSON</label>
        <textarea
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          rows={6}
          className="w-full bg-ink border border-slate2 rounded p-3 mono text-xs focus:border-cyan outline-none"
        />
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 rounded bg-cyan text-navy font-semibold text-sm disabled:opacity-50"
        >
          {running ? "Running..." : "Run tool"}
        </button>
        <span className="mono text-[10px] text-muted">
          POST localhost:8732/mcp · tools/call · {tool.name}
        </span>
      </div>

      {(out || outErr) && (
        <div className="rounded border border-slate2 bg-ink/60">
          <div className="px-3 py-2 border-b border-slate2 text-xs uppercase tracking-wide text-muted">
            {outErr ? "Error" : "Response"}
          </div>
          <pre className="mono text-[11px] p-3 overflow-auto whitespace-pre-wrap max-h-96">
            {outErr ?? out}
          </pre>
        </div>
      )}
    </div>
  );
}

/** Build a minimal valid JSON example payload from the tool's inputSchema. */
function buildSampleArgs(tool: ToolDef): string {
  const schema = tool.inputSchema;
  if (!schema || schema.type !== "object" || !schema.properties) return "{}";
  const out: Record<string, any> = {};
  for (const k of Object.keys(schema.properties)) {
    const p = schema.properties[k];
    if (p.default !== undefined) out[k] = p.default;
    else if (p.type === "string") out[k] = "";
    else if (p.type === "integer" || p.type === "number") out[k] = p.minimum ?? 0;
    else if (p.type === "boolean") out[k] = false;
    else if (p.type === "array") out[k] = [];
    else if (p.type === "object") out[k] = {};
  }
  // For "Try it" panel, only seed required fields populated, blank otherwise.
  return JSON.stringify(out, null, 2);
}
