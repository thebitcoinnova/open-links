import type { Accessor, Setter } from "solid-js";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import type { PaymentCardEffectDebugTuning } from "../../lib/payments/card-effect-debug-tuning";

export interface PaymentLinkCardProps {
  link: OpenLink;
  site: SiteData;
  interaction?: "minimal";
  brandIconOptions: ResolvedBrandIconOptions;
  themeFingerprint: string;
  effectDebugTuning?: PaymentCardEffectDebugTuning;
}

export interface PaymentLinkCardSignals {
  fullscreenCtaLabel: Accessor<string>;
  fullscreenRailId: Accessor<string | undefined>;
  setFullscreenRailId: Setter<string | undefined>;
  setToggledQrRailIds: Setter<Set<string>>;
  toggledQrRailIds: Accessor<Set<string>>;
}
