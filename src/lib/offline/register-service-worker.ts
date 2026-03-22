import { registerSW } from "virtual:pwa-register";

export const registerOfflineSupport = () => {
  if (!import.meta.env.PROD || typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return undefined;
  }

  return registerSW({ immediate: true });
};
