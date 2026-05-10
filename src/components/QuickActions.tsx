/**
 * QuickActions — five primary tasks rendered as one-click panels.
 * Each opens a modal that submits the corresponding MCP tool call
 * via the local relay and renders the response inline.
 * @version v0.1
 */
import { useState } from "react";
import { callTool, unwrapResult } from "../lib/mcp";

interface ActionDef {
  key: string;
  title: string;
  blurb: string;
  tool: string;
  costHint: string;
  fields: { name: string; label: string; required?: boolean; placeholder?: string; type?: "text" | "number" }[];
  buildArgs: (vals: Record<string, string>) => Record<string, any>;
}

const ACTIONS: ActionDef[] = [
  {
    key: "vet",
    title: "Vet someone",
    blurb: "Cached intent classifier picks the cheapest right tool — research / dossier / report.",
    tool: "clarify_research_intent",
    costHint: "FREE",
    fields: [
      { name: "target_name", label: "Person / company name", required: true, placeholder: "Sam Altman" },
      { name: "user_intent_hint", label: "What you want (optional)", placeholder: "vet for seed round" },
    ],
    buildArgs: (v) => ({
      target_name: v.target_name,
      user_intent_hint: v.user_intent_hint || undefined,
    }),
  },
  {
    key: "leads",
    title: "Find journalists",
    blurb: "Up to 20 reporters covering a topic — outlet, beat, recent article, contact hint.",
    tool: "find_journalists_covering",
    costHint: "10cr",
    fields: [
      { name: "topic", label: "Beat / topic", required: true, placeholder: "AI safety regulation" },
      { name: "days_back", label: "Days back (1-90)", type: "number", placeholder: "30" },
    ],
    buildArgs: (v) => ({
      topic: v.topic,
      days_back: v.days_back ? Number(v.days_back) : 30,
    }),
  },
  {
    key: "dossier",
    title: "Generate dossier",
    blurb: "Full multi-section dossier on a person — career, network, reputation, public writing.",
    tool: "get_dossier",
    costHint: "30cr cold · FREE on cache hit",
    fields: [
      { name: "name", label: "Person name", required: true, placeholder: "Dario Amodei" },
      { name: "company", label: "Company (disambiguator)", placeholder: "Anthropic" },
    ],
    buildArgs: (v) => ({
      name: v.name,
      company: v.company || undefined,
    }),
  },
  {
    key: "geo",
    title: "Run GEO audit",
    blurb: "Score how visible a brand is in AI answers across ChatGPT, Gemini, Claude, Perplexity.",
    tool: "run_geofixer_audit",
    costHint: "FREE on paid GEOFixer",
    fields: [
      { name: "brand_domain", label: "Brand domain", required: true, placeholder: "mentionfox.com" },
      { name: "scan_depth", label: "Depth (light/deep)", placeholder: "light" },
    ],
    buildArgs: (v) => ({
      brand_domain: v.brand_domain,
      scan_depth: (v.scan_depth as any) || "light",
    }),
  },
  {
    key: "compare",
    title: "Compare anyone",
    blurb: "Side-by-side comparison across 23 dimensions. 2-5 people. Reads cached deep enrichment.",
    tool: "compare_people",
    costHint: "5cr per cached profile",
    fields: [
      { name: "names", label: "Names (comma-separated)", required: true, placeholder: "Sam Altman, Dario Amodei" },
      { name: "context", label: "Context (optional)", placeholder: "investment targets" },
    ],
    buildArgs: (v) => ({
      people: (v.names || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name })),
      context: v.context || undefined,
    }),
  },
];

export default function QuickActions() {
  const [active, setActive] = useState<ActionDef | null>(null);
  return (
    <section>
      <h2 className="text-sm uppercase tracking-wide text-muted mb-3">Quick actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => setActive(a)}
            className="text-left rounded-lg border border-slate2 bg-ink/60 p-4 hover:border-cyan transition"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">{a.title}</div>
              <span className="mono text-[10px] text-gold">{a.costHint}</span>
            </div>
            <div className="text-muted text-xs mt-1.5">{a.blurb}</div>
          </button>
        ))}
      </div>
      {active && <ActionModal action={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function ActionModal({ action, onClose }: { action: ActionDef; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setErr(null);
    setOut("");
    try {
      const args = action.buildArgs(vals);
      const rpc = await callTool(action.tool, args);
      const { text, error } = unwrapResult(rpc);
      if (error) setErr(error);
      setOut(text);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-navy border border-slate2 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        <header className="px-5 py-3 border-b border-slate2 flex items-center">
          <div>
            <div className="font-bold">{action.title}</div>
            <div className="mono text-[11px] text-cyan">{action.tool}</div>
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="text-muted hover:text-white text-2xl leading-none">×</button>
        </header>
        <div className="p-5 space-y-3 overflow-auto">
          {action.fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">
                {f.label}
                {f.required && <span className="text-red-400"> *</span>}
              </label>
              <input
                type={f.type || "text"}
                placeholder={f.placeholder}
                value={vals[f.name] || ""}
                onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })}
                className="w-full bg-ink border border-slate2 rounded px-3 py-2 text-sm focus:border-cyan outline-none"
              />
            </div>
          ))}
          <div className="flex gap-2 items-center pt-2">
            <button
              onClick={run}
              disabled={running}
              className="px-4 py-2 rounded bg-cyan text-navy font-semibold text-sm disabled:opacity-50"
            >
              {running ? "Running..." : "Run"}
            </button>
            <span className="mono text-[10px] text-muted">{action.costHint}</span>
          </div>
          {(out || err) && (
            <div className="rounded border border-slate2 bg-ink/60 mt-3">
              <div className="px-3 py-2 border-b border-slate2 text-xs uppercase tracking-wide text-muted">
                {err ? "Error" : "Response"}
              </div>
              <pre className="mono text-[11px] p-3 overflow-auto whitespace-pre-wrap max-h-72">{err ?? out}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
