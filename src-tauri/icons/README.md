# Icons (placeholders)

Tauri requires platform-specific icon binaries — these are committed as placeholders for v0.1 and need to be generated locally before the first release build.

## Required files (referenced in `tauri.conf.json`)

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.png` (1024x1024 source)
- `icon.icns` (macOS)
- `icon.ico` (Windows)

## Generating from a single source PNG

Drop a 1024x1024 transparent PNG (use the FoxAPIs cyan/lime fox glyph) into this folder as `source.png`, then run:

```
npx @tauri-apps/cli icon ./src-tauri/icons/source.png
```

That command produces all the sizes / formats above.

## Why not commit a generated set?

This sandbox build couldn't run binary tools to generate proper sized PNGs. Saul: run the command above on your box once before the first `npm run tauri:build`.
