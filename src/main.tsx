import type { Component } from "solid-js";
import { render } from "solid-js/web";
import { registerOfflineSupport } from "./lib/offline/register-service-worker";
import { isPaymentCardEffectRoutePath } from "./lib/payments/card-effect-samples";
import RouteIndex from "./routes/index";
import PaymentCardEffectSamplesRoute from "./routes/payment-card-effect-samples";
import PlaywrightNavigationMenuRoute, {
  PLAYWRIGHT_NAVIGATION_MENU_PATH,
} from "./routes/playwright-navigation-menu";
import PlaywrightPaymentQrRoute, {
  PLAYWRIGHT_PAYMENT_QR_PATH,
} from "./routes/playwright-payment-qr";
import PlaywrightReferralCardRoute, {
  PLAYWRIGHT_REFERRAL_CARD_PATH,
} from "./routes/playwright-referral-card";
import "./styles/base.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Missing root element with id "root".');
}

const normalizePathname = (value: string): string => {
  const normalized = value.replace(/\/+$/u, "");
  return normalized.length > 0 ? normalized : "/";
};

const resolveRootRoute = (): Component => {
  if (typeof window !== "undefined") {
    const pathname = normalizePathname(window.location.pathname);
    if (isPaymentCardEffectRoutePath(pathname)) {
      return PaymentCardEffectSamplesRoute;
    }

    if (pathname.endsWith(PLAYWRIGHT_PAYMENT_QR_PATH)) {
      return PlaywrightPaymentQrRoute;
    }

    if (pathname.endsWith(PLAYWRIGHT_REFERRAL_CARD_PATH)) {
      return PlaywrightReferralCardRoute;
    }

    if (pathname.endsWith(PLAYWRIGHT_NAVIGATION_MENU_PATH)) {
      return PlaywrightNavigationMenuRoute;
    }
  }

  return RouteIndex;
};

registerOfflineSupport();

const RootRoute = resolveRootRoute();
render(() => <RootRoute />, rootElement);
