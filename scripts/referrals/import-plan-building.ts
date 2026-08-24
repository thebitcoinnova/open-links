import type { BuildReferralImportPlanInput } from "./import-candidate";
import { createCandidatePlanningState, planReferralCandidate } from "./import-candidate-planning";
import type { ReferralImportPlan, ReferralImportPlanItem } from "./import-contract";
import {
  DEFAULT_LINKS_PATH,
  DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
  DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
  DEFAULT_SHARED_REFERRAL_CATALOG_PATH,
} from "./import-contract";

export const buildReferralImportPlan = (
  input: BuildReferralImportPlanInput,
): ReferralImportPlan => {
  const state = createCandidatePlanningState(input);
  const items: ReferralImportPlanItem[] = [];
  for (const [index, candidate] of input.candidates.entries()) {
    items.push(planReferralCandidate(candidate, index, state));
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    inputPath: input.inputPath ?? DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
    linksPath: input.linksPath ?? DEFAULT_LINKS_PATH,
    sharedCatalogPath: input.sharedCatalogPath ?? DEFAULT_SHARED_REFERRAL_CATALOG_PATH,
    localCatalogPath: input.localCatalogPath ?? DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
    items,
  };
};
