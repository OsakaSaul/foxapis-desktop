# scripts/saul-bootstrap.ps1
# One-command FoxAPIs Desktop bootstrap

$ErrorActionPreference = 'Stop'
Write-Host "FoxAPIs Desktop bootstrap starting..." -ForegroundColor Cyan

# Step 1: Rust toolchain
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Rust toolchain..." -ForegroundColor Yellow
    winget install Rustlang.Rustup --accept-source-agreements --accept-package-agreements
    rustup default stable
} else {
    Write-Host "Rust already installed: $(cargo --version)" -ForegroundColor Green
}

# Step 2: npm install (if not done)
if (-not (Test-Path "node_modules")) {
    Write-Host "Running npm install..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "node_modules already present (delete + rerun if you want a fresh install)" -ForegroundColor Green
}

# Step 3: cargo check
Write-Host "Running cargo check..." -ForegroundColor Yellow
Push-Location src-tauri
cargo check
Pop-Location

# Step 4: Tauri updater key
$keyPath = "$env:USERPROFILE\.tauri\foxapis-desktop.key"
if (-not (Test-Path $keyPath)) {
    Write-Host "Generating Tauri updater key..." -ForegroundColor Yellow
    $keyDir = Split-Path $keyPath -Parent
    if (-not (Test-Path $keyDir)) { New-Item -ItemType Directory -Path $keyDir | Out-Null }
    npx tauri signer generate -w $keyPath
    Write-Host ""
    Write-Host "ACTION REQUIRED:" -ForegroundColor Magenta
    Write-Host "1. Public key was printed above. Paste it into src-tauri/tauri.conf.json under updater.pubkey" -ForegroundColor Magenta
    Write-Host "2. Open https://github.com/OsakaSaul/foxapis-desktop/settings/secrets/actions/new" -ForegroundColor Magenta
    Write-Host "3. Add secret named TAURI_SIGNING_PRIVATE_KEY with contents of $keyPath" -ForegroundColor Magenta
    Read-Host "Press Enter when done"
} else {
    Write-Host "Tauri updater key already exists at $keyPath" -ForegroundColor Green
}

# Step 5: Homebrew tap repo
Write-Host "Checking homebrew tap repo..." -ForegroundColor Yellow
$tapExists = gh repo view OsakaSaul/homebrew-foxapis 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating homebrew tap repo..." -ForegroundColor Yellow
    gh repo create OsakaSaul/homebrew-foxapis --public --description "Homebrew tap for FoxAPIs Desktop"
} else {
    Write-Host "Homebrew tap already exists" -ForegroundColor Green
}

# Step 6: Icon check (skip notarization + Windows cert - those are v0.2)
if (-not (Test-Path "src-tauri/icons/source.png")) {
    Write-Host ""
    Write-Host "OPTIONAL:" -ForegroundColor Yellow
    Write-Host "Drop a 1024x1024 fox glyph at src-tauri/icons/source.png" -ForegroundColor Yellow
    Write-Host "Then run: npx tauri icon ./src-tauri/icons/source.png" -ForegroundColor Yellow
    Write-Host "(Skipped today - v0.1 ships without per-platform icons)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Bootstrap complete!" -ForegroundColor Green
Write-Host "Next: npm run tauri dev (or npm run tauri build for a release binary)" -ForegroundColor Cyan
