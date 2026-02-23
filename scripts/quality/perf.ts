import fs from "node:fs";
import path from "node:path";
import type {
  BudgetThreshold,
  PerformanceProfileBudget,
  QualityDomainResult,
  QualityIssue,
  QualitySiteInput
} from "./types";

interface RunPerformanceChecksInput {
  rootDir: string;
  strict: boolean;
  site: QualitySiteInput;
}

const DEFAULT_BUDGETS: Record<string, Record<string, BudgetThreshold>> = {
  mobile: {
    totalBytes: { warn: 280000, fail: 380000 },
    jsBytes: { warn: 200000, fail: 280000 },
    cssBytes: { warn: 45000, fail: 70000 },
    htmlBytes: { warn: 18000, fail: 26000 },
    largestAssetBytes: { warn: 160000, fail: 220000 }
  },
  desktop: {
    totalBytes: { warn: 340000, fail: 440000 },
    jsBytes: { warn: 240000, fail: 320000 },
    cssBytes: { warn: 55000, fail: 80000 },
    htmlBytes: { warn: 22000, fail: 32000 },
    largestAssetBytes: { warn: 210000, fail: 290000 }
  }
};

const DEFAULT_MINIMUM_SCORE: BudgetThreshold = {
  warn: 90,
  fail: 75
};

const BAKED_IMAGE_WARN_BYTES = 5_000_000;

const normalizeThreshold = (value: BudgetThreshold | number | undefined, fallback: BudgetThreshold) => {
  if (typeof value === "number") {
    return {
      warn: value,
      fail: Math.round(value * 1.3)
    };
  }

  if (value && typeof value.warn === "number" && typeof value.fail === "number") {
    return value;
  }

  return fallback;
};

const collectBundleMetrics = (rootDir: string) => {
  const distDir = path.join(rootDir, "dist");
  const assetsDir = path.join(distDir, "assets");
  const generatedImagesDir = path.join(distDir, "generated", "images");
  const indexPath = path.join(distDir, "index.html");

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const htmlBytes = fs.statSync(indexPath).size;
  const assetFiles = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).map((name) => path.join(assetsDir, name))
    : [];

  let totalAssetBytes = 0;
  let jsBytes = 0;
  let cssBytes = 0;
  let largestAssetBytes = 0;
  let bakedImageBytes = 0;

  assetFiles.forEach((assetPath) => {
    const stats = fs.statSync(assetPath);
    const bytes = stats.size;
    totalAssetBytes += bytes;
    largestAssetBytes = Math.max(largestAssetBytes, bytes);

    if (assetPath.endsWith(".js")) {
      jsBytes += bytes;
    }

    if (assetPath.endsWith(".css")) {
      cssBytes += bytes;
    }
  });

  if (fs.existsSync(generatedImagesDir)) {
    const generatedFiles = fs.readdirSync(generatedImagesDir).map((name) => path.join(generatedImagesDir, name));
    generatedFiles.forEach((generatedFilePath) => {
      if (!fs.statSync(generatedFilePath).isFile()) {
        return;
      }
      bakedImageBytes += fs.statSync(generatedFilePath).size;
    });
  }

  return {
    totalBytes: htmlBytes + totalAssetBytes,
    htmlBytes,
    jsBytes,
    cssBytes,
    largestAssetBytes,
    bakedImageBytes
  };
};

const metricLabel = (metric: string): string => {
  switch (metric) {
    case "totalBytes":
      return "total bundle bytes";
    case "htmlBytes":
      return "HTML bytes";
    case "jsBytes":
      return "JavaScript bytes";
    case "cssBytes":
      return "CSS bytes";
    case "largestAssetBytes":
      return "largest asset bytes";
    default:
      return metric;
  }
};

