import { runCommand } from "./command";

type CommandRunner = typeof runCommand;

interface ResolveGitHubRepositorySlugOptions {
  env?: Record<string, string | undefined>;
  runCommandImpl?: CommandRunner;
}

export function parseGitHubRepositorySlug(input: string) {
  const normalizedInput = input.trim();

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(normalizedInput)) {
    return normalizedInput.replace(/\.git$/, "");
  }

  const sshMatch = normalizedInput.match(/^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  const httpsMatch = normalizedInput.match(/^https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  throw new Error(`Could not parse a GitHub repository slug from: ${input}`);
}

export function resolveGitHubRepositorySlug(
  maybeRepository: string | undefined,
  options: ResolveGitHubRepositorySlugOptions = {},
) {
  const env = options.env ?? process.env;
  const runCommandImpl = options.runCommandImpl ?? runCommand;

  if (maybeRepository) {
    return parseGitHubRepositorySlug(maybeRepository);
  }

  if (env.GITHUB_REPOSITORY) {
    return parseGitHubRepositorySlug(env.GITHUB_REPOSITORY);
  }

  const remoteUrl = runCommandImpl("git", ["remote", "get-url", "origin"]).stdout.trim();
  return parseGitHubRepositorySlug(remoteUrl);
}
