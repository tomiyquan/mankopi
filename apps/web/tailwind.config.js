/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Segoe UI", "sans-serif"],
        display: ["Plus Jakarta Sans", "Segoe UI", "sans-serif"],
      },
      colors: {
        canvas: "#EEF2ED",
        ink: "#12241C",
        mute: "#5B6B63",
        line: "#D8E0D6",
        leaf: {
          DEFAULT: "#128A4E",
          dark: "#0B5C34",
          deep: "#0A1F16",
          mist: "#E4F5EA",
          glow: "#C8F27A",
        },
        clay: "#C23B2A",
        sand: "#EEF2ED",
        moss: {
          50: "#E4F5EA",
          600: "#128A4E",
          700: "#0B5C34",
          800: "#0A1F16",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,36,28,0.04), 0 12px 32px -16px rgba(18,36,28,0.12)",
        pop: "0 18px 50px -20px rgba(10,31,22,0.35)",
      },
      borderRadius: {
        "2.5xl": "1.25rem",
      },
      keyframes: {
        "page-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "drawer-in": {
          "0%": { transform: "translateX(-12px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "page-in": "page-in 0.35s ease-out both",
        "drawer-in": "drawer-in 0.25s ease-out both",
      },
    },
  },
};
