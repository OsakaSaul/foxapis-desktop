/**
 * MCP client — talks to the local Tauri-hosted relay on localhost:8732.
 * @version v0.1
 *
 * The relay forwards calls to https://www.mentionfox.com/mcp with the
 * user's bearer token, and caches tool/list + dossier reads for offline.
 */
const RELAY = "http://127.0.0.1:8732";

export interface RelayHealth {
  ok: boolean;
  cloud_endpoint?: string;
  last_call_at?: string | null;
  cache_size?: number;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean };
}

export async function getRelayHealth(): Promise<RelayHealth> {
  const r = await fetch(`${RELAY}/health`);
  if (!r.ok) throw new Error(`relay /health ${r.status}`);
  return r.json();
}

export async function listTools(): Promise<ToolDef[]> {
  const r = await fetch(`${RELAY}/tools/list`);
  if (!r.ok) throw new Error(`relay /tools/list ${r.status}`);
  const j = await r.json();
  // Accepts either {tools:[...]} or raw array; relay returns the former.
  return (j?.tools ?? j) as ToolDef[];
}

export async function callTool(name: string, args: Record<string, any>): Promise<any> {
  const body = {
    jsonrpc: "2.0",
    id: cryptoId(),
    method: "tools/call",
    params: { name, arguments: args },
  };
  const r = await fetch(`${RELAY}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`relay /mcp ${r.status}: ${text}`);
  }
  return r.json();
}

/**
 * Extract the human-readable text payload from a JSON-RPC tools/call
 * response. The MentionFox MCP server wraps every result in
 * `result.content[].text` per spec — we unwrap here so callers can render.
 */
export function unwrapResult(rpc: any): { text: string; raw: any; error: string | null } {
  if (!rpc) return { text: "", raw: null, error: "empty response" };
  if (rpc.error) {
    return { text: "", raw: rpc, error: rpc.error.message || JSON.stringify(rpc.error) };
  }
  const content = rpc?.result?.content;
  if (Array.isArray(content) && content[0]?.text) {
    return { text: content.map((c: any) => c.text || "").join("\n"), raw: rpc, error: null };
  }
  return { text: JSON.stringify(rpc.result ?? rpc, null, 2), raw: rpc, error: null };
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
