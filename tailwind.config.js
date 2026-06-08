/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        amoled: {
          bg: "#000000",
          card: "#0a0a0a",
          card2: "#111111",
          border: "#1a1a1a",
          border2: "#222222",
          muted: "#2a2a2a",
          text: "#ffffff",
          "text-secondary": "#888888",
          "text-muted": "#444444",
          blue: "#2563EB",
          "blue-hover": "#1d4ed8",
          "blue-glow": "rgba(37,99,235,0.3)",
          accent: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        display: ['"Montserrat"', '"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-blue": "0 0 20px rgba(37,99,235,0.25)",
        "glow-blue-sm": "0 0 10px rgba(37,99,235,0.15)",
        "card": "0 4px 24px rgba(0,0,0,0.8)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-glass":
          "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(37,99,235,0.2)" },
          "50%": { boxShadow: "0 0 25px rgba(37,99,235,0.5)" },
        },
      },
    },
  },
  plugins: [],
};
