import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const repositoryName =
  process.env.REPO_NAME_OVERRIDE?.trim() || process.env.GITHUB_REPOSITORY?.split("/")[1] || "";
const baseModeRaw = process.env.PAGES_BASE_MODE?.trim().toLowerCase();
const explicitBasePath = process.env.BASE_PATH?.trim();

const normalizeBasePath = (value: string): string => {
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
};

const projectBasePath = repositoryName ? `/${repositoryName}/` : "/";

const resolveBasePath = (): string => {
  if (explicitBasePath) {
    return normalizeBasePath(explicitBasePath);
  }

  switch (baseModeRaw) {
    case "root":
      return "/";
    case "auto":
      return process.env.GITHUB_ACTIONS ? projectBasePath : "/";
    case "project":
    default:
      return projectBasePath;
  }
};

const base = resolveBasePath();

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    target: "esnext"
  },
  base
});
