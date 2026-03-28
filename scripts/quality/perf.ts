import fs from "node:fs";
import path from "node:path";
import type {
  BudgetThreshold,
  PerformanceProfileBudget,
  QualityDomainResult,
  QualityIssue,
  QualitySiteInput,
} from "./types";

interface RunPerformanceChecksInput {
  advisoryOnly?: boolean;
  rootDir: string;
  strict: boolean;
  site: QualitySiteInput;
}

interface BundleMetrics {
  totalBytes: number;
  htmlBytes: number;
  jsBytes: number;
  cssBytes: number;
  largestAssetBytes: number;
  bakedImageBytes: number;
}

const DEFAULT_BUDGETS: Record<string, Record<string, BudgetThreshold>> = {
  mobile: {
    totalBytes: { warn: 616000, fail: 836000 },
    jsBytes: { warn: 440000, fail: 616000 },
    cssBytes: { warn: 99000, fail: 154000 },
    htmlBytes: { warn: 39600, fail: 57200 },
    largestAssetBytes: { warn: 352000, fail: 484000 },
  },
  desktop: {
    totalBytes: { warn: 748000, fail: 968000 },
    jsBytes: { warn: 528000, fail: 704000 },
    cssBytes: { warn: 121000, fail: 176000 },
    htmlBytes: { warn: 48400, fail: 70400 },
    largestAssetBytes: { warn: 462000, fail: 638000 },
  },
};

const DEFAULT_MINIMUM_SCORE: BudgetThreshold = {
  warn: 90,
  fail: 75,
};

const BAKED_IMAGE_WARN_BYTES = 5_000_000;

const normalizeThreshold = (
  value: BudgetThreshold | number | undefined,
  fallback: BudgetThreshold,
) => {
  if (typeof value === "number") {
    return {
      warn: value,
      fail: Math.round(value * 1.3),
    };
  }

  if (value && typeof value.warn === "number" && typeof value.fail === "number") {
    return value;
  }

  return fallback;
};

