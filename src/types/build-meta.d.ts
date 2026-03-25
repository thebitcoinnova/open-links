import type { BuildInfo } from "../lib/build-info";

declare global {
  const __OPENLINKS_BUILD_INFO__: BuildInfo;
  const __OPENLINKS_CANONICAL_ORIGIN__: string;
  const __OPENLINKS_REPOSITORY_SLUG__: string;
  const __OPENLINKS_REPOSITORY_DOCS_REF__: string;
}
