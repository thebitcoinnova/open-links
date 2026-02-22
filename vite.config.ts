import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : "/");

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    target: "esnext"
  },
  base
});
