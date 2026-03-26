import { runProviderSetup } from "./setup-provider-shared";

await runProviderSetup({
  providerConfigPath: "railway.toml",
  providerLabel: "Railway",
  target: "railway",
});
