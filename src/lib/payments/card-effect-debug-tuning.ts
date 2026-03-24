export type PaymentCardEffectDebugPhase = "low" | "mid" | "max";
export type PaymentCardEffectDebugGroupId = "ambient" | "lightning" | "glitter" | "wash";
export type PaymentCardEffectDebugMetricId =
  | "count"
  | "opacity"
  | "size"
  | "duration"
  | "drift"
  | "wash";

export interface PaymentCardEffectDebugCurve {
  low: number;
  mid: number;
  max: number;
}

export interface PaymentCardEffectAmbientDebugTuning {
  count: PaymentCardEffectDebugCurve;
  opacity: PaymentCardEffectDebugCurve;
  size: PaymentCardEffectDebugCurve;
  duration: PaymentCardEffectDebugCurve;
  drift: PaymentCardEffectDebugCurve;
}

export interface PaymentCardEffectLightningDebugTuning {
  count: PaymentCardEffectDebugCurve;
  opacity: PaymentCardEffectDebugCurve;
  size: PaymentCardEffectDebugCurve;
  duration: PaymentCardEffectDebugCurve;
}

export interface PaymentCardEffectGlitterDebugTuning {
  count: PaymentCardEffectDebugCurve;
  opacity: PaymentCardEffectDebugCurve;
  size: PaymentCardEffectDebugCurve;
  duration: PaymentCardEffectDebugCurve;
  drift: PaymentCardEffectDebugCurve;
}

export interface PaymentCardEffectDebugTuning {
  ambient: PaymentCardEffectAmbientDebugTuning;
  lightning: PaymentCardEffectLightningDebugTuning;
  glitter: PaymentCardEffectGlitterDebugTuning;
  wash: PaymentCardEffectDebugCurve;
}

type ParticleFamilyGroupId = "ambient" | "glitter";
type ParticleFamilyMetricId = keyof PaymentCardEffectAmbientDebugTuning;
type LightningMetricId = keyof PaymentCardEffectLightningDebugTuning;

export interface PaymentCardEffectDebugPhaseDefinition {
  id: PaymentCardEffectDebugPhase;
  label: string;
}

