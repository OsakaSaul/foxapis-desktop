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
 * v0.2 (2026-05-10): ChatGPT card upgraded from "scaffold-only" to
 * actionable — surfaces the cloud MCP URL prominently, copy-to-clipboard,
 * 4-step custom GPT walkthrough, and a "Test in ChatGPT" button that
 * opens chat.openai.com/gpts/discovery via Tauri shell. No local file
 * is written for ChatGPT; the card is still scaffold-only in that
 * sense, but the user gets everything they need to wire ChatGPT to
 * MentionFox MCP without leaving the app.
 *
 * @version v0.2
 */
import { useEffect, useState } from "react";

const CLOUD_MCP_URL = "https://www.mentionfox.com/mcp";
const CLOUD_OPENAPI_URL = "https://www.mentionfox.com/mcp/openapi.json";
const CHATGPT_DISCOVERY_URL = "https://chat.openai.com/gpts/discovery";

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
    blurb: "Action-style integration via the cloud MCP endpoint and an OpenAPI spec — no local relay required.",
    paths: {},
    configShape: "gpt-custom",
    status: "scaffold",
    notes: "Cloud-only: chat.openai.com cannot reach localhost. Use the walkthrough below.",
  },
];

export default function ConnectorHub() {
  const [installState, setInstallState] = useState<Record<string, "idle" | "running" | "ok" | "err">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tauriAvailable, setTauriAvailable] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

  // Copy via the browser clipboard API — works inside Tauri's webview.
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch (e) {
      console.warn("clipboard write failed", e);
    }
  };

  // Open URL externally — Tauri shell plugin in production; fallback to
  // window.open in browser-dev mode (the webview will navigate inside
  // the app frame without the plugin, but dev users can copy manually).
  const openExternal = async (url: string) => {
    try {
      if (tauriAvailable) {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(url);
        return;
      }
    } catch (e) {
      console.warn("shell.open failed, falling back to window.open", e);
    }
    try { window.open(url, "_blank", "noopener"); } catch { /* ignore */ }
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
        {CONNECTORS.map((c) =>
          c.configShape === "gpt-custom" ? (
            <article
              key={c.key}
              className="md:col-span-2 rounded-lg border border-slate2 bg-ink/60 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <div className="font-semibold">{c.name}</div>
                <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-slate2 text-muted">CLOUD</span>
              </div>
              <p className="text-muted text-xs">{c.blurb}</p>

              {/* Cloud MCP URL — prominent + Copy */}
              <div className="rounded border border-cyan/40 bg-cyan/5 p-3 flex flex-col gap-2">
                <div className="text-[11px] mono text-muted uppercase tracking-wider">Cloud MCP URL</div>
                <div className="flex items-center gap-2">
                  <code className="mono text-sm text-cyan flex-1 select-all break-all">{CLOUD_MCP_URL}</code>
                  <button
                    onClick={() => copy("mcp-url", CLOUD_MCP_URL)}
                    className="px-2.5 py-1 rounded bg-cyan/20 hover:bg-cyan/30 text-cyan text-xs font-semibold"
                  >
                    {copied === "mcp-url" ? "Copied" : "Copy URL"}
                  </button>
                </div>
              </div>

              {/* OpenAPI spec URL — second prominent block */}
              <div className="rounded border border-slate2 bg-navy/40 p-3 flex flex-col gap-2">
                <div className="text-[11px] mono text-muted uppercase tracking-wider">OpenAPI 3.0 schema URL</div>
                <div className="flex items-center gap-2">
                  <code className="mono text-sm text-text flex-1 select-all break-all">{CLOUD_OPENAPI_URL}</code>
                  <button
                    onClick={() => copy("openapi-url", CLOUD_OPENAPI_URL)}
                    className="px-2.5 py-1 rounded bg-slate2 hover:bg-slate2/70 text-text text-xs font-semibold"
                  >
                    {copied === "openapi-url" ? "Copied" : "Copy URL"}
                  </button>
                </div>
              </div>

              {/* 4-step walkthrough */}
              <div className="text-xs">
                <div className="text-muted mono uppercase tracking-wider mb-2">Setup walkthrough</div>
                <ol className="list-decimal pl-5 space-y-1.5 text-text/90">
                  <li>
                    Create a custom GPT at{" "}
                    <a
                      onClick={(e) => { e.preventDefault(); openExternal("https://chat.openai.com/gpts/editor"); }}
                      href="https://chat.openai.com/gpts/editor"
                      className="text-cyan underline cursor-pointer"
                    >
                      chat.openai.com/gpts/editor
                    </a>{" "}
                    (My GPTs &rarr; Create).
                  </li>
                  <li>
                    In the Configure tab, scroll to <span className="mono">Actions</span> &rarr;{" "}
                    <span className="mono">Create new action</span>. Set Authentication to{" "}
                    <span className="mono">API Key</span>, type <span className="mono">Bearer</span>, and paste your
                    MentionFox bearer token.
                  </li>
                  <li>
                    Set the action server endpoint to the Cloud MCP URL above (
                    <span className="mono">{CLOUD_MCP_URL}</span>).
                  </li>
                  <li>
                    Click <span className="mono">Import from URL</span> on the schema box and paste the OpenAPI URL
                    above (<span className="mono">{CLOUD_OPENAPI_URL}</span>). All 23 MentionFox actions appear.
                  </li>
                </ol>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => openExternal(CHATGPT_DISCOVERY_URL)}
                  className="px-3 py-1.5 rounded bg-cyan text-navy text-xs font-semibold"
                >
                  Test in ChatGPT
                </button>
                <button
                  onClick={() => openExternal("https://www.mentionfox.com/connect")}
                  className="px-3 py-1.5 rounded bg-slate2 hover:bg-slate2/70 text-text text-xs font-semibold"
                >
                  Get bearer token
                </button>
                <button
                  onClick={() => openExternal("https://foxapis.com/integrations/chatgpt")}
                  className="px-3 py-1.5 rounded border border-slate2 text-text text-xs font-semibold hover:bg-slate2/30"
                >
                  Full walkthrough
                </button>
              </div>

              {c.notes && <div className="text-[11px] text-gold">{c.notes}</div>}
            </article>
          ) : (
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
          )
        )}
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
      return [
        "# ChatGPT custom GPT — cloud-only.",
        `# MCP endpoint:  ${CLOUD_MCP_URL}`,
        `# OpenAPI URL:   ${CLOUD_OPENAPI_URL}`,
        "# Auth: API Key + Bearer (paste your MentionFox bearer token).",
      ].join("\n");
  }
}
