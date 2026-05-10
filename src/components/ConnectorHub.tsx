/**
 * ConnectorHub — one-click setup for popular MCP clients.
 *
 * For each client we know:
 *   - a probe path (where the config lives by platform)
 *   - the JSON shape to write
 * The Tauri command `connector_install` takes care of detection +
 * read-modify-write. Browser-only mode shows the JSON snippet for
 * manual paste.
 *
 * @version v0.1
 */
import { useEffect, useState } from "react";

interface Connector {
  key: string;
  name: string;
  blurb: string;
  // Per-platform absolute config paths. {{HOME}} expanded by Tauri side.
  paths: { mac?: string; win?: string; linux?: string };
  // Shape the connector expects in its config file.
  configShape: "claude-desktop" | "cursor" | "continue" | "goose" | "n8n" | "librechat" | "openwebui" | "gpt-custom";
  status: "wired" | "scaffold";
  notes?: string;
}

const CONNECTORS: Connector[] = [
  {
    key: "claude-desktop",
    name: "Claude Desktop",
    blurb: "Anthropic's official desktop app — the canonical MCP client.",
    paths: {
      mac: "~/Library/Application Support/Claude/claude_desktop_config.json",
      win: "%APPDATA%/Claude/claude_desktop_config.json",
      linux: "~/.config/Claude/claude_desktop_config.json",
    },
    configShape: "claude-desktop",
    status: "wired",
  },
  {
    key: "cursor",
    name: "Cursor",
    blurb: "AI-first code editor with native MCP support.",
    paths: { mac: "~/.cursor/mcp.json", win: "%USERPROFILE%/.cursor/mcp.json", linux: "~/.cursor/mcp.json" },
    configShape: "cursor",
    status: "wired",
  },
  {
    key: "continue",
    name: "Continue.dev",
    blurb: "Open-source autocomplete + chat for VSCode/JetBrains.",
    paths: {
      mac: "~/.continue/config.json",
      win: "%USERPROFILE%/.continue/config.json",
      linux: "~/.continue/config.json",
    },
    configShape: "continue",
    status: "wired",
  },
  {
    key: "goose",
    name: "Goose",
    blurb: "Block's open-source on-machine AI agent.",
    paths: {
      mac: "~/.config/goose/config.yaml",
      win: "%APPDATA%/goose/config.yaml",
      linux: "~/.config/goose/config.yaml",
    },
    configShape: "goose",
    status: "scaffold",
    notes: "v0.1 writes a YAML stub; manual review recommended.",
  },
  {
    key: "n8n",
    name: "n8n",
    blurb: "Self-hosted workflow automation — point the MCP node at localhost:8732.",
    paths: {},
    configShape: "n8n",
    status: "scaffold",
    notes: "n8n stores credentials inside its DB; we render an instructional snippet only.",
  },
  {
    key: "librechat",
    name: "LibreChat",
    blurb: "Open-source ChatGPT clone with MCP support.",
    paths: {
      mac: "~/.config/LibreChat/librechat.yaml",
      win: "%APPDATA%/LibreChat/librechat.yaml",
      linux: "~/.config/LibreChat/librechat.yaml",
    },
    configShape: "librechat",
    status: "scaffold",
  },
  {
    key: "openwebui",
    name: "Open WebUI",
    blurb: "Self-hosted UI for local + remote LLMs.",
    paths: {},
    configShape: "openwebui",
    status: "scaffold",
    notes: "Open WebUI MCP support varies by version — render a manual-config snippet.",
  },
  {
    key: "gpt-custom",
    name: "ChatGPT Custom GPT",
    blurb: "Action-style integration. Requires a public tunnel — use the cloud endpoint instead of localhost.",
    paths: {},
    configShape: "gpt-custom",
    status: "scaffold",
    notes: "ChatGPT can't reach localhost — surface the cloud MCP URL https://www.mentionfox.com/mcp instead.",
  },
];

