export interface LinksPayload {
  links?: unknown[];
}

export interface ContentImageCliArgs {
  force: boolean;
  linksPath: string;
  sitePath: string;
  richMetadataPath: string;
  manifestPath: string;
  runtimeManifestPath: string;
  outputDir: string;
  maxBytesWarn: number;
}
