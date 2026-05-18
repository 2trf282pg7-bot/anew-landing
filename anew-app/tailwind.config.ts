import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        clay: "#B8704E",
        "clay-dark": "#8C4E32",
        "warm-white": "#FAF6F1",
        charcoal: "#1C1614",
        "charcoal-soft": "#5C4D45",
        stone: "#8A7870",
        "blush-deep": "#DBBAA6",
        "section-alt": "#F5EFE8",
      },
      fontFamily: {
        cormorant: ["Cormorant Garamond", "serif"],
        dm: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
