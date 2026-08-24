const asRecord = (input: unknown) =>
  input && typeof input === "object" ? (input as Record<string, unknown>) : Object.create(null);

const mergeTrackedDeploymentTargetsInput = (
  defaultsTargetsInput: unknown,
  overlayTargetsInput: unknown,
) => {
  const defaultsTargets = asRecord(defaultsTargetsInput);
  const overlayTargets = asRecord(overlayTargetsInput);

  return {
    ...defaultsTargets,
    ...overlayTargets,
    aws: {
      ...asRecord(defaultsTargets.aws),
      ...asRecord(overlayTargets.aws),
    },
    "github-pages": {
      ...asRecord(defaultsTargets["github-pages"]),
      ...asRecord(overlayTargets["github-pages"]),
    },
    render: {
      ...asRecord(defaultsTargets.render),
      ...asRecord(overlayTargets.render),
    },
    railway: {
      ...asRecord(defaultsTargets.railway),
      ...asRecord(overlayTargets.railway),
    },
  };
};

export function mergeTrackedDeploymentConfigInputs(
  defaultsInput: unknown,
  maybeOverlayInput?: unknown,
) {
  const defaultsConfig = asRecord(defaultsInput);

  if (!maybeOverlayInput || typeof maybeOverlayInput !== "object") {
    return defaultsConfig;
  }

  const overlayConfig = asRecord(maybeOverlayInput);

  return {
    ...defaultsConfig,
    ...overlayConfig,
    targets: mergeTrackedDeploymentTargetsInput(defaultsConfig.targets, overlayConfig.targets),
  };
}
