import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", ".dark"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#333333",
        background: "#1a1a1a",
        foreground: "#f5f5f5",
        card: "#222222",
        "card-foreground": "#f5f5f5",
        popover: "#222222",
        "popover-foreground": "#f5f5f5",
        primary: "#f59e0b",
        "primary-foreground": "#1a1a1a",
        secondary: "#2a2a2a",
        "secondary-foreground": "#f5f5f5",
        muted: "#2a2a2a",
        "muted-foreground": "#8a8a8a",
        accent: "#f59e0b",
        "accent-foreground": "#1a1a1a",
        destructive: "#ef4444",
        input: "#333333",
        ring: "#f59e0b",
        sidebar: "#222222",
        "sidebar-foreground": "#f5f5f5",
        "sidebar-primary": "#f59e0b",
        "sidebar-primary-foreground": "#1a1a1a",
        "sidebar-accent": "#f59e0b",
        "sidebar-accent-foreground": "#1a1a1a",
        "sidebar-border": "#333333",
        "sidebar-ring": "#f59e0b",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      animation: {
        "amber-pulse": "amber-pulse 2s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out",
        "skeleton-pulse": "skeleton-pulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        "amber-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "skeleton-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};

export default config;