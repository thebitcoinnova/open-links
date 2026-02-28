import { z } from "zod";

export const repoFileShaSchema = z.object({
  profile: z.string().optional(),
  links: z.string().optional(),
  site: z.string().optional(),
});

export const onboardingStatusSchema = z.object({
  githubConnected: z.boolean(),
  appInstalled: z.boolean(),
  repoProvisioned: z.boolean(),
  pagesVerified: z.boolean(),
  blockers: z.array(z.string()),
});

export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
  source: z.enum(["profile", "links", "site", "policy"]),
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(validationIssueSchema),
  warnings: z.array(validationIssueSchema),
});

export const repoContentPayloadSchema = z.object({
  profile: z.record(z.unknown()),
  links: z.record(z.unknown()),
  site: z.record(z.unknown()),
  sha: repoFileShaSchema,
});

export const commitDescriptorSchema = z.object({
  filePath: z.enum(["data/profile.json", "data/links.json", "data/site.json"]),
  sha: z.string(),
});

export const commitResultSchema = z.object({
  success: z.boolean(),
  commits: z.array(commitDescriptorSchema),
  deployStatus: z.object({
    ci: z.string(),
    deploy: z.string(),
    pagesUrl: z.string().nullable(),
  }),
});

export const syncResultSchema = z.object({
  status: z.enum(["synced", "conflict", "failed"]),
  upstreamSha: z.string().nullable(),
  forkSha: z.string().nullable(),
  message: z.string(),
});

export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
export type RepoContentPayload = z.infer<typeof repoContentPayloadSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type CommitResult = z.infer<typeof commitResultSchema>;
export type SyncResult = z.infer<typeof syncResultSchema>;

export interface AuthenticatedUser {
  id: string;
  githubUserId: number;
  githubLogin: string;
  githubName: string | null;
  avatarUrl: string | null;
}

export interface StudioEnv {
  apiBaseUrl: string;
}
