import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type {
  RemoteCacheFetchResult,
  RemoteCacheRunSummary,
  RemoteCacheStatsEntry,
} from "./remote-cache-contracts";

const ROOT = process.cwd();

export class RemoteCacheStatsCollector {
  readonly scriptId: string;
  private readonly entries = new Map<string, RemoteCacheStatsEntry>();

  constructor(scriptId: string) {
    this.scriptId = scriptId;
  }

  record(result: RemoteCacheFetchResult): void {
    const key = [
      result.pipeline,
      result.policy.rule.id,
      result.policy.host,
      result.policy.rule.checkMode,
    ].join("|");
    const existing = this.entries.get(key) ?? {
      pipeline: result.pipeline,
      host: result.policy.host,
      matchedDomain: result.policy.matchedDomain,
      ruleId: result.policy.rule.id,
      checkMode: result.policy.rule.checkMode,
      totalChecks: 0,
      cacheFresh: 0,
      headUnchanged: 0,
      getNotModified: 0,
      fetched: 0,
      errors: 0,
      bytesFetched: 0,
      bytesSkipped: 0,
      headFallbacks: {},
    };

    existing.pipeline = result.pipeline;
    existing.totalChecks += 1;
    existing.bytesFetched += result.bytesFetched;
    existing.bytesSkipped += result.bytesSkipped;

    if (result.checkStatus === "cache_fresh") {
      existing.cacheFresh += 1;
    } else if (result.checkStatus === "head_unchanged") {
      existing.headUnchanged += 1;
    } else if (result.checkStatus === "get_not_modified") {
      existing.getNotModified += 1;
    } else if (result.checkStatus === "fetched") {
      existing.fetched += 1;
    } else {
      existing.errors += 1;
    }

    if (result.headFallbackReason) {
      existing.headFallbacks[result.headFallbackReason] =
        (existing.headFallbacks[result.headFallbackReason] ?? 0) + 1;
    }

    this.entries.set(key, existing);
  }

  toSummary(): RemoteCacheRunSummary {
    const entries = [...this.entries.values()].sort((left, right) => {
      if (left.pipeline !== right.pipeline) {
        return left.pipeline.localeCompare(right.pipeline);
      }
      return left.host.localeCompare(right.host);
    });

    return {
      version: 1,
      scriptId: this.scriptId,
      generatedAt: new Date().toISOString(),
      totals: {
        totalChecks: entries.reduce((sum, entry) => sum + entry.totalChecks, 0),
        cacheFresh: entries.reduce((sum, entry) => sum + entry.cacheFresh, 0),
        headUnchanged: entries.reduce((sum, entry) => sum + entry.headUnchanged, 0),
        getNotModified: entries.reduce((sum, entry) => sum + entry.getNotModified, 0),
        fetched: entries.reduce((sum, entry) => sum + entry.fetched, 0),
        errors: entries.reduce((sum, entry) => sum + entry.errors, 0),
        bytesFetched: entries.reduce((sum, entry) => sum + entry.bytesFetched, 0),
        bytesSkipped: entries.reduce((sum, entry) => sum + entry.bytesSkipped, 0),
      },
      entries,
    };
  }
}

export const createRemoteCacheStatsOutputPath = (scriptId: string): string => {
  const sanitizedId = scriptId.replaceAll(/[^a-zA-Z0-9_-]+/g, "-");
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return path.join("output", "cache-revalidation", `${timestamp}-${sanitizedId}.json`);
};

export const writeRemoteCacheRunSummary = (
  relativePath: string,
  collector: RemoteCacheStatsCollector,
): void => {
  const absolute = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(collector.toSummary(), null, 2)}\n`, "utf8");
};
