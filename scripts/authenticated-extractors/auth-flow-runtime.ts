import { stdin, stdout } from "node:process";
import readline from "node:readline/promises";
import type {
  AuthFlowActionCandidate,
  AuthFlowSessionReport,
  AuthFlowSnapshot,
  AuthFlowTransition,
} from "./types";

export interface AuthFlowActionExecutionResult {
  success: boolean;
  details?: string;
}

export interface WaitForAuthenticatedSessionInput {
  timeoutMs: number;
  pollMs: number;
  heartbeatMs?: number;
  logPrefix?: string;
  promptOnActions?: boolean;
  pauseOnUnknown?: boolean;
  inspect: () => Promise<AuthFlowSnapshot>;
  wait: (durationMs: number) => Promise<void>;
  executeAction?: (candidate: AuthFlowActionCandidate) => Promise<AuthFlowActionExecutionResult>;
}

export interface WaitForAuthenticatedSessionResult {
  verified: boolean;
  timedOut: boolean;
  failureReason?: string;
  finalSnapshot: AuthFlowSnapshot;
  report: AuthFlowSessionReport;
}

const nowIso = (): string => new Date().toISOString();

const summarizeSnapshot = (snapshot: AuthFlowSnapshot): string => {
  const url = snapshot.currentUrl ?? "unknown";
  const signals = snapshot.signals.join(",") || "none";
  const actions = snapshot.actionCandidates.map((candidate) => candidate.label).join(",") || "none";
  return `state=${snapshot.state} url=${url} title=${snapshot.title ?? "unknown"} signals=${signals} actions=${actions}`;
};

const toTransition = (snapshot: AuthFlowSnapshot): AuthFlowTransition => {
  let host: string | undefined;
  let pathValue: string | undefined;
  if (snapshot.currentUrl) {
    try {
      const parsed = new URL(snapshot.currentUrl);
      host = parsed.host;
      pathValue = `${parsed.pathname}${parsed.search}`;
    } catch {
      host = undefined;
      pathValue = undefined;
    }
  }

  return {
    timestamp: snapshot.timestamp,
    state: snapshot.state,
    host,
    path: pathValue,
    title: snapshot.title,
    signals: snapshot.signals,
    actionLabels: snapshot.actionCandidates.map((candidate) => candidate.label),
  };
};

const signatureForSnapshot = (snapshot: AuthFlowSnapshot): string => {
  const signalSignature = [...snapshot.signals].sort().join("|");
  const actionSignature = snapshot.actionCandidates
    .map((candidate) => `${candidate.actionId}:${candidate.label}`)
    .sort()
    .join("|");
  return [
    snapshot.state,
    snapshot.currentUrl ?? "",
    snapshot.title ?? "",
    signalSignature,
    actionSignature,
  ].join("::");
};

const askYesNo = async (question: string): Promise<boolean> => {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
};

const askContinueOrAbort = async (
  logPrefix: string,
  snapshot: AuthFlowSnapshot,
): Promise<"continue" | "abort"> => {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (
      await rl.question(
        `${logPrefix} Unknown state detected (${snapshot.state}). Continue waiting? [y=continue / n=abort]: `,
      )
    )
      .trim()
      .toLowerCase();
    if (answer === "n" || answer === "no") {
      return "abort";
    }
    return "continue";
  } finally {
    rl.close();
  }
};

const requireInteractiveTerminal = (reason: string): never => {
  throw new Error(
    `Interactive confirmation required (${reason}) but no TTY is available. Re-run in a local interactive terminal.`,
  );
};

const finalizeResult = (input: {
  startedAt: string;
  timedOut: boolean;
  verified: boolean;
  finalSnapshot: AuthFlowSnapshot;
  transitions: AuthFlowTransition[];
  actionsProposed: string[];
  actionsExecuted: string[];
  actionsDeclined: string[];
  heartbeats: number;
  failureReason?: string;
}): WaitForAuthenticatedSessionResult => {
  const report: AuthFlowSessionReport = {
    startedAt: input.startedAt,
    completedAt: nowIso(),
    timedOut: input.timedOut,
    finalState: input.finalSnapshot.state,
    finalUrl: input.finalSnapshot.currentUrl,
    transitions: input.transitions,
    actionsProposed: [...new Set(input.actionsProposed)],
    actionsExecuted: [...new Set(input.actionsExecuted)],
    actionsDeclined: [...new Set(input.actionsDeclined)],
    heartbeats: input.heartbeats,
  };

  return {
    verified: input.verified,
    timedOut: input.timedOut,
    failureReason: input.failureReason,
    finalSnapshot: input.finalSnapshot,
    report,
  };
};

const isInteractive = (): boolean => stdin.isTTY && stdout.isTTY;

const shouldPauseForUnknownState = (snapshot: AuthFlowSnapshot): boolean =>
  snapshot.state === "unknown" ||
  (snapshot.state === "post_auth_consent" && snapshot.actionCandidates.length === 0);

export const summarizeAuthFlowResult = (result: WaitForAuthenticatedSessionResult): string => {
  const finalSnapshot = result.finalSnapshot;
  return [
    `verified=${result.verified ? "yes" : "no"}`,
    `timedOut=${result.timedOut ? "yes" : "no"}`,
    `state=${finalSnapshot.state}`,
    `url=${finalSnapshot.currentUrl ?? "unknown"}`,
    `signals=${finalSnapshot.signals.join(",") || "none"}`,
    `transitions=${result.report.transitions.length}`,
    `actionsExecuted=${result.report.actionsExecuted.length}`,
    `failureReason=${result.failureReason ?? "none"}`,
  ].join("; ");
};

