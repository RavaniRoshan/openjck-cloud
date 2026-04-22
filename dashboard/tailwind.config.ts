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
        border: "var(--oj-border)",
        background: "var(--oj-bg)",
        foreground: "var(--oj-text-primary)",
        card: "var(--oj-surface-1)",
        "card-foreground": "var(--oj-text-primary)",
        popover: "var(--oj-surface-1)",
        "popover-foreground": "var(--oj-text-primary)",
        primary: "var(--oj-accent)",
        "primary-foreground": "var(--oj-bg)",
        secondary: "var(--oj-surface-2)",
        "secondary-foreground": "var(--oj-text-primary)",
        muted: "var(--oj-surface-2)",
        "muted-foreground": "var(--oj-text-muted)",
        accent: "var(--oj-accent)",
        "accent-foreground": "var(--oj-bg)",
        destructive: "var(--oj-danger)",
        "destructive-foreground": "var(--oj-text-primary)",
        input: "var(--oj-surface-2)",
        ring: "var(--oj-accent)",
        sidebar: "var(--oj-surface-0)",
        "sidebar-foreground": "var(--oj-text-primary)",
        "sidebar-primary": "var(--oj-accent)",
        "sidebar-primary-foreground": "var(--oj-bg)",
        "sidebar-accent": "var(--oj-accent)",
        "sidebar-accent-foreground": "var(--oj-bg)",
        "sidebar-border": "var(--oj-border-glass)",
        "sidebar-ring": "var(--oj-accent)",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      backgroundImage: {
        sidebar: "var(--oj-sidebar-gradient)",
        card: "var(--oj-card-gradient)",
        stat: "var(--oj-stat-gradient)",
        running: "var(--oj-running-card-gradient)",
        failed: "var(--oj-failed-card-gradient)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-running": "var(--shadow-glow-amber)",
        drawer: "var(--shadow-drawer)",
      },
      animation: {
        "amber-glow": "amber-glow-breathe 2.4s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "fade-up": "fade-up 0.4s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        "amber-pulse": "amber-pulse-dot 1.6s ease-in-out infinite",
        "amber-border": "amber-border-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        "amber-glow-breathe": {
          "0%, 100%": { boxShadow: "0 0 4px var(--oj-accent-glow)" },
          "50%": { boxShadow: "0 0 12px var(--oj-accent-glow-strong), 0 0 4px var(--oj-accent-glow)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "amber-pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.1)" },
        },
        "amber-border-pulse": {
          "0%, 100%": { borderLeftColor: "var(--oj-accent)" },
          "50%": { borderLeftColor: "var(--oj-accent-hover)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
