/**
 * CreditWidget — current credit balance + recent burn rate.
 * Tray-rendered version uses the same data source via Tauri command.
 * @version v0.1
 */
import { useEffect, useState } from "react";

interface CreditState {
  balance: number | null;
  plan: string | null;
  burn_24h: number;
  burn_7d: number;
  fetched_at: string;
  error?: string | null;
}

export default function CreditWidget({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState<CreditState>({
    balance: null,
    plan: null,
    burn_24h: 0,
    burn_7d: 0,
    fetched_at: new Date().toISOString(),
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("http://127.0.0.1:8732/credits");
        if (!r.ok) throw new Error(`relay /credits ${r.status}`);
        const j = await r.json();
        if (!alive) return;
        setS({
          balance: j.balance ?? null,
          plan: j.plan ?? null,
          burn_24h: j.burn_24h ?? 0,
          burn_7d: j.burn_7d ?? 0,
          fetched_at: new Date().toISOString(),
          error: null,
        });
      } catch (e: any) {
        if (alive) setS((p) => ({ ...p, error: e?.message || String(e) }));
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const display = s.balance === null ? "—" : s.balance.toLocaleString();

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate2 bg-ink/60 px-4 py-3">
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wide text-muted">Credits</div>
          <div className="text-2xl font-bold mono text-cyan">{display}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted">Burn</div>
          <div className="text-sm">
            <span className="mono text-gold">{s.burn_24h}</span>
            <span className="text-muted text-xs"> / 24h</span>
          </div>
          <div className="text-sm">
            <span className="mono text-gold">{s.burn_7d}</span>
            <span className="text-muted text-xs"> / 7d</span>
          </div>
        </div>
        {s.plan && <span className="mono text-[10px] text-lime border border-lime/30 px-2 py-0.5 rounded">{s.plan}</span>}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-xl font-bold">Credits</h2>
      <div className="mt-4 text-5xl font-bold mono text-cyan">{display}</div>
      <div className="mt-2 text-muted text-sm">{s.plan ? `Plan: ${s.plan}` : "Plan unknown"}</div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Last 24h burn" value={s.burn_24h} />
        <Stat label="Last 7d burn" value={s.burn_7d} />
      </div>
      {s.error && <div className="mt-4 text-xs text-red-400 mono">{s.error}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate2 bg-ink/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl mono text-gold">{value.toLocaleString()}</div>
    </div>
  );
}
