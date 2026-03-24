import { PAYMENT_CARD_EFFECT_EASTER_EGG_PATH } from "../lib/payments/card-effect-samples";
import { resolveBaseAwareAssetPath } from "../lib/seo/resolve-seo-metadata";

export const PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL = "Tip card sparks";

export const resolvePaymentCardEffectGalleryMenuHref = (basePath = "/"): string =>
  resolveBaseAwareAssetPath(PAYMENT_CARD_EFFECT_EASTER_EGG_PATH, basePath);
