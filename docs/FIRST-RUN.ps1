# First-run setup for FoxAPIs Desktop.
# Run this from C:\Users\ritekit\foxapis-desktop\ on a Windows box with
# git, gh, node, and (for the Tauri build) Rust installed.

Set-Location C:\Users\ritekit\foxapis-desktop

# 1. Git init + first commit
git init
git config user.email "osakasaul@gmail.com"
git config user.name "Saul Fleischman"
git checkout -b main
git add -A
git commit -m @'
[FoxAPIs Desktop 0.1] Tauri-based local agentic workspace - local MCP relay + tool catalog + activity log + connector hub + offline mode + macOS/Windows/Linux distribution

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@

# 2. Create GitHub repo + push
gh repo create OsakaSaul/foxapis-desktop --public `
  --description "FoxAPIs Desktop - local agentic workspace" `
  --source=. --remote=origin --push

if (-not $?) {
  Write-Host "gh failed - create the repo manually at https://github.com/new (Owner=OsakaSaul, Repo=foxapis-desktop, Public) then:" -ForegroundColor Yellow
  Write-Host "  git remote add origin https://github.com/OsakaSaul/foxapis-desktop.git"
  Write-Host "  git push -u origin main"
}

# 3. Install npm dependencies
npm install

# 4. Generate Tauri icons (requires a 1024x1024 source.png in src-tauri/icons/)
if (Test-Path src-tauri/icons/source.png) {
  npx @tauri-apps/cli icon ./src-tauri/icons/source.png
} else {
  Write-Host "src-tauri/icons/source.png missing - drop a 1024x1024 fox glyph there then run: npx tauri icon ./src-tauri/icons/source.png" -ForegroundColor Yellow
}

# 5. Validate Rust build (only if cargo is installed)
if (Get-Command cargo -ErrorAction SilentlyContinue) {
  Set-Location src-tauri
  cargo check
  cargo test
  Set-Location ..
} else {
  Write-Host "cargo not installed - run 'winget install Rustlang.Rustup' then 'rustup default stable'" -ForegroundColor Yellow
}

# 6. Validate frontend build
npm run build

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Next: 'npm run tauri:dev' to launch the app, or 'git tag v0.1.0 && git push --tags' to trigger a signed release."