const evaluateProfile = (
  issues: QualityIssue[],
  strict: boolean,
  profileName: "mobile" | "desktop",
  profileBudget: PerformanceProfileBudget | undefined,
  metrics: {
    totalBytes: number;
    htmlBytes: number;
    jsBytes: number;
    cssBytes: number;
    largestAssetBytes: number;
    bakedImageBytes: number;
  }
) => {
  const issueStartIndex = issues.length;
  const defaults = DEFAULT_BUDGETS[profileName];
  const thresholds = {
    totalBytes: normalizeThreshold(profileBudget?.totalBytes, defaults.totalBytes),
    htmlBytes: normalizeThreshold(profileBudget?.htmlBytes, defaults.htmlBytes),
    jsBytes: normalizeThreshold(profileBudget?.jsBytes, defaults.jsBytes),
    cssBytes: normalizeThreshold(profileBudget?.cssBytes, defaults.cssBytes),
    largestAssetBytes: normalizeThreshold(profileBudget?.largestAssetBytes, defaults.largestAssetBytes)
  };

  (Object.keys(thresholds) as Array<keyof typeof thresholds>).forEach((metric) => {
    const actual = metrics[metric];
    const threshold = thresholds[metric];

    if (actual > threshold.fail) {
      issues.push({
        domain: "performance",
        level: "error",
        code: "PERF_BUDGET_FAIL",
        scope: profileName,
        metric,
        actual,
        expected: threshold.fail,
        message: `${profileName} ${metricLabel(metric)} exceeded fail budget (${actual} > ${threshold.fail}).`,
        remediation: `Reduce ${metricLabel(metric)} for '${profileName}' profile or adjust quality.performance.profiles.${profileName}.${metric}.`
      });
      return;
    }

    if (actual > threshold.warn) {
      issues.push({
        domain: "performance",
        level: strict ? "error" : "warning",
        code: strict ? "PERF_BUDGET_WARN_ESCALATED" : "PERF_BUDGET_WARN",
        scope: profileName,
        metric,
        actual,
        expected: threshold.warn,
        message: `${profileName} ${metricLabel(metric)} exceeded warn budget (${actual} > ${threshold.warn}).`,
        remediation: `Optimize ${metricLabel(metric)} or raise warning threshold in quality.performance.profiles.${profileName}.${metric}.`
      });
    }
  });

  const profileIssues = issues.slice(issueStartIndex).filter((issue) => issue.scope === profileName);
  const errorCount = profileIssues.filter((issue) => issue.level === "error").length;
  const warningCount = profileIssues.filter((issue) => issue.level === "warning").length;
  const score = Math.max(0, 100 - errorCount * 18 - warningCount * 7);
  const minimumScoreThreshold = normalizeThreshold(profileBudget?.minimumScore, DEFAULT_MINIMUM_SCORE);

  if (score < minimumScoreThreshold.fail) {
    issues.push({
      domain: "performance",
      level: "error",
      code: "PERF_PROFILE_SCORE_FAIL",
      scope: profileName,
      metric: "minimumScore",
      actual: score,
      expected: minimumScoreThreshold.fail,
      message: `${profileName} aggregate performance score (${score}) is below fail threshold (${minimumScoreThreshold.fail}).`,
      remediation: `Reduce performance-budget violations or lower quality.performance.profiles.${profileName}.minimumScore thresholds.`
    });
    return;
  }

  if (score < minimumScoreThreshold.warn) {
    issues.push({
      domain: "performance",
      level: strict ? "error" : "warning",
      code: strict ? "PERF_PROFILE_SCORE_WARN_ESCALATED" : "PERF_PROFILE_SCORE_WARN",
      scope: profileName,
      metric: "minimumScore",
      actual: score,
      expected: minimumScoreThreshold.warn,
      message: `${profileName} aggregate performance score (${score}) is below warning threshold (${minimumScoreThreshold.warn}).`,
      remediation: `Improve performance metrics or tune quality.performance.profiles.${profileName}.minimumScore thresholds.`
    });
  }
};

export const runPerformanceChecks = ({
  rootDir,
  strict,
  site
}: RunPerformanceChecksInput): QualityDomainResult => {
  const issues: QualityIssue[] = [];
  const metrics = collectBundleMetrics(rootDir);

  if (!metrics) {
    issues.push({
      domain: "performance",
      level: "error",
      code: "PERF_DIST_MISSING",
      message: "dist/index.html is missing. Performance checks require a production build output.",
      remediation: "Run `npm run build` before `npm run quality:check` or ensure CI required lane builds before quality checks."
    });

    return {
      domain: "performance",
      status: "fail",
      summary: "Performance checks failed because build artifacts are missing.",
      issues
    };
  }

  const perfConfig = site.quality?.performance;
  const mobileBudget = perfConfig?.profiles?.mobile;
  const desktopBudget = perfConfig?.profiles?.desktop;

  evaluateProfile(issues, strict, "mobile", mobileBudget, metrics);
  evaluateProfile(issues, strict, "desktop", desktopBudget, metrics);

  if (metrics.bakedImageBytes > BAKED_IMAGE_WARN_BYTES) {
    issues.push({
      domain: "performance",
      level: "warning",
      code: "PERF_BAKED_IMAGE_BYTES_WARN",
      metric: "bakedImageBytes",
      actual: metrics.bakedImageBytes,
      expected: BAKED_IMAGE_WARN_BYTES,
      message: `Baked image bytes in dist/generated/images exceeded warning threshold (${metrics.bakedImageBytes} > ${BAKED_IMAGE_WARN_BYTES}).`,
      remediation:
        "Optimize remote image sources or reduce baked image count/size. This warning is non-blocking and does not escalate in strict mode."
    });
  }

  const hasError = issues.some((issue) => issue.level === "error");
  const hasWarning = issues.some((issue) => issue.level === "warning");

  const routeSummary = (perfConfig?.routes ?? ["/"]).join(", ");

  return {
    domain: "performance",
    status: hasError ? "fail" : hasWarning ? "warn" : "pass",
    summary: hasError
      ? `Performance checks found blocking issues for routes: ${routeSummary}.`
      : hasWarning
        ? `Performance checks passed with warnings for routes: ${routeSummary}.`
        : `Performance checks passed for routes: ${routeSummary}.`,
    issues
  };
};
