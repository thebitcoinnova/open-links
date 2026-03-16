import type { DeployBreadcrumb, DeployRunContext } from "../lib/deploy-log";

export function parseArgs(rawArgs: string[]) {
  return rawArgs.reduce<Record<string, string>>((accumulator, currentArg) => {
    if (!currentArg.startsWith("--")) {
      return accumulator;
    }

    const [key, value = "true"] = currentArg.slice(2).split("=");
    accumulator[key] = value;
    return accumulator;
  }, {});
}

export async function recordTimedAction<T>(
  runContext: DeployRunContext,
  breadcrumb: Omit<DeployBreadcrumb, "at" | "durationMs" | "startedAt"> & {
    data?: unknown | ((result: T) => unknown);
    failureDetail?: string | ((error: Error) => string);
  },
  action: () => Promise<T> | T,
) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  try {
    const result = await action();
    await runContext.addBreadcrumb({
      ...breadcrumb,
      data: typeof breadcrumb.data === "function" ? breadcrumb.data(result) : breadcrumb.data,
      durationMs: Date.now() - startedAtMs,
      startedAt,
    });
    return result;
  } catch (error) {
    const errorDetail = error instanceof Error ? error.message : String(error);
    await runContext.addBreadcrumb({
      detail:
        typeof breadcrumb.failureDetail === "function"
          ? breadcrumb.failureDetail(error instanceof Error ? error : new Error(errorDetail))
          : (breadcrumb.failureDetail ?? `${breadcrumb.detail} Failed: ${errorDetail}`),
      durationMs: Date.now() - startedAtMs,
      startedAt,
      status: "failed",
      step: breadcrumb.step,
    });
    throw error;
  }
}
