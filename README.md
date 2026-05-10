# FoxAPIs Desktop

Local agentic workspace for the [MentionFox](https://www.mentionfox.com) MCP server.

A small (~5MB) cross-platform desktop app that runs a local Model Context Protocol relay on `localhost:8732` and proxies every call to MentionFox in the cloud with your bearer token. Connect once here — every local LLM client (Claude Desktop, Cursor, Continue, Goose, n8n, LibreChat, Open WebUI, ChatGPT custom GPT) talks to one URL and gets the same 18 tools.

## Why a desktop app

Web-based MCP works, but every client needs its own auth dance. With FoxAPIs Desktop:

- One bearer token, eight clients
- Tool catalog with live "Try it" sandbox
- Live activity stream of every MCP call (which client, which tool, latency, cache status, errors)
- Connector hub with one-click writers for the most popular MCP clients
- Offline read mode — cached dossiers and vetting reports work without the cloud
- System tray credit-balance widget
- Auto-launch on login (off by default)

## Stack

- Tauri 2 (Rust shell, ~5MB binary)
- React 18 + TypeScript + Tailwind 3
- macOS (Apple Silicon + Intel), Windows, Linux

## Quick start (developer)

```bash
git clone https://github.com/OsakaSaul/foxapis-desktop
cd foxapis-desktop
npm install
npm run tauri:dev
```

Requirements:

- Node 20+
- Rust 1.77+ (`rustup` recommended)
- Platform-specific build deps — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## File structure

```
src-tauri/           Rust shell (Tauri 2)
  Cargo.toml
  tauri.conf.json
  src/
    main.rs          App entry + Tauri commands
    mcp_relay.rs     Local HTTP server bound to 127.0.0.1:8732
    tray.rs          System-tray icon + menu
src/                 React frontend
  App.tsx            Top-level shell + tab nav
  main.tsx
  index.css
  components/
    ToolCatalog.tsx
    ActivityLog.tsx
    QuickActions.tsx
    ConnectorHub.tsx
    CreditWidget.tsx
    Settings.tsx
  lib/
    mcp.ts           Client to local relay
    auth.ts          Bearer-token storage (Tauri keyring + LS fallback)
.github/workflows/release.yml
docs/DEPLOY.md
marketing-page-for-foxapis.html
```

## Endpoints (local relay)

| Path           | Method | Purpose                                                              |
| -------------- | ------ | -------------------------------------------------------------------- |
| `/health`      | GET    | Relay liveness, last-call timestamp, cloud endpoint, cache size      |
| `/mcp`         | POST   | Proxy JSON-RPC 2.0 to MentionFox cloud                                |
| `/tools/list`  | GET    | Tools list, cached 5min                                               |
| `/credits`     | GET    | Balance + 24h/7d burn (v0.1 stubbed — see DEPLOY.md)                  |
| `/activity`    | GET    | Last 200 events (browser-dev fallback for the Tauri event stream)    |
| `/auth`        | POST   | `{ bearer: "..." }` stores token in process state                    |
| `/config`      | POST   | `{ offline_mode: bool }` flips offline read mode                     |

## Releasing

`git tag v0.1.0 && git push --tags` triggers `.github/workflows/release.yml` which builds for all three platforms, signs binaries, and uploads to GitHub Releases. The Tauri updater pulls from there.

## License

See `LICENSE.md`.