const SCRIPT_TAG_PATTERN = /<script\b[^>]*>/giu;
const LINK_TAG_PATTERN = /<link\b[^>]*>/giu;
const TYPE_ATTRIBUTE_PATTERN = /\btype=(["'])(.*?)\1/iu;
const REL_ATTRIBUTE_PATTERN = /\brel=(["'])(.*?)\1/iu;
const SRC_ATTRIBUTE_PATTERN = /\bsrc=(["'])(.*?)\1/iu;
const HREF_ATTRIBUTE_PATTERN = /\bhref=(["'])(.*?)\1/iu;

const collectInitialAssetReferences = (html: string): string[] => {
  const references = new Set<string>();

  for (const match of html.matchAll(SCRIPT_TAG_PATTERN)) {
    const tag = match[0];
    const type = TYPE_ATTRIBUTE_PATTERN.exec(tag)?.[2]?.trim().toLowerCase();
    if (type !== "module") {
      continue;
    }

    const source = SRC_ATTRIBUTE_PATTERN.exec(tag)?.[2]?.trim();
    if (source) {
      references.add(source);
    }
  }

  for (const match of html.matchAll(LINK_TAG_PATTERN)) {
    const tag = match[0];
    const relValue = REL_ATTRIBUTE_PATTERN.exec(tag)?.[2]?.trim().toLowerCase();
    if (!relValue) {
      continue;
    }

    const relTokens = relValue.split(/\s+/u);
    if (!relTokens.some((token) => token === "stylesheet" || token === "modulepreload")) {
      continue;
    }

    const href = HREF_ATTRIBUTE_PATTERN.exec(tag)?.[2]?.trim();
    if (href) {
      references.add(href);
    }
  }

  return Array.from(references);
};

const resolveDistAssetPath = (distDir: string, assetReference: string): string | null => {
  const trimmedReference = assetReference.trim();
  if (trimmedReference.length === 0 || trimmedReference.startsWith("data:")) {
    return null;
  }

  const pathname = new URL(trimmedReference, "https://openlinks.local").pathname;
  const segments = pathname
    .replace(/^\/+/u, "")
    .split("/")
    .filter((segment) => segment.length > 0);

  for (let index = 0; index < segments.length; index += 1) {
    const candidate = path.join(distDir, ...segments.slice(index));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
};

const collectBundleMetrics = (rootDir: string): BundleMetrics | null => {
  const distDir = path.join(rootDir, "dist");
  const cachedContentImagesDir = path.join(distDir, "cache", "content-images");
  const indexPath = path.join(distDir, "index.html");

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const htmlBytes = fs.statSync(indexPath).size;
  const assetFiles = collectInitialAssetReferences(html)
    .map((reference) => resolveDistAssetPath(distDir, reference))
    .filter((assetPath): assetPath is string => assetPath !== null);

  let totalAssetBytes = 0;
  let jsBytes = 0;
  let cssBytes = 0;
  let largestAssetBytes = 0;
  let bakedImageBytes = 0;

  for (const assetPath of assetFiles) {
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
  }

  if (fs.existsSync(cachedContentImagesDir)) {
    const cachedImageFiles = fs
      .readdirSync(cachedContentImagesDir)
      .map((name) => path.join(cachedContentImagesDir, name));
    for (const cachedImagePath of cachedImageFiles) {
      if (!fs.statSync(cachedImagePath).isFile()) {
        continue;
      }
      bakedImageBytes += fs.statSync(cachedImagePath).size;
    }
  }

  return {
    totalBytes: htmlBytes + totalAssetBytes,
    htmlBytes,
    jsBytes,
    cssBytes,
    largestAssetBytes,
    bakedImageBytes,
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
  advisoryOnly: boolean,
  strict: boolean,
  profileName: "mobile" | "desktop",
  profileBudget: PerformanceProfileBudget | undefined,
  metrics: BundleMetrics,
) => {
  const issueStartIndex = issues.length;
  const defaults = DEFAULT_BUDGETS[profileName];
  const thresholds = {
    totalBytes: normalizeThreshold(profileBudget?.totalBytes, defaults.totalBytes),
    htmlBytes: normalizeThreshold(profileBudget?.htmlBytes, defaults.htmlBytes),
    jsBytes: normalizeThreshold(profileBudget?.jsBytes, defaults.jsBytes),
    cssBytes: normalizeThreshold(profileBudget?.cssBytes, defaults.cssBytes),
    largestAssetBytes: normalizeThreshold(
      profileBudget?.largestAssetBytes,
      defaults.largestAssetBytes,
    ),
  };

  for (const metric of Object.keys(thresholds) as Array<keyof typeof thresholds>) {
    const actual = metrics[metric];
    const threshold = thresholds[metric];

    if (actual > threshold.fail) {
      issues.push({
        domain: "performance",
        level: advisoryOnly ? "warning" : "error",
        code: "PERF_BUDGET_FAIL",
        scope: profileName,
        metric,
        actual,
        expected: threshold.fail,
        message: `${profileName} ${metricLabel(metric)} exceeded fail budget (${actual} > ${threshold.fail}).`,
        remediation: `Reduce ${metricLabel(metric)} for '${profileName}' profile or adjust quality.performance.profiles.${profileName}.${metric}.`,
      });
      return;
    }

    if (actual > threshold.warn) {
      const escalated = strict && !advisoryOnly;
      issues.push({
        domain: "performance",
        level: escalated ? "error" : "warning",
        code: escalated ? "PERF_BUDGET_WARN_ESCALATED" : "PERF_BUDGET_WARN",
        scope: profileName,
        metric,
        actual,
        expected: threshold.warn,
        message: `${profileName} ${metricLabel(metric)} exceeded warn budget (${actual} > ${threshold.warn}).`,
        remediation: `Optimize ${metricLabel(metric)} or raise warning threshold in quality.performance.profiles.${profileName}.${metric}.`,
      });
    }
  }

  const profileIssues = issues
    .slice(issueStartIndex)
    .filter((issue) => issue.scope === profileName);
  const errorCount = profileIssues.filter((issue) => issue.level === "error").length;
  const warningCount = profileIssues.filter((issue) => issue.level === "warning").length;
  const score = Math.max(0, 100 - errorCount * 18 - warningCount * 7);
  const minimumScoreThreshold = normalizeThreshold(
    profileBudget?.minimumScore,
    DEFAULT_MINIMUM_SCORE,
  );

  if (score < minimumScoreThreshold.fail) {
    issues.push({
      domain: "performance",
      level: advisoryOnly ? "warning" : "error",
      code: "PERF_PROFILE_SCORE_FAIL",
      scope: profileName,
      metric: "minimumScore",
      actual: score,
      expected: minimumScoreThreshold.fail,
      message: `${profileName} aggregate performance score (${score}) is below fail threshold (${minimumScoreThreshold.fail}).`,
      remediation: `Reduce performance-budget violations or lower quality.performance.profiles.${profileName}.minimumScore thresholds.`,
    });
    return;
  }

  if (score < minimumScoreThreshold.warn) {
    const escalated = strict && !advisoryOnly;
    issues.push({
      domain: "performance",
      level: escalated ? "error" : "warning",
      code: escalated ? "PERF_PROFILE_SCORE_WARN_ESCALATED" : "PERF_PROFILE_SCORE_WARN",
      scope: profileName,
      metric: "minimumScore",
      actual: score,
      expected: minimumScoreThreshold.warn,
      message: `${profileName} aggregate performance score (${score}) is below warning threshold (${minimumScoreThreshold.warn}).`,
      remediation: `Improve performance metrics or tune quality.performance.profiles.${profileName}.minimumScore thresholds.`,
    });
  }
};

export const runPerformanceChecks = ({
  advisoryOnly = false,
  rootDir,
  strict,
  site,
}: RunPerformanceChecksInput): QualityDomainResult => {
  const issues: QualityIssue[] = [];
  const metrics = collectBundleMetrics(rootDir);

  if (!metrics) {
    issues.push({
      domain: "performance",
      level: "error",
      code: "PERF_DIST_MISSING",
      message: "dist/index.html is missing. Performance checks require a production build output.",
      remediation:
        "Run `npm run build` before `npm run quality:check` or ensure CI required lane builds before quality checks.",
    });

    return {
      domain: "performance",
      status: "fail",
      summary: "Performance checks failed because build artifacts are missing.",
      issues,
    };
  }

  const perfConfig = site.quality?.performance;
  const mobileBudget = perfConfig?.profiles?.mobile;
  const desktopBudget = perfConfig?.profiles?.desktop;

  evaluateProfile(issues, advisoryOnly, strict, "mobile", mobileBudget, metrics);
  evaluateProfile(issues, advisoryOnly, strict, "desktop", desktopBudget, metrics);

  if (metrics.bakedImageBytes > BAKED_IMAGE_WARN_BYTES) {
    issues.push({
      domain: "performance",
      level: "warning",
      code: "PERF_BAKED_IMAGE_BYTES_WARN",
      metric: "bakedImageBytes",
      actual: metrics.bakedImageBytes,
      expected: BAKED_IMAGE_WARN_BYTES,
      message: `Baked image bytes in dist/cache/content-images exceeded warning threshold (${metrics.bakedImageBytes} > ${BAKED_IMAGE_WARN_BYTES}).`,
      remediation:
        "Optimize remote image sources or reduce baked image count/size. This warning is non-blocking and does not escalate in strict mode.",
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
    issues,
  };
};
