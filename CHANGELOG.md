# Changelog

## v0.1.0 — 2026-05-10

Initial scaffold.

- Tauri 2 shell, ~5MB binary target
- React 18 + TypeScript + Tailwind 3 frontend, six tabs (Home, Tools, Activity, Connectors, Settings, tray)
- Local MCP relay bound to 127.0.0.1:8732 with `/health`, `/mcp`, `/tools/list`, `/credits`, `/activity`, `/auth`, `/config` endpoints
- Per-request hash cache for offline reads in app cache dir
- Activity Log streamed via Tauri `mcp-relay-event` channel (with browser-dev poll fallback)
- Connector Hub one-click writers for Claude Desktop, Cursor, Continue.dev (wired); Goose, n8n, LibreChat, Open WebUI, ChatGPT GPT (scaffold-only with snippets)
- System tray icon + menu (credits label is a placeholder — see DEPLOY.md TODOs)
- Auto-launch toggle via Tauri autostart plugin
- Bearer-token storage via Tauri Store plugin (keyring-backed) with localStorage fallback
- GitHub Actions release workflow targeting macOS / Windows / Linux

### Known v0.1 limitations

- Credit balance widget shows `—` until MentionFox MCP exposes a `/credits` JSON-RPC method or per-response credit meta. (TODO)
- Offline write replay queue not yet implemented; offline mode is read-only.
- Multi-account switcher is a placeholder; single-token only.
- Goose / n8n / LibreChat / Open WebUI / ChatGPT GPT connectors render config snippets but don't write the file. (TODO)
- Tauri updater pubkey is a placeholder; run `npx tauri signer generate` and replace before first signed release.
- Homebrew tap formula, winget manifest, .deb/.rpm packaging — templated in DEPLOY.md, deploy commands documented.
