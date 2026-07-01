import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        panel: "var(--panel)",
        surface: "var(--surface)",
        muted: "var(--muted)",
        line: "var(--line)",
        ink: "var(--text)",
        positive: "#52d990",
        negative: "#ff5b6e",
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
