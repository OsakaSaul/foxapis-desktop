/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // FoxAPIs brand palette — synced with foxapis.com
        navy: "#111733",
        cyan: "#22D3EE",
        gold: "#F5C542",
        lime: "#45F882",
        ink: "#0B1020",
        slate2: "#1A2040",
        muted: "#6B7AA0",
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        sans: ['"Inter Tight"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        cyan: "0 0 0 1px rgba(34,211,238,.4), 0 8px 32px rgba(34,211,238,.12)",
      },
    },
  },
  plugins: [],
};
