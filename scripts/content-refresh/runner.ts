import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CommandResult } from "../lib/command";
import { runCommand } from "../lib/command";
import type {
  ContentRefreshOptions,
  ContentRefreshPhase,
  ContentRefreshPhaseResult,
  ContentRefreshSummary,
} from "./contracts";
import { listGitChangedPaths } from "./git-changes";
import { classifyContentRefreshPaths } from "./paths";
import { buildContentRefreshPlan } from "./plan";

export interface ContentRefreshDependencies {
  assertSummaryPathIsIgnored: (summaryPath: string) => void;
  captureChangedState: () => Map<string, string>;
  log: (message: string) => void;
  now: () => Date;
  runPhase: (phase: ContentRefreshPhase) => CommandResult;
  writeSummary: (summaryPath: string, summary: ContentRefreshSummary) => void;
}

const hashPathState = (repoPath: string): string => {
  if (!fs.existsSync(repoPath)) return "missing";
  const stats = fs.lstatSync(repoPath);
  const content = stats.isSymbolicLink() ? fs.readlinkSync(repoPath) : fs.readFileSync(repoPath);
  return `${stats.mode}:${createHash("sha256").update(content).digest("hex")}`;
};

const captureGitChangedState = (): Map<string, string> =>
  new Map(listGitChangedPaths().map((repoPath) => [repoPath, hashPathState(repoPath)]));

const writeJsonSummary = (summaryPath: string, summary: ContentRefreshSummary): void => {
  const absoluteSummaryPath = path.resolve(summaryPath);
  fs.mkdirSync(path.dirname(absoluteSummaryPath), { recursive: true });
  fs.writeFileSync(absoluteSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
};

const assertSummaryPathIsIgnored = (summaryPath: string): void => {
  const absoluteSummaryPath = path.resolve(summaryPath);
  const relativeSummaryPath = path.relative(process.cwd(), absoluteSummaryPath);
  if (relativeSummaryPath.startsWith("..") || path.isAbsolute(relativeSummaryPath)) {
    return;
  }

  const result = runCommand("git", ["check-ignore", "--quiet", "--", relativeSummaryPath], {
    allowFailure: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `Content refresh summary path '${summaryPath}' must be outside the repository or ignored by Git.`,
    );
  }
};

const defaultRunPhase = (phase: ContentRefreshPhase): CommandResult => {
  const result = runCommand(phase.command, phase.args, { allowFailure: true });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
};

export const defaultContentRefreshDependencies = (): ContentRefreshDependencies => ({
  assertSummaryPathIsIgnored,
  captureChangedState: captureGitChangedState,
  log: console.log,
  now: () => new Date(),
  runPhase: defaultRunPhase,
  writeSummary: writeJsonSummary,
});

const newlyChangedPaths = (
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): string[] => {
  const allPaths = new Set([...before.keys(), ...after.keys()]);
  return [...allPaths].filter((repoPath) => before.get(repoPath) !== after.get(repoPath));
};

export const runContentRefresh = (
  options: ContentRefreshOptions,
  dependencies: ContentRefreshDependencies = defaultContentRefreshDependencies(),
): ContentRefreshSummary => {
  dependencies.assertSummaryPathIsIgnored(options.summaryJsonPath);
  const startedAtDate = dependencies.now();
  const startedAt = startedAtDate.toISOString();
  const beforeState = dependencies.captureChangedState();
  const phaseResults: ContentRefreshPhaseResult[] = [];

  for (const phase of buildContentRefreshPlan(options)) {
    dependencies.log(`Content refresh: ${phase.label}...`);
    const phaseStartedAtDate = dependencies.now();
    const result = dependencies.runPhase(phase);
    const phaseCompletedAtDate = dependencies.now();
    const phaseResult: ContentRefreshPhaseResult = {
      completedAt: phaseCompletedAtDate.toISOString(),
      durationMs: Math.max(0, phaseCompletedAtDate.getTime() - phaseStartedAtDate.getTime()),
      id: phase.id,
      label: phase.label,
      startedAt: phaseStartedAtDate.toISOString(),
      status: result.status === 0 ? "passed" : "failed",
    };
    phaseResults.push(phaseResult);

    if (result.status !== 0) {
      const afterState = dependencies.captureChangedState();
      const changedPathClassification = classifyContentRefreshPaths(afterState.keys());
      const summary: ContentRefreshSummary = {
        changedPaths: changedPathClassification.contentRefreshPaths,
        completedAt: phaseCompletedAtDate.toISOString(),
        failedPhase: phase.id,
        failure: `Phase '${phase.id}' failed with exit code ${result.status}.`,
        options,
        phases: phaseResults,
        startedAt,
        status: "failed",
        unexpectedPaths: classifyContentRefreshPaths(newlyChangedPaths(beforeState, afterState))
          .unexpectedPaths,
      };
      dependencies.writeSummary(options.summaryJsonPath, summary);
      return summary;
    }
  }

  const completedAt = dependencies.now().toISOString();
  const afterState = dependencies.captureChangedState();
  const changedPathClassification = classifyContentRefreshPaths(afterState.keys());
  const unexpectedPaths = classifyContentRefreshPaths(
    newlyChangedPaths(beforeState, afterState),
  ).unexpectedPaths;

  if (unexpectedPaths.length > 0) {
    const summary: ContentRefreshSummary = {
      changedPaths: changedPathClassification.contentRefreshPaths,
      completedAt,
      failure: `Content refresh changed paths outside its ownership contract: ${unexpectedPaths.join(", ")}.`,
      options,
      phases: phaseResults,
      startedAt,
      status: "failed",
      unexpectedPaths,
    };
    dependencies.writeSummary(options.summaryJsonPath, summary);
    return summary;
  }

  const summary: ContentRefreshSummary = {
    changedPaths: changedPathClassification.contentRefreshPaths,
    completedAt,
    options,
    phases: phaseResults,
    startedAt,
    status: "passed",
    unexpectedPaths: [],
  };
  dependencies.writeSummary(options.summaryJsonPath, summary);
  return summary;
};
