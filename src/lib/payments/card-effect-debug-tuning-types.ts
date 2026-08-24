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

export type ParticleFamilyGroupId = "ambient" | "glitter";
export type ParticleFamilyMetricId = keyof PaymentCardEffectAmbientDebugTuning;
export type LightningMetricId = keyof PaymentCardEffectLightningDebugTuning;

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
