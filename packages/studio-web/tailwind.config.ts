import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0f14",
        paper: "#f4f8fb",
        pulse: "#0ea5e9",
        flame: "#fb7185",
        mint: "#14b8a6",
      },
      boxShadow: {
        lift: "0 18px 40px -20px rgba(10, 15, 20, 0.45)",
      },
      fontFamily: {
        display: ["'Manrope'", "'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
