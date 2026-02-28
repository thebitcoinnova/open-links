import { config } from "./config.js";
import { createRequireSession } from "./lib/auth.js";
import { db } from "./services/database.js";
import { githubAuthService } from "./services/github-auth.js";
import { githubRepoService } from "./services/github-repo.js";
import { syncRepo } from "./services/sync.js";
import { turnstileService } from "./services/turnstile.js";
import { validateRepoContent } from "./services/validation.js";
import type { StudioApiDependencies } from "./types/studio-api-dependencies.js";

export const createDefaultStudioApiDependencies = (): StudioApiDependencies => ({
  config,
  db,
  githubAuthService,
  githubRepoService,
  turnstileService,
  syncRepo,
  validateRepoContent,
  requireSession: createRequireSession({ db }),
});
