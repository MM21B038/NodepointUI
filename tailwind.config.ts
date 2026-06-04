import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        chat: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "chat-surface": {
          canvas: "hsl(var(--chat-canvas))",
          elevated: "hsl(var(--chat-elevated))",
          user: "hsl(var(--chat-user))",
          "user-border": "hsl(var(--chat-user-border))",
          assistant: "hsl(var(--chat-assistant))",
        },
        brand: {
          workspace: "hsl(var(--brand-workspace) / <alpha-value>)",
          group: "hsl(var(--brand-group) / <alpha-value>)",
          chat: "hsl(var(--brand-chat) / <alpha-value>)",
          success: "hsl(var(--brand-success) / <alpha-value>)",
          warning: "hsl(var(--brand-warning) / <alpha-value>)",
          info: "hsl(var(--brand-info) / <alpha-value>)",
        },
        "group-tag": {
          workspace: "hsl(var(--group-tag-workspace) / <alpha-value>)",
          files: "hsl(var(--group-tag-files) / <alpha-value>)",
          entity: "hsl(var(--group-tag-entity) / <alpha-value>)",
          relation: "hsl(var(--group-tag-relation) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "cursor-blink": {
          "0%, 45%": { opacity: "1" },
          "50%, 100%": { opacity: "0.15" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.35" },
          "40%": { transform: "translateY(-3px)", opacity: "1" },
        },
        "timeline-flow": {
          "0%": { transform: "translateY(-120%)", opacity: "0.2" },
          "45%": { opacity: "0.9" },
          "100%": { transform: "translateY(420%)", opacity: "0.2" },
        },
        "timeline-glow": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        "stream-mark": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.55" },
          "50%": { transform: "scale(1.12)", opacity: "1" },
        },
        "stream-mark-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "stream-glyph-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "stream-glyph-counter": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        "stream-ray": {
          "0%, 100%": { transform: "scaleY(0.5)", opacity: "0.35" },
          "50%": { transform: "scaleY(1.12)", opacity: "1" },
        },
        "stream-petal": {
          "0%, 100%": { transform: "scale(0.72)", opacity: "0.45" },
          "50%": { transform: "scale(1.08)", opacity: "1" },
        },
        "stream-core": {
          "0%, 100%": { transform: "scale(0.72)", opacity: "0.65" },
          "50%": { transform: "scale(1.22)", opacity: "1" },
        },
        "stream-aura": {
          "0%, 100%": { transform: "scale(0.85)", opacity: "0.3" },
          "50%": { transform: "scale(1.25)", opacity: "0.85" },
        },
        "tool-lane-enter": {
          "0%": {
            opacity: "0",
            transform: "translateY(8px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "tool-lane-merge": {
          "0%": {
            transform: "translateY(0) scale(1)",
            opacity: "1",
            filter: "blur(0)",
          },
          "35%": {
            transform: "translateY(-4px) scale(0.97)",
            opacity: "0.75",
            filter: "blur(0)",
          },
          "100%": {
            transform: "translateY(-14px) scale(0.86)",
            opacity: "0",
            filter: "blur(3px)",
          },
        },
        "tool-node-complete": {
          "0%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.5)",
          },
          "45%": {
            transform: "scale(1.35)",
            boxShadow: "0 0 0 4px rgba(16, 185, 129, 0.35)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)",
          },
        },
        "tool-rail-flow": {
          "0%": { transform: "translateY(-100%)", opacity: "0.15" },
          "50%": { opacity: "0.85" },
          "100%": { transform: "translateY(100%)", opacity: "0.15" },
        },
        "auth-orb-a": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(28px, -18px) scale(1.06)" },
          "66%": { transform: "translate(-16px, 22px) scale(0.96)" },
        },
        "auth-orb-b": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-32px, 24px) scale(1.08)" },
        },
        "auth-orb-c": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "40%": { transform: "translate(20px, -28px) scale(1.04)" },
          "80%": { transform: "translate(-24px, 12px) scale(0.98)" },
        },
        "auth-aurora": {
          "0%, 100%": { transform: "translateX(-8%) skewY(-2deg)", opacity: "0.35" },
          "50%": { transform: "translateX(8%) skewY(2deg)", opacity: "0.65" },
        },
        "auth-fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "auth-glow": {
          "0%, 100%": { opacity: "0.45", transform: "scale(0.95)" },
          "50%": { opacity: "0.85", transform: "scale(1.05)" },
        },
        "auth-orbit": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "auth-node-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.35" },
          "50%": { transform: "scale(1.15)", opacity: "0.7" },
        },
        "auth-edge": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        "auth-dash-travel": {
          "0%": { strokeDashoffset: "32" },
          "100%": { strokeDashoffset: "0" },
        },
        "auth-dash-travel-reverse": {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "32" },
        },
        "auth-ring-pulse": {
          "0%": { transform: "scale(0.88)", opacity: "0.55" },
          "100%": { transform: "scale(1.45)", opacity: "0" },
        },
        "auth-hub-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.12)" },
        },
        "auth-node-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "auth-orbit-reverse": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        "auth-illustration-drift": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "auth-sparkle": {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
      },
      transitionDuration: {
        rail: "400ms",
        enter: "480ms",
        merge: "520ms",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2.2s ease-in-out infinite",
        "cursor-blink": "cursor-blink 1.05s ease-in-out infinite",
        "bounce-dot": "bounce-dot 1.2s ease-in-out infinite",
        "timeline-flow": "timeline-flow 2.4s ease-in-out infinite",
        "timeline-glow": "timeline-glow 1.6s ease-in-out infinite",
        "stream-mark": "stream-mark 2s ease-in-out infinite",
        "stream-mark-spin": "stream-mark-spin 8s linear infinite",
        "stream-glyph-spin": "stream-glyph-spin 2.2s linear infinite",
        "stream-glyph-counter": "stream-glyph-counter 3.4s linear infinite",
        "stream-ray": "stream-ray 1.2s ease-in-out infinite",
        "stream-petal": "stream-petal 1.35s ease-in-out infinite",
        "stream-core": "stream-core 1.1s ease-in-out infinite",
        "stream-aura": "stream-aura 2s ease-in-out infinite",
        "tool-lane-enter": "tool-lane-enter 0.48s ease-out forwards",
        "tool-lane-merge": "tool-lane-merge 0.52s ease-in forwards",
        "tool-node-complete": "tool-node-complete 0.4s ease-out",
        "tool-rail-flow": "tool-rail-flow 2s ease-in-out infinite",
        "auth-orb-a": "auth-orb-a 22s ease-in-out infinite",
        "auth-orb-b": "auth-orb-b 28s ease-in-out infinite",
        "auth-orb-c": "auth-orb-c 24s ease-in-out infinite",
        "auth-aurora": "auth-aurora 16s ease-in-out infinite",
        "auth-fade-up": "auth-fade-up 0.65s ease-out both",
        "auth-glow": "auth-glow 4s ease-in-out infinite",
        "auth-orbit": "auth-orbit 48s linear infinite",
        "auth-node-pulse": "auth-node-pulse 3s ease-in-out infinite",
        "auth-edge": "auth-edge 2.8s ease-in-out infinite",
        "auth-dash-travel": "auth-dash-travel 2.4s linear infinite",
        "auth-dash-travel-reverse": "auth-dash-travel-reverse 2.8s linear infinite",
        "auth-ring-pulse": "auth-ring-pulse 2.8s ease-out infinite",
        "auth-hub-breathe": "auth-hub-breathe 3.2s ease-in-out infinite",
        "auth-node-float": "auth-node-float 4.5s ease-in-out infinite",
        "auth-orbit-reverse": "auth-orbit-reverse 56s linear infinite",
        "auth-illustration-drift": "auth-illustration-drift 7s ease-in-out infinite",
        "auth-sparkle": "auth-sparkle 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
