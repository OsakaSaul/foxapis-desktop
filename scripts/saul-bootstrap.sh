#!/usr/bin/env bash
set -euo pipefail

echo "FoxAPIs Desktop bootstrap starting..."

# Step 1: Rust toolchain
if ! command -v cargo >/dev/null 2>&1; then
    echo "Installing Rust toolchain..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust already installed: $(cargo --version)"
fi

# Step 2: npm install
if [ ! -d node_modules ]; then
    echo "Running npm install..."
    npm install
else
    echo "node_modules already present"
fi

# Step 3: cargo check
echo "Running cargo check..."
(cd src-tauri && cargo check)

# Step 4: Tauri updater key
KEY_PATH="$HOME/.tauri/foxapis-desktop.key"
if [ ! -f "$KEY_PATH" ]; then
    mkdir -p "$HOME/.tauri"
    echo "Generating Tauri updater key..."
    npx tauri signer generate -w "$KEY_PATH"
    echo ""
    echo "ACTION REQUIRED:"
    echo "1. Public key was printed above. Paste it into src-tauri/tauri.conf.json under updater.pubkey"
    echo "2. Open https://github.com/OsakaSaul/foxapis-desktop/settings/secrets/actions/new"
    echo "3. Add secret named TAURI_SIGNING_PRIVATE_KEY with contents of $KEY_PATH"
    read -p "Press Enter when done"
else
    echo "Tauri updater key already exists at $KEY_PATH"
fi

# Step 5: Homebrew tap repo
echo "Checking homebrew tap repo..."
if ! gh repo view OsakaSaul/homebrew-foxapis >/dev/null 2>&1; then
    echo "Creating homebrew tap repo..."
    gh repo create OsakaSaul/homebrew-foxapis --public --description "Homebrew tap for FoxAPIs Desktop"
else
    echo "Homebrew tap already exists"
fi

# Step 6: Icon check
if [ ! -f src-tauri/icons/source.png ]; then
    echo ""
    echo "OPTIONAL: drop a 1024x1024 fox glyph at src-tauri/icons/source.png"
    echo "Then run: npx tauri icon ./src-tauri/icons/source.png"
    echo "(Skipped today - v0.1 ships without per-platform icons)"
fi

echo ""
echo "Bootstrap complete!"
echo "Next: npm run tauri dev (or npm run tauri build for a release binary)"