export const waitForAuthenticatedSession = async (
  input: WaitForAuthenticatedSessionInput,
): Promise<WaitForAuthenticatedSessionResult> => {
  const startedAt = nowIso();
  const logPrefix = input.logPrefix ?? "[auth-flow]";
  const heartbeatMs = Math.max(2_000, input.heartbeatMs ?? 15_000);
  const pollMs = Math.max(250, input.pollMs);
  const timeoutMs = Math.max(5_000, input.timeoutMs);
  const interactive = isInteractive();
  const actionsProposed: string[] = [];
  const actionsExecuted: string[] = [];
  const actionsDeclined: string[] = [];
  const transitions: AuthFlowTransition[] = [];
  const promptedActionKeys = new Set<string>();
  const promptedUnknownSignatures = new Set<string>();
  let lastSignature = "";
  let lastHeartbeatAt = 0;
  let heartbeats = 0;
  const startedAtMs = Date.now();

  const promptOnActions = input.promptOnActions ?? true;
  const pauseOnUnknown = input.pauseOnUnknown ?? true;

  while (Date.now() - startedAtMs <= timeoutMs) {
    const snapshot = await input.inspect();
    const signature = signatureForSnapshot(snapshot);
    if (signature !== lastSignature) {
      lastSignature = signature;
      transitions.push(toTransition(snapshot));
      console.log(`${logPrefix} transition ${summarizeSnapshot(snapshot)}`);
      lastHeartbeatAt = Date.now();
    } else if (Date.now() - lastHeartbeatAt >= heartbeatMs) {
      heartbeats += 1;
      lastHeartbeatAt = Date.now();
      console.log(`${logPrefix} waiting heartbeat ${summarizeSnapshot(snapshot)}`);
    }

    if (snapshot.state === "authenticated") {
      return finalizeResult({
        startedAt,
        timedOut: false,
        verified: true,
        finalSnapshot: snapshot,
        transitions,
        actionsProposed,
        actionsExecuted,
        actionsDeclined,
        heartbeats,
      });
    }

    if (snapshot.state === "blocked") {
      return finalizeResult({
        startedAt,
        timedOut: false,
        verified: false,
        finalSnapshot: snapshot,
        transitions,
        actionsProposed,
        actionsExecuted,
        actionsDeclined,
        heartbeats,
        failureReason: "blocked_state",
      });
    }

    if (snapshot.state === "post_auth_consent" && snapshot.actionCandidates.length > 0) {
      for (const candidate of snapshot.actionCandidates) {
        const actionKey = `${signature}::${candidate.actionId}`;
        if (promptedActionKeys.has(actionKey)) {
          continue;
        }
        promptedActionKeys.add(actionKey);
        actionsProposed.push(candidate.actionId);

        if (!promptOnActions) {
          continue;
        }

        if (!interactive) {
          return finalizeResult({
            startedAt,
            timedOut: false,
            verified: false,
            finalSnapshot: snapshot,
            transitions,
            actionsProposed,
            actionsExecuted,
            actionsDeclined,
            heartbeats,
            failureReason: "interactive_required_action_confirmation",
          });
        }

        const shouldExecute = await askYesNo(
          `${logPrefix} Action candidate '${candidate.label}' (risk=${candidate.risk}, confidence=${candidate.confidence.toFixed(
            2,
          )}). Execute now? [y/N]: `,
        );

        if (!shouldExecute) {
          actionsDeclined.push(candidate.actionId);
          continue;
        }

        const executeAction = input.executeAction;
        if (!executeAction) {
          requireInteractiveTerminal("action execution callback missing");
        }
        const ensuredExecuteAction = executeAction as (
          action: AuthFlowActionCandidate,
        ) => Promise<AuthFlowActionExecutionResult>;

        const execution = await ensuredExecuteAction(candidate);
        if (execution.success) {
          actionsExecuted.push(candidate.actionId);
          console.log(
            `${logPrefix} Executed action '${candidate.actionId}' (${execution.details ?? "no extra details"}).`,
          );
        } else {
          console.warn(
            `${logPrefix} Action '${candidate.actionId}' did not execute (${execution.details ?? "unknown reason"}).`,
          );
        }
      }
    }

    if (pauseOnUnknown && shouldPauseForUnknownState(snapshot)) {
      if (!interactive) {
        return finalizeResult({
          startedAt,
          timedOut: false,
          verified: false,
          finalSnapshot: snapshot,
          transitions,
          actionsProposed,
          actionsExecuted,
          actionsDeclined,
          heartbeats,
          failureReason: "interactive_required_unknown_state",
        });
      }

      const unknownKey = signatureForSnapshot(snapshot);
      if (!promptedUnknownSignatures.has(unknownKey)) {
        promptedUnknownSignatures.add(unknownKey);
        const decision = await askContinueOrAbort(logPrefix, snapshot);
        if (decision === "abort") {
          return finalizeResult({
            startedAt,
            timedOut: false,
            verified: false,
            finalSnapshot: snapshot,
            transitions,
            actionsProposed,
            actionsExecuted,
            actionsDeclined,
            heartbeats,
            failureReason: "unknown_state_aborted_by_operator",
          });
        }
      }
    }

    await input.wait(Math.min(pollMs, timeoutMs));
  }

  const timeoutSnapshot = await input.inspect();
  const timeoutSignature = signatureForSnapshot(timeoutSnapshot);
  if (transitions.length === 0 || timeoutSignature !== lastSignature) {
    transitions.push(toTransition(timeoutSnapshot));
  }

  return finalizeResult({
    startedAt,
    timedOut: true,
    verified: false,
    finalSnapshot: timeoutSnapshot,
    transitions,
    actionsProposed,
    actionsExecuted,
    actionsDeclined,
    heartbeats,
    failureReason: "timeout",
  });
};
