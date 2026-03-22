export { parseGitHubRepositorySlug } from "../../src/lib/github-repository";

import {
  parseGitHubRepositorySlug,
  resolveGitHubRepositorySlug as resolveGitHubRepositorySlugOrFallback,
} from "../../src/lib/github-repository";
import { runCommand } from "./command";

type CommandRunner = typeof runCommand;

interface ResolveGitHubRepositorySlugOptions {
  env?: Record<string, string | undefined>;
  runCommandImpl?: CommandRunner;
}

export function resolveGitHubRepositorySlug(
  maybeRepository: string | undefined,
  options: ResolveGitHubRepositorySlugOptions = {},
) {
  const env = options.env ?? process.env;
  const runCommandImpl = options.runCommandImpl ?? runCommand;

  const maybeResolvedRepository = resolveGitHubRepositorySlugOrFallback(maybeRepository, "");
  if (maybeResolvedRepository) {
    return maybeResolvedRepository;
  }

  const maybeResolvedFromEnv = resolveGitHubRepositorySlugOrFallback(env.GITHUB_REPOSITORY, "");
  if (maybeResolvedFromEnv) {
    return maybeResolvedFromEnv;
  }

  const remoteUrl = runCommandImpl("git", ["remote", "get-url", "origin"]).stdout.trim();
  return parseGitHubRepositorySlug(remoteUrl);
}
