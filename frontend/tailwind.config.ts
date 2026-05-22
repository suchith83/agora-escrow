import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        mute: "#525252",
        line: "#e5e5e5",
        accent: "#0066ff",
      },
    },
  },
  plugins: [],
};

export default config;
