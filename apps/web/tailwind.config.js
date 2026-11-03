/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        electric: "hsl(var(--electric))",
        coral: "hsl(var(--coral))",
        violet: "hsl(var(--violet))",
        ink: "hsl(var(--ink))",
        paper: {
          DEFAULT: "hsl(var(--paper))",
          foreground: "hsl(var(--paper-foreground))",
          muted: "hsl(var(--paper-muted))",
          "muted-foreground": "hsl(var(--paper-muted-foreground))",
          border: "hsl(var(--paper-border))",
          accent: "hsl(var(--paper-accent))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 2px)",
        "2xl": "calc(var(--radius) + 6px)",
        "3xl": "calc(var(--radius) + 10px)",
        "4xl": "calc(var(--radius) + 14px)",
      },
      fontFamily: {
        sans: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        serif: ["Newsreader", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 0 0 hsl(0 0% 100% / 0.04) inset, 0 18px 60px -30px hsl(var(--ink) / 0.8)",
        lift: "0 1px 0 0 hsl(0 0% 100% / 0.06) inset, 0 30px 90px -40px hsl(var(--ink) / 0.95)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.22), 0 24px 90px -34px hsl(var(--primary) / 0.5)",
        electric: "0 0 0 1px hsl(var(--electric) / 0.2), 0 24px 90px -36px hsl(var(--electric) / 0.4)",
        sheet: "10px 12px 0 hsl(var(--ink) / 0.32), 0 34px 70px -34px hsl(var(--ink) / 0.72)",
      },
      opacity: {
        2: "0.02",
        3: "0.03",
        4: "0.04",
        6: "0.06",
        7: "0.07",
        8: "0.08",
        12: "0.12",
        15: "0.15",
        18: "0.18",
        22: "0.22",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