export default function ConnectorHub() {
  const [installState, setInstallState] = useState<Record<string, "idle" | "running" | "ok" | "err">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tauriAvailable, setTauriAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await import("@tauri-apps/api/core");
        setTauriAvailable(true);
      } catch {
        setTauriAvailable(false);
      }
    })();
  }, []);

  const install = async (c: Connector) => {
    setInstallState((s) => ({ ...s, [c.key]: "running" }));
    setErrors((e) => ({ ...e, [c.key]: "" }));
    try {
      if (!tauriAvailable) {
        throw new Error("Connector install requires the Tauri shell. In browser dev mode, copy the snippet manually.");
      }
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<string>("connector_install", { connector: c.key });
      setInstallState((s) => ({ ...s, [c.key]: "ok" }));
      console.log("connector install ok:", result);
    } catch (e: any) {
      setErrors((er) => ({ ...er, [c.key]: e?.message || String(e) }));
      setInstallState((s) => ({ ...s, [c.key]: "err" }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <header>
        <h2 className="text-xl font-bold">Connect your MCP clients</h2>
        <p className="text-muted text-sm mt-1">
          One bearer token, eight clients. The desktop app writes the right config file for each — review before save.
        </p>
      </header>
      {!tauriAvailable && (
        <div className="rounded border border-gold/40 bg-gold/10 text-gold text-sm p-3">
          Browser-dev mode: writers are disabled. Run from the Tauri shell to enable one-click install.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CONNECTORS.map((c) => (
          <article key={c.key} className="rounded-lg border border-slate2 bg-ink/60 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="font-semibold">{c.name}</div>
              <span
                className={`text-[10px] mono px-1.5 py-0.5 rounded ${
                  c.status === "wired" ? "bg-lime/20 text-lime" : "bg-slate2 text-muted"
                }`}
              >
                {c.status === "wired" ? "WIRED" : "SCAFFOLD"}
              </span>
            </div>
            <p className="text-muted text-xs">{c.blurb}</p>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">Config snippet</summary>
              <pre className="mono text-[10px] p-2 mt-2 bg-navy border border-slate2 rounded overflow-auto">
                {snippetFor(c)}
              </pre>
            </details>
            {c.notes && <div className="text-[11px] text-gold">{c.notes}</div>}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => install(c)}
                disabled={installState[c.key] === "running"}
                className="px-3 py-1.5 rounded bg-cyan text-navy text-xs font-semibold disabled:opacity-50"
              >
                {installState[c.key] === "running" ? "Writing..." : "Install"}
              </button>
              {installState[c.key] === "ok" && <span className="text-lime text-xs">Installed.</span>}
              {installState[c.key] === "err" && (
                <span className="text-red-400 text-xs">Failed: {errors[c.key]}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function snippetFor(c: Connector): string {
  const url = "http://127.0.0.1:8732/mcp";
  switch (c.configShape) {
    case "claude-desktop":
      return JSON.stringify(
        {
          mcpServers: {
            foxapis: {
              command: "node",
              args: ["-e", `require('http').get('${url}/health', () => process.exit(0))`],
              env: {},
            },
          },
        },
        null,
        2
      );
    case "cursor":
      return JSON.stringify({ mcpServers: { foxapis: { url } } }, null, 2);
    case "continue":
      return JSON.stringify(
        {
          experimental: { modelContextProtocolServers: [{ name: "foxapis", transport: { type: "http", url } }] },
        },
        null,
        2
      );
    case "goose":
      return [
        "extensions:",
        "  foxapis:",
        "    type: http",
        `    url: ${url}`,
        "    enabled: true",
      ].join("\n");
    case "n8n":
      return `# In n8n MCP node:\n# Server URL: ${url}\n# Auth: handled locally by FoxAPIs Desktop`;
    case "librechat":
      return `mcpServers:\n  foxapis:\n    type: http\n    url: ${url}`;
    case "openwebui":
      return `# Settings -> Tools -> MCP\n# URL: ${url}`;
    case "gpt-custom":
      return `# ChatGPT can't reach localhost.\n# Use the cloud endpoint:\nhttps://www.mentionfox.com/mcp`;
  }
}
