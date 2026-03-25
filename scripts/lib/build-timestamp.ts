interface ResolveStableBuildTimestampOptions {
  explicitValue?: string;
  fallbackNow?: () => string;
}

export function resolveStableBuildTimestamp(options: ResolveStableBuildTimestampOptions = {}) {
  const explicitValue = options.explicitValue?.trim();
  if (explicitValue) {
    return explicitValue;
  }

  return (options.fallbackNow ?? (() => new Date().toISOString()))();
}
