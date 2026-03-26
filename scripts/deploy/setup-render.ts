import { runProviderSetup } from "./setup-provider-shared";

await runProviderSetup({
  providerConfigPath: "render.yaml",
  providerLabel: "Render",
  target: "render",
});
