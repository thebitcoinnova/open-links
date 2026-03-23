import type { Component } from "solid-js";
import { render } from "solid-js/web";
import { registerOfflineSupport } from "./lib/offline/register-service-worker";
import RouteIndex from "./routes/index";
import PlaywrightPaymentQrRoute, {
  PLAYWRIGHT_PAYMENT_QR_PATH,
} from "./routes/playwright-payment-qr";
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
    if (pathname.endsWith(PLAYWRIGHT_PAYMENT_QR_PATH)) {
      return PlaywrightPaymentQrRoute;
    }
  }

  return RouteIndex;
};

registerOfflineSupport();

const RootRoute = resolveRootRoute();
render(() => <RootRoute />, rootElement);
