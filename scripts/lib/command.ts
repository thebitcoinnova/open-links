import { spawnSync } from "node:child_process";

export interface CommandOptions {
  allowFailure?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdin?: string;
}

export interface CommandResult {
  command: string;
  args: string[];
  status: number;
  stdout: string;
  stderr: string;
}

export function runCommand(command: string, args: string[], options: CommandOptions = {}) {
  const mergedEnv: Record<string, string | undefined> = {
    ...process.env,
    ...options.env,
  };

  if (command === "git") {
    mergedEnv.GIT_ALTERNATE_OBJECT_DIRECTORIES = undefined;
    mergedEnv.GIT_COMMON_DIR = undefined;
    mergedEnv.GIT_DIR = undefined;
    mergedEnv.GIT_INDEX_FILE = undefined;
    mergedEnv.GIT_OBJECT_DIRECTORY = undefined;
    mergedEnv.GIT_PREFIX = undefined;
    mergedEnv.GIT_WORK_TREE = undefined;
  }

  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: mergedEnv,
    input: options.stdin,
  });

  const commandResult: CommandResult = {
    command,
    args,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };

  if (commandResult.status !== 0 && !options.allowFailure) {
    throw new Error(formatCommandFailure(commandResult));
  }

  return commandResult;
}

export function runJsonCommand<T>(command: string, args: string[], options: CommandOptions = {}) {
  const result = runCommand(command, args, options);

  if (!result.stdout.trim()) {
    throw new Error(`Command ${command} ${args.join(" ")} returned empty JSON output.`);
  }

  return JSON.parse(result.stdout) as T;
}

function formatCommandFailure(result: CommandResult) {
  const renderedCommand = [result.command, ...result.args].join(" ");
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const details = [stderr, stdout].filter(Boolean).join("\n");

  return details
    ? `Command failed (${result.status}): ${renderedCommand}\n${details}`
    : `Command failed (${result.status}): ${renderedCommand}`;
}
