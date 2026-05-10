// Local MCP relay — proxies JSON-RPC 2.0 requests to MentionFox cloud.
// @version v0.1
//
// Endpoints:
//   POST /mcp           proxy JSON-RPC 2.0 to https://www.mentionfox.com/mcp
//   GET  /health        relay liveness, last-call timestamp, cloud endpoint
//   GET  /tools/list    cached for 5min, proxies to cloud
//   GET  /credits       balance + 24h/7d burn — read from cloud
//   GET  /activity      last 200 events (browser-dev fallback for the
//                       Tauri event stream)
//   POST /auth          {bearer: "..."} stores token in process state
//   POST /config        {offline_mode: bool} flips offline read mode
//
// Caching:
//   tools/list — 5 min in-memory
//   tool calls — per-request-hash JSON cache in app_cache_dir, used as
//   the offline-read source. Cache writes are best-effort.
//
// All events are emitted to the Tauri frontend via the
// `mcp-relay-event` event channel for the Activity Log.

use crate::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

const CLOUD_URL: &str = "https://www.mentionfox.com/mcp";
const TOOLS_LIST_TTL_SECS: u64 = 300;
const MAX_EVENT_HISTORY: usize = 200;

#[derive(Clone, Serialize, Deserialize)]
pub struct RelayEvent {
    pub ts: String,
    pub tool: Option<String>,
    pub status: u16,
    pub duration_ms: u128,
    pub cached: bool,
    pub error: Option<String>,
    pub client: Option<String>,
}

#[derive(Clone)]
struct RelayCtx {
    state: AppState,
    app: AppHandle,
    tools_list_cache: Arc<Mutex<Option<(Instant, Value)>>>,
    http: reqwest::Client,
}

pub async fn serve(state: AppState, app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ctx = RelayCtx {
        state,
        app,
        tools_list_cache: Arc::new(Mutex::new(None)),
        http: reqwest::Client::builder()
            .timeout(Duration::from_secs(95)) // matches MentionFox MCP wall ≤ 90s
            .build()?,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app_router = Router::new()
        .route("/health", get(health))
        .route("/mcp", post(mcp_post))
        .route("/tools/list", get(tools_list))
        .route("/credits", get(credits))
        .route("/activity", get(activity))
        .route("/auth", post(set_auth))
        .route("/config", post(set_config))
        .with_state(ctx)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8732").await?;
    log::info!("MCP relay listening on 127.0.0.1:8732");
    axum::serve(listener, app_router).await?;
    Ok(())
}

// ───────────────────────────────────────────────────────────────────
// Handlers
// ───────────────────────────────────────────────────────────────────

async fn health(State(ctx): State<RelayCtx>) -> Json<Value> {
    let last = ctx.state.last_call_at.lock().await.clone();
    let cache_size = std::fs::read_dir(&ctx.state.cache_dir)
        .map(|d| d.count())
        .unwrap_or(0);
    Json(serde_json::json!({
        "ok": true,
        "cloud_endpoint": CLOUD_URL,
        "last_call_at": last,
        "cache_size": cache_size
    }))
}

#[derive(Deserialize)]
struct AuthBody {
    bearer: String,
}

async fn set_auth(State(ctx): State<RelayCtx>, Json(b): Json<AuthBody>) -> impl IntoResponse {
    *ctx.state.bearer.lock().await = Some(b.bearer);
    (StatusCode::OK, Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
struct ConfigBody {
    offline_mode: Option<bool>,
}

async fn set_config(State(ctx): State<RelayCtx>, Json(b): Json<ConfigBody>) -> impl IntoResponse {
    if let Some(om) = b.offline_mode {
        *ctx.state.offline_mode.lock().await = om;
    }
    (StatusCode::OK, Json(serde_json::json!({ "ok": true })))
}

async fn activity(State(ctx): State<RelayCtx>) -> Json<Vec<RelayEvent>> {
    Json(ctx.state.events.lock().await.clone())
}

async fn tools_list(State(ctx): State<RelayCtx>) -> impl IntoResponse {
    // 5-min in-memory cache.
    {
        let cache = ctx.tools_list_cache.lock().await;
        if let Some((at, v)) = cache.as_ref() {
            if at.elapsed().as_secs() < TOOLS_LIST_TTL_SECS {
                return (StatusCode::OK, Json(v.clone())).into_response();
            }
        }
    }

    let token = match ctx.state.bearer.lock().await.clone() {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "no bearer token configured; set in Settings" })),
            )
                .into_response()
        }
    };

    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": "tools-list",
        "method": "tools/list"
    });
    let resp = match ctx
        .http
        .post(CLOUD_URL)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("cloud unreachable: {e}") })),
            )
                .into_response()
        }
    };
    let status = resp.status();
    let v: Value = resp.json().await.unwrap_or(serde_json::json!({}));
    let payload = v
        .get("result")
        .cloned()
        .unwrap_or(serde_json::json!({ "tools": [] }));

    // Cache the result envelope only on success.
    if status.is_success() {
        *ctx.tools_list_cache.lock().await = Some((Instant::now(), payload.clone()));
    }
    (StatusCode::OK, Json(payload)).into_response()
}

async fn credits(State(ctx): State<RelayCtx>) -> impl IntoResponse {
    // MentionFox MCP doesn't expose a /credits JSON-RPC method; stub
    // for v0.1 with placeholder data + TODO. Real version pulls from
    // /api/credits or surface credits on tool responses' result.meta.
    let _ = &ctx;
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "balance": null,
            "plan": null,
            "burn_24h": 0,
            "burn_7d": 0,
            "note": "v0.1: balance read deferred to credit-meta on tool responses; TODO surface real balance."
        })),
    )
}

