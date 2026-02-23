export type QualityDomain = "seo" | "accessibility" | "performance" | "manual-smoke";
export type QualityIssueLevel = "error" | "warning";

export interface QualityIssue {
  domain: QualityDomain;
  level: QualityIssueLevel;
  code: string;
  message: string;
  remediation: string;
  scope?: string;
  metric?: string;
  actual?: number | string;
  expected?: number | string;
}

export interface QualityDomainResult {
  domain: QualityDomain;
  status: "pass" | "warn" | "fail";
  summary: string;
  issues: QualityIssue[];
}

export interface QualityRunResult {
  strict: boolean;
  generatedAt: string;
  success: boolean;
  reportPath: string;
  blockingDomains: QualityDomain[];
  domainResults: QualityDomainResult[];
  errors: QualityIssue[];
  warnings: QualityIssue[];
  checklist: ManualSmokeCheckResult[];
  remediationChecklist: Record<string, string[]>;
}

export interface ManualSmokeCheckResult {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  details: string;
  remediation?: string;
}

export interface QualitySeoMetadata {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogType: string;
  ogImage: string;
  ogUrl: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
}

export interface QualitySeoConfig {
  canonicalBaseUrl?: string;
  socialImageFallback?: string;
  defaults?: Partial<QualitySeoMetadata>;
  overrides?: {
    profile?: Partial<QualitySeoMetadata>;
  };
}

export interface QualityAccessibilityConfig {
  focusContrastStrict?: boolean;
  manualSmokeChecks?: string[];
}

export interface BudgetThreshold {
  warn: number;
  fail: number;
}

export interface PerformanceProfileBudget {
  totalBytes?: BudgetThreshold | number;
  jsBytes?: BudgetThreshold | number;
  cssBytes?: BudgetThreshold | number;
  htmlBytes?: BudgetThreshold | number;
  largestAssetBytes?: BudgetThreshold | number;
  minimumScore?: BudgetThreshold | number;
}

export interface QualityPerformanceConfig {
  routes?: string[];
  profiles?: {
    mobile?: PerformanceProfileBudget;
    desktop?: PerformanceProfileBudget;
  };
}

export interface QualityPolicy {
  reportPath?: string;
  blockingDomains?: QualityDomain[];
  seo?: QualitySeoConfig;
  accessibility?: QualityAccessibilityConfig;
  performance?: QualityPerformanceConfig;
}

export interface QualitySiteInput {
  title: string;
  description: string;
  baseUrl?: string;
  quality?: QualityPolicy;
}

export interface QualityProfileInput {
  name?: string;
  bio?: string;
}
