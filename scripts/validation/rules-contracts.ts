export interface ValidationIssue {
  level: "error" | "warning";
  strictBlocking?: boolean;
  source: string;
  path: string;
  message: string;
  remediation: string;
}

export interface PolicyInput {
  profile: Record<string, unknown>;
  links: Record<string, unknown>;
  site: Record<string, unknown>;
  sources?: {
    profile: string;
    links: string;
    site: string;
  };
}
