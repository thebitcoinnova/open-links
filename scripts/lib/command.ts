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
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
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