export interface PaymentCardEffectDebugMetricDefinition {
  groupId: PaymentCardEffectDebugGroupId;
  metricId: PaymentCardEffectDebugMetricId;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface PaymentCardEffectDebugGroupDefinition {
  id: PaymentCardEffectDebugGroupId;
  label: string;
  description: string;
  metrics: readonly PaymentCardEffectDebugMetricDefinition[];
}

export const PAYMENT_CARD_EFFECT_DEBUG_PHASES: readonly PaymentCardEffectDebugPhaseDefinition[] = [
  { id: "low", label: "Low" },
  { id: "mid", label: "Mid" },
  { id: "max", label: "Max" },
] as const;

export const PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS = {
  ambient: 7,
  lightning: 6,
  glitter: 7,
} as const;

const createMetricDefinition = ({
  groupId,
  metricId,
  label,
  min,
  max,
  step,
}: PaymentCardEffectDebugMetricDefinition): PaymentCardEffectDebugMetricDefinition => ({
  groupId,
  metricId,
  label,
  min,
  max,
  step,
});

export const PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS: PaymentCardEffectDebugTuning = {
  ambient: {
    count: {
      low: 1,
      mid: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.ambient,
      max: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.ambient,
    },
    opacity: {
      low: 0.18,
      mid: 1,
      max: 1.4,
    },
    size: {
      low: 0.78,
      mid: 1,
      max: 1.18,
    },
    duration: {
      low: 1.55,
      mid: 1,
      max: 0.62,
    },
    drift: {
      low: 0.2,
      mid: 1,
      max: 1.6,
    },
  },
  lightning: {
    count: {
      low: 1,
      mid: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.lightning,
      max: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.lightning,
    },
    opacity: {
      low: 0.18,
      mid: 1,
      max: 1.4,
    },
    size: {
      low: 0.78,
      mid: 1,
      max: 1.18,
    },
    duration: {
      low: 1.55,
      mid: 1,
      max: 0.62,
    },
  },
  glitter: {
    count: {
      low: 1,
      mid: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.glitter,
      max: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.glitter,
    },
    opacity: {
      low: 0.18,
      mid: 1,
      max: 1.4,
    },
    size: {
      low: 0.78,
      mid: 1,
      max: 1.18,
    },
    duration: {
      low: 1.55,
      mid: 1,
      max: 0.62,
    },
    drift: {
      low: 0.2,
      mid: 1,
      max: 1.6,
    },
  },
  wash: {
    low: 0.12,
    mid: 0.8,
    max: 1.45,
  },
};

export const PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS: readonly PaymentCardEffectDebugGroupDefinition[] =
  [
    {
      id: "ambient",
      label: "Ambient",
      description: "Tune the softer floating particle layer.",
      metrics: [
        createMetricDefinition({
          groupId: "ambient",
          metricId: "count",
          label: "Count",
          min: 0,
          max: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.ambient,
          step: 1,
        }),
        createMetricDefinition({
          groupId: "ambient",
          metricId: "opacity",
          label: "Opacity",
          min: 0,
          max: 2,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "ambient",
          metricId: "size",
          label: "Size",
          min: 0.25,
          max: 2,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "ambient",
          metricId: "duration",
          label: "Duration",
          min: 0.25,
          max: 2.5,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "ambient",
          metricId: "drift",
          label: "Drift",
          min: 0,
          max: 3,
          step: 0.01,
        }),
      ],
    },
    {
      id: "lightning",
      label: "Lightning",
      description: "Control the electric streak intensity and pacing.",
      metrics: [
        createMetricDefinition({
          groupId: "lightning",
          metricId: "count",
          label: "Count",
          min: 0,
          max: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.lightning,
          step: 1,
        }),
        createMetricDefinition({
          groupId: "lightning",
          metricId: "opacity",
          label: "Opacity",
          min: 0,
          max: 2,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "lightning",
          metricId: "size",
          label: "Size",
          min: 0.25,
          max: 2,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "lightning",
          metricId: "duration",
          label: "Duration",
          min: 0.25,
          max: 2.5,
          step: 0.01,
        }),
      ],
    },
    {
      id: "glitter",
      label: "Glitter",
      description: "Adjust the celebratory sparkle layer separately from ambient drift.",
      metrics: [
        createMetricDefinition({
          groupId: "glitter",
          metricId: "count",
          label: "Count",
          min: 0,
          max: PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS.glitter,
          step: 1,
        }),
        createMetricDefinition({
          groupId: "glitter",
          metricId: "opacity",
          label: "Opacity",
          min: 0,
          max: 2,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "glitter",
          metricId: "size",
          label: "Size",
          min: 0.25,
          max: 2,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "glitter",
          metricId: "duration",
          label: "Duration",
          min: 0.25,
          max: 2.5,
          step: 0.01,
        }),
        createMetricDefinition({
          groupId: "glitter",
          metricId: "drift",
          label: "Drift",
          min: 0,
          max: 3,
          step: 0.01,
        }),
      ],
    },
    {
      id: "wash",
      label: "Wash",
      description: "Set the shared background wash opacity curve.",
      metrics: [
        createMetricDefinition({
          groupId: "wash",
          metricId: "wash",
          label: "Opacity",
          min: 0,
          max: 2,
          step: 0.01,
        }),
      ],
    },
  ] as const;

const PAYMENT_CARD_EFFECT_DEBUG_TUNING_METRICS = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS.flatMap(
  (group) => group.metrics,
);

const cloneCurve = (curve: PaymentCardEffectDebugCurve): PaymentCardEffectDebugCurve => ({
  low: curve.low,
  mid: curve.mid,
  max: curve.max,
});

const roundToStep = (value: number, step: number): number =>
  step === 1 ? Math.round(value) : Number(value.toFixed(2));

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeMetricValue = (
  value: number,
  definition: PaymentCardEffectDebugMetricDefinition,
): number => roundToStep(clampNumber(value, definition.min, definition.max), definition.step);

const normalizeCountCurve = (
  curve: PaymentCardEffectDebugCurve,
  groupId: "ambient" | "lightning" | "glitter",
): PaymentCardEffectDebugCurve => {
  const countLimit = PAYMENT_CARD_EFFECT_DEBUG_COUNT_LIMITS[groupId];
  const low = normalizeMetricValue(curve.low, {
    groupId,
    metricId: "count",
    label: "Count",
    min: 0,
    max: countLimit,
    step: 1,
  });
  const mid = normalizeMetricValue(clampNumber(curve.mid, low, countLimit), {
    groupId,
    metricId: "count",
    label: "Count",
    min: low,
    max: countLimit,
    step: 1,
  });
  const max = normalizeMetricValue(clampNumber(curve.max, mid, countLimit), {
    groupId,
    metricId: "count",
    label: "Count",
    min: mid,
    max: countLimit,
    step: 1,
  });

  return {
    low,
    mid,
    max,
  };
};

const normalizeCurve = (
  curve: PaymentCardEffectDebugCurve,
  definition: PaymentCardEffectDebugMetricDefinition,
): PaymentCardEffectDebugCurve => ({
  low: normalizeMetricValue(curve.low, definition),
  mid: normalizeMetricValue(curve.mid, definition),
  max: normalizeMetricValue(curve.max, definition),
});

export const clonePaymentCardEffectDebugTuning = (
  tuning: PaymentCardEffectDebugTuning = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS,
): PaymentCardEffectDebugTuning => ({
  ambient: {
    count: cloneCurve(tuning.ambient.count),
    opacity: cloneCurve(tuning.ambient.opacity),
    size: cloneCurve(tuning.ambient.size),
    duration: cloneCurve(tuning.ambient.duration),
    drift: cloneCurve(tuning.ambient.drift),
  },
  lightning: {
    count: cloneCurve(tuning.lightning.count),
    opacity: cloneCurve(tuning.lightning.opacity),
    size: cloneCurve(tuning.lightning.size),
    duration: cloneCurve(tuning.lightning.duration),
  },
  glitter: {
    count: cloneCurve(tuning.glitter.count),
    opacity: cloneCurve(tuning.glitter.opacity),
    size: cloneCurve(tuning.glitter.size),
    duration: cloneCurve(tuning.glitter.duration),
    drift: cloneCurve(tuning.glitter.drift),
  },
  wash: cloneCurve(tuning.wash),
});

export const resolvePaymentCardEffectDebugQueryParam = ({
  groupId,
  metricId,
  phase,
}: {
  groupId: PaymentCardEffectDebugGroupId;
  metricId: PaymentCardEffectDebugMetricId;
  phase: PaymentCardEffectDebugPhase;
}): string => (groupId === "wash" ? `wash-${phase}` : `${groupId}-${metricId}-${phase}`);

export const getPaymentCardEffectDebugTuningValue = ({
  tuning,
  groupId,
  metricId,
  phase,
}: {
  tuning: PaymentCardEffectDebugTuning;
  groupId: PaymentCardEffectDebugGroupId;
  metricId: PaymentCardEffectDebugMetricId;
  phase: PaymentCardEffectDebugPhase;
}): number => {
  if (groupId === "wash" && metricId === "wash") {
    return tuning.wash[phase];
  }

  if (groupId === "ambient" || groupId === "glitter") {
    return tuning[groupId][metricId as ParticleFamilyMetricId][phase];
  }

  return tuning.lightning[metricId as LightningMetricId][phase];
};

const setCurvePhaseValue = ({
  curve,
  phase,
  value,
}: {
  curve: PaymentCardEffectDebugCurve;
  phase: PaymentCardEffectDebugPhase;
  value: number;
}): PaymentCardEffectDebugCurve => ({
  ...curve,
  [phase]: value,
});

export const setPaymentCardEffectDebugTuningValue = ({
  tuning,
  groupId,
  metricId,
  phase,
  value,
}: {
  tuning: PaymentCardEffectDebugTuning;
  groupId: PaymentCardEffectDebugGroupId;
  metricId: PaymentCardEffectDebugMetricId;
  phase: PaymentCardEffectDebugPhase;
  value: number;
}): PaymentCardEffectDebugTuning => {
  const next = clonePaymentCardEffectDebugTuning(tuning);

  if (groupId === "wash" && metricId === "wash") {
    next.wash = setCurvePhaseValue({
      curve: next.wash,
      phase,
      value,
    });
    return resolvePaymentCardEffectDebugTuning(next);
  }

  if (groupId === "ambient" || groupId === "glitter") {
    next[groupId][metricId as ParticleFamilyMetricId] = setCurvePhaseValue({
      curve: next[groupId][metricId as ParticleFamilyMetricId],
      phase,
      value,
    });
    return resolvePaymentCardEffectDebugTuning(next);
  }

  next.lightning[metricId as LightningMetricId] = setCurvePhaseValue({
    curve: next.lightning[metricId as LightningMetricId],
    phase,
    value,
  });
  return resolvePaymentCardEffectDebugTuning(next);
};

export const resolvePaymentCardEffectDebugTuning = (
  tuning: PaymentCardEffectDebugTuning = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS,
): PaymentCardEffectDebugTuning => {
  const ambientCountDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[0]?.metrics[0];
  const ambientOpacityDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[0]?.metrics[1];
  const ambientSizeDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[0]?.metrics[2];
  const ambientDurationDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[0]?.metrics[3];
  const ambientDriftDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[0]?.metrics[4];
  const lightningCountDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[1]?.metrics[0];
  const lightningOpacityDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[1]?.metrics[1];
  const lightningSizeDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[1]?.metrics[2];
  const lightningDurationDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[1]?.metrics[3];
  const glitterCountDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[2]?.metrics[0];
  const glitterOpacityDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[2]?.metrics[1];
  const glitterSizeDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[2]?.metrics[2];
  const glitterDurationDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[2]?.metrics[3];
  const glitterDriftDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[2]?.metrics[4];
  const washDefinition = PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS[3]?.metrics[0];

  if (
    !ambientCountDefinition ||
    !ambientOpacityDefinition ||
    !ambientSizeDefinition ||
    !ambientDurationDefinition ||
    !ambientDriftDefinition ||
    !lightningCountDefinition ||
    !lightningOpacityDefinition ||
    !lightningSizeDefinition ||
    !lightningDurationDefinition ||
    !glitterCountDefinition ||
    !glitterOpacityDefinition ||
    !glitterSizeDefinition ||
    !glitterDurationDefinition ||
    !glitterDriftDefinition ||
    !washDefinition
  ) {
    return clonePaymentCardEffectDebugTuning(PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS);
  }

  return {
    ambient: {
      count: normalizeCountCurve(tuning.ambient.count, "ambient"),
      opacity: normalizeCurve(tuning.ambient.opacity, ambientOpacityDefinition),
      size: normalizeCurve(tuning.ambient.size, ambientSizeDefinition),
      duration: normalizeCurve(tuning.ambient.duration, ambientDurationDefinition),
      drift: normalizeCurve(tuning.ambient.drift, ambientDriftDefinition),
    },
    lightning: {
      count: normalizeCountCurve(tuning.lightning.count, "lightning"),
      opacity: normalizeCurve(tuning.lightning.opacity, lightningOpacityDefinition),
      size: normalizeCurve(tuning.lightning.size, lightningSizeDefinition),
      duration: normalizeCurve(tuning.lightning.duration, lightningDurationDefinition),
    },
    glitter: {
      count: normalizeCountCurve(tuning.glitter.count, "glitter"),
      opacity: normalizeCurve(tuning.glitter.opacity, glitterOpacityDefinition),
      size: normalizeCurve(tuning.glitter.size, glitterSizeDefinition),
      duration: normalizeCurve(tuning.glitter.duration, glitterDurationDefinition),
      drift: normalizeCurve(tuning.glitter.drift, glitterDriftDefinition),
    },
    wash: normalizeCurve(tuning.wash, washDefinition),
  };
};

export const arePaymentCardEffectDebugTuningsEqual = (
  left: PaymentCardEffectDebugTuning,
  right: PaymentCardEffectDebugTuning,
): boolean =>
  PAYMENT_CARD_EFFECT_DEBUG_TUNING_METRICS.every((metric) =>
    PAYMENT_CARD_EFFECT_DEBUG_PHASES.every(
      (phase) =>
        getPaymentCardEffectDebugTuningValue({
          tuning: left,
          groupId: metric.groupId,
          metricId: metric.metricId,
          phase: phase.id,
        }) ===
        getPaymentCardEffectDebugTuningValue({
          tuning: right,
          groupId: metric.groupId,
          metricId: metric.metricId,
          phase: phase.id,
        }),
    ),
  );

export const resetPaymentCardEffectDebugTuningGroup = ({
  tuning,
  groupId,
}: {
  tuning: PaymentCardEffectDebugTuning;
  groupId: PaymentCardEffectDebugGroupId;
}): PaymentCardEffectDebugTuning => {
  const next = clonePaymentCardEffectDebugTuning(tuning);

  if (groupId === "wash") {
    next.wash = cloneCurve(PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS.wash);
    return next;
  }

  if (groupId === "ambient") {
    next.ambient = clonePaymentCardEffectDebugTuning(
      PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS,
    ).ambient;
    return next;
  }

  if (groupId === "lightning") {
    next.lightning = clonePaymentCardEffectDebugTuning(
      PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS,
    ).lightning;
    return next;
  }

  next.glitter = clonePaymentCardEffectDebugTuning(
    PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS,
  ).glitter;
  return next;
};

export const isDefaultPaymentCardEffectDebugTuning = (
  tuning: PaymentCardEffectDebugTuning,
): boolean =>
  arePaymentCardEffectDebugTuningsEqual(
    resolvePaymentCardEffectDebugTuning(tuning),
    PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS,
  );

export const isDefaultPaymentCardEffectDebugTuningGroup = ({
  tuning,
  groupId,
}: {
  tuning: PaymentCardEffectDebugTuning;
  groupId: PaymentCardEffectDebugGroupId;
}): boolean => {
  const resetGroup = resetPaymentCardEffectDebugTuningGroup({
    tuning,
    groupId,
  });

  return arePaymentCardEffectDebugTuningsEqual(
    resolvePaymentCardEffectDebugTuning(tuning),
    resolvePaymentCardEffectDebugTuning(resetGroup),
  );
};

export const formatPaymentCardEffectDebugMetricValue = ({
  metric,
  value,
}: {
  metric: Pick<PaymentCardEffectDebugMetricDefinition, "step">;
  value: number;
}): string => (metric.step === 1 ? String(Math.round(value)) : value.toFixed(2));
