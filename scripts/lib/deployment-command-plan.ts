export interface SetupChildCommand {
  command: [string, ...string[]];
  label: string;
}

export function resolveRequestedTargets(maybeTargets: string | undefined) {
  return (
    maybeTargets
      ?.split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0) ?? []
  );
}

export function buildSetupChildCommands(
  targets: string[],
  args: Record<string, string>,
  mode: "apply" | "check",
) {
  const commands: SetupChildCommand[] = [];

  if (targets.includes("aws")) {
    commands.push(buildSetupChildCommand("scripts/deploy/setup-aws.ts", args, mode));
  }

  if (targets.includes("aws") || targets.includes("github-pages")) {
    commands.push(buildSetupChildCommand("scripts/deploy/setup-github.ts", args, mode));
  }

  return commands;
}

export function buildSetupChildCommand(
  scriptPath: string,
  args: Record<string, string>,
  mode: "apply" | "check",
): SetupChildCommand {
  const command: [string, ...string[]] = ["bun", "run", scriptPath];

  if (mode === "apply") {
    command.push("--apply");
  }

  if (args.repo) {
    command.push(`--repo=${args.repo}`);
  }

  if (args["role-arn"] && scriptPath.endsWith("setup-github.ts")) {
    command.push(`--role-arn=${args["role-arn"]}`);
  }

  return {
    command,
    label: scriptPath.includes("setup-aws") ? "AWS setup" : "GitHub setup",
  };
}
