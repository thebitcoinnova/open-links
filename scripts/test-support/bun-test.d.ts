declare module "bun:test" {
  import type nodeTest from "node:test";

  export const test: typeof nodeTest;
  export type TestContext = import("node:test").TestContext;
}