async fn mcp_post(State(ctx): State<RelayCtx>, Json(body): Json<Value>) -> impl IntoResponse {
    let started = Instant::now();
    let tool_name = extract_tool_name(&body);
    let client_label = extract_client_label(&body);
    let request_hash = hash_payload(&body);

    let offline = *ctx.state.offline_mode.lock().await;

    // Offline read path: try cache first.
    if offline {
        if let Some(cached) = read_cache(&ctx.state.cache_dir, &request_hash) {
            log_event(
                &ctx,
                RelayEvent {
                    ts: Utc::now().to_rfc3339(),
                    tool: tool_name.clone(),
                    status: 200,
                    duration_ms: started.elapsed().as_millis(),
                    cached: true,
                    error: None,
                    client: client_label.clone(),
                },
            )
            .await;
            return (StatusCode::OK, Json(cached)).into_response();
        }
        let evt = RelayEvent {
            ts: Utc::now().to_rfc3339(),
            tool: tool_name.clone(),
            status: 503,
            duration_ms: started.elapsed().as_millis(),
            cached: false,
            error: Some("offline_mode and cache miss".into()),
            client: client_label,
        };
        log_event(&ctx, evt).await;
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "jsonrpc": "2.0",
                "id": body.get("id").cloned().unwrap_or(Value::Null),
                "error": { "code": -32001, "message": "offline mode + cache miss" }
            })),
        )
            .into_response();
    }

    // Online path.
    let token = match ctx.state.bearer.lock().await.clone() {
        Some(t) => t,
        None => {
            let evt = RelayEvent {
                ts: Utc::now().to_rfc3339(),
                tool: tool_name.clone(),
                status: 401,
                duration_ms: started.elapsed().as_millis(),
                cached: false,
                error: Some("no bearer token".into()),
                client: client_label.clone(),
            };
            log_event(&ctx, evt).await;
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": body.get("id").cloned().unwrap_or(Value::Null),
                    "error": { "code": -32001, "message": "no bearer token configured" }
                })),
            )
                .into_response();
        }
    };

    let resp = ctx
        .http
        .post(CLOUD_URL)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await;

    let (status, payload, err): (StatusCode, Value, Option<String>) = match resp {
        Ok(r) => {
            let st = r.status();
            let v: Value = r.json().await.unwrap_or(serde_json::json!({}));
            let err = v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).map(String::from);
            (StatusCode::from_u16(st.as_u16()).unwrap_or(StatusCode::OK), v, err)
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            serde_json::json!({
                "jsonrpc": "2.0",
                "id": body.get("id").cloned().unwrap_or(Value::Null),
                "error": { "code": -32603, "message": format!("cloud unreachable: {e}") }
            }),
            Some(format!("cloud unreachable: {e}")),
        ),
    };

    *ctx.state.last_call_at.lock().await = Some(Utc::now().to_rfc3339());

    // Best-effort cache write for offline reads. Only successful, non-error responses.
    if status.is_success() && err.is_none() {
        let _ = write_cache(&ctx.state.cache_dir, &request_hash, &payload);
    }

    log_event(
        &ctx,
        RelayEvent {
            ts: Utc::now().to_rfc3339(),
            tool: tool_name,
            status: status.as_u16(),
            duration_ms: started.elapsed().as_millis(),
            cached: false,
            error: err,
            client: client_label,
        },
    )
    .await;

    (status, Json(payload)).into_response()
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

async fn log_event(ctx: &RelayCtx, evt: RelayEvent) {
    {
        let mut events = ctx.state.events.lock().await;
        events.insert(0, evt.clone());
        events.truncate(MAX_EVENT_HISTORY);
    }
    let _ = ctx.app.emit("mcp-relay-event", evt);
}

fn extract_tool_name(body: &Value) -> Option<String> {
    if body.get("method")?.as_str()? == "tools/call" {
        body.get("params")?
            .get("name")?
            .as_str()
            .map(String::from)
    } else {
        body.get("method").and_then(|m| m.as_str()).map(String::from)
    }
}

fn extract_client_label(body: &Value) -> Option<String> {
    body.get("params")
        .and_then(|p| p.get("clientInfo"))
        .and_then(|c| c.get("name"))
        .and_then(|n| n.as_str())
        .map(String::from)
}

fn hash_payload(body: &Value) -> String {
    let mut hasher = Sha256::new();
    let s = serde_json::to_string(body).unwrap_or_default();
    hasher.update(s.as_bytes());
    hex::encode(hasher.finalize())
}

fn read_cache(dir: &std::path::Path, hash: &str) -> Option<Value> {
    let p = dir.join(format!("{hash}.json"));
    let txt = std::fs::read_to_string(p).ok()?;
    serde_json::from_str(&txt).ok()
}

fn write_cache(dir: &std::path::Path, hash: &str, value: &Value) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    let p = dir.join(format!("{hash}.json"));
    let s = serde_json::to_string(value)?;
    std::fs::write(p, s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_tool_name_from_tools_call() {
        let v = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": { "name": "get_dossier", "arguments": { "name": "Saul" } }
        });
        assert_eq!(extract_tool_name(&v), Some("get_dossier".into()));
    }

    #[test]
    fn extract_tool_name_from_other_method() {
        let v = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        });
        assert_eq!(extract_tool_name(&v), Some("tools/list".into()));
    }

    #[test]
    fn hash_payload_is_deterministic() {
        let v = serde_json::json!({ "x": 1 });
        assert_eq!(hash_payload(&v), hash_payload(&v));
    }

    #[test]
    fn merge_connector_config_creates_block() {
        let merged = crate::merge_connector_config(
            "claude-desktop",
            serde_json::json!({}),
            "http://127.0.0.1:8732/mcp",
        );
        assert!(merged
            .get("mcpServers")
            .and_then(|m| m.get("foxapis"))
            .is_some());
    }
}
