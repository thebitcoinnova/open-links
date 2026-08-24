import process from "node:process";
import { executeValidation } from "./validation/validate-data-pipeline";

export type {
  HookRichArtifactCheckDecision,
  ValidationMode,
} from "./validation/validate-data-contracts";
export {
  DEFAULT_HOOK_CHANGED_PATHS_PATH,
  DEFAULT_REFERRAL_CATALOG_LOCAL_PATH,
  DEFAULT_REFERRAL_CATALOG_PATH,
} from "./validation/validate-data-contracts";
export {
  pathTouchesHookRichArtifactInputs,
  resolveHookRichArtifactCheckDecision,
} from "./validation/validate-data-runtime";
export { collectReferralCatalogIssues } from "./validation/validate-data-referrals";
export { enrichmentIssues } from "./validation/validate-data-auth";
export { publicAugmentedStableCacheCoverageIssues } from "./validation/validate-data-enrichment-cache";
export {
  analyticsHistorySetupIssues,
  followerHistoryArtifactIssues,
} from "./validation/validate-data-history";
export { resolvePreviewImageAvailability } from "./validation/validate-data-preview";

export const run = () => {
  process.exit(executeValidation() ? 0 : 1);
};

if (import.meta.main) run();
