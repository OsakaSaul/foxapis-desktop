# Deploy & distribution — FoxAPIs Desktop

## Quick start

Windows: `pwsh scripts/saul-bootstrap.ps1`
macOS/Linux: `./scripts/saul-bootstrap.sh`

Either script handles: Rust install, npm install, cargo check, Tauri updater key gen, homebrew tap creation, idempotent on re-run.

The manual steps below are kept for reference / debugging.

## What ships in v0.1

A Tauri 2 desktop app for macOS (Apple Silicon + Intel via universal binary), Windows (x64), and Linux (x64 .deb / .rpm / .AppImage). Built and uploaded via GitHub Actions on tag push.

## First-time setup (Saul actions queued)

The following items require Saul personally — neither this agent nor CC can complete them.

### 1. Create the GitHub repo

If `gh` CLI was unavailable in this build session, create the repo manually:

```
gh repo create OsakaSaul/foxapis-desktop --public \
  --description "FoxAPIs Desktop — local agentic workspace" \
  --source=. --remote=origin
git push -u origin main
```

If `gh` is also unavailable on Saul's box, do it via the GitHub web UI: https://github.com/new → Owner = OsakaSaul, Repo = foxapis-desktop, Public, then locally:

```
cd C:\Users\ritekit\foxapis-desktop
git remote add origin https://github.com/OsakaSaul/foxapis-desktop.git
git push -u origin main
```

### 2. Install Rust toolchain

This sandbox couldn't run `cargo check` because Rust isn't installed. Saul's first local Tauri build needs:

```
# Windows / PowerShell
winget install Rustlang.Rustup
rustup default stable
```

Then `cd C:\Users\ritekit\foxapis-desktop && cargo check` from inside `src-tauri/` to validate.

### 3. Generate Tauri updater signing keys

```
npx @tauri-apps/cli signer generate -w ~/.tauri/foxapis-desktop.key
```

Outputs a `pubkey` and a `privkey`. Replace `TODO_GENERATE_VIA_npx_tauri_signer_generate` in `src-tauri/tauri.conf.json` (the `plugins.updater.pubkey` field) with the public key.

Add the private key to GitHub repo Secrets as `TAURI_SIGNING_PRIVATE_KEY` and the password (if any) as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

**Never commit either key to git.**

### 4. macOS code signing + notarization (only needed for distributing to Gatekeeper-respecting Mac users)

Requires an Apple Developer account ($99/yr).

```
APPLE_ID                       # Saul's Apple ID email
APPLE_PASSWORD                 # app-specific password from appleid.apple.com
APPLE_TEAM_ID                  # 10-char alphanumeric team id
APPLE_CERTIFICATE              # base64-encoded Developer ID Application .p12
APPLE_CERTIFICATE_PASSWORD     # password for the .p12
```

Add these to GitHub repo Secrets. The release workflow will sign and notarize automatically.

If skipped: macOS builds still produce, but users have to right-click → Open the first time, and Apple Silicon Macs may flat-out refuse to launch unsigned binaries on default settings.

### 5. Windows code signing (optional, but reduces SmartScreen warnings)

Requires an EV code-signing cert ($300-700/yr from DigiCert or similar).

```
WINDOWS_CERTIFICATE            # base64-encoded .pfx
WINDOWS_CERTIFICATE_PASSWORD   # password for the .pfx
```

If skipped: Windows users get the SmartScreen "Unknown publisher" warning.

### 6. Linux distribution channels

The release workflow produces `.deb`, `.rpm`, and `.AppImage` files. Optional next steps:

- **Snap / Flathub**: not configured in v0.1 — adds 1-2 days of release-channel packaging.
- **AUR (Arch)**: a `PKGBUILD` template is left for v0.2.

### 7. Homebrew tap (macOS distribution alternative)

Create a separate repo `OsakaSaul/homebrew-foxapis`:

```
gh repo create OsakaSaul/homebrew-foxapis --public \
  --description "Homebrew tap for FoxAPIs Desktop"
```

Add a `Casks/foxapis-desktop.rb` formula. Template:

```ruby
cask "foxapis-desktop" do
  version "0.1.0"
  sha256 "TODO_SHA256_OF_DMG"

  url "https://github.com/OsakaSaul/foxapis-desktop/releases/download/v#{version}/FoxAPIs.Desktop_#{version}_universal.dmg"
  name "FoxAPIs Desktop"
  desc "Local agentic workspace for MentionFox MCP"
  homepage "https://foxapis.com/desktop/"

  app "FoxAPIs Desktop.app"

  zap trash: [
    "~/Library/Application Support/com.foxapis.desktop",
    "~/Library/Preferences/com.foxapis.desktop.plist",
  ]
end
```

Users then `brew tap OsakaSaul/foxapis && brew install --cask foxapis-desktop`.

The release workflow can be extended to auto-update the formula on each release; v0.1 leaves it manual.

### 8. winget (Windows distribution alternative)

Submit a manifest to `microsoft/winget-pkgs`. Template lives at `docs/winget-manifest-template.yaml` (TODO add). Users then `winget install MentionFox.FoxAPIsDesktop`.

### 9. Marketing page

`marketing-page-for-foxapis.html` in this repo is meant to be copied into `foxapis-cf/public/desktop/index.html` (the Cloudflare Pages site). This agent doesn't write to that repo. Saul: copy the file, push to `OsakaSaul/foxapis-cf` main, Cloudflare auto-deploys.

The download buttons on that page point to `https://github.com/OsakaSaul/foxapis-desktop/releases/latest/download/...` URLs that don't exist until the first release ships.

## Release flow

1. Bump version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`
2. `git commit -am "release v0.1.0" && git push`
3. `git tag v0.1.0 && git push --tags`
4. GitHub Actions builds for macOS / Windows / Linux, signs (if secrets present), creates a draft release
5. Saul reviews the draft, marks it published
6. Existing users' apps detect the new release via the Tauri updater pointing at `latest.json`

## Testing matrix (per release)

- Cold install on fresh macOS, Windows 11, Ubuntu 22.04
- Bearer token round-trip: Settings → save → relay /health shows token loaded
- One MCP call from each wired connector (Claude Desktop, Cursor, Continue) — each shows up in Activity Log
- Tray icon shows + click opens window
- Auto-launch toggle persists across reboots
- Offline mode read returns cached dossier; cache miss returns 503 with -32001
- Updater check from a stale build pulls the new release
