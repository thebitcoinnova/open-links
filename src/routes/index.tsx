import { createEffect, onCleanup, onMount } from "solid-js";
import { toast } from "solid-sonner";
import {
  applyThemeState,
  applyTypographyState,
  resolveInitialMode,
} from "../lib/theme/mode-controller";
import { registerActionToastClient } from "../lib/ui/action-toast";
import RouteIndexView from "./RouteIndexView";
import {
  applySeoMetadata,
  brandIconOptions,
  layout,
  modePolicy,
  themeSelection,
  typography,
} from "./index-route-config";
import { createRouteIndexController } from "./index-route-controller";

registerActionToastClient({
  default: (message) => toast(message),
  error: (message) => toast.error(message),
});

export default function RouteIndex() {
  const controller = createRouteIndexController();

  onMount(() => {
    controller.syncConnectivityState();
    controller.setMode(resolveInitialMode(modePolicy));
    applySeoMetadata();
    controller.syncAnalyticsStateFromLocation();
    window.addEventListener("online", controller.syncConnectivityState);
    window.addEventListener("offline", controller.syncConnectivityState);
    window.addEventListener("popstate", controller.syncAnalyticsStateFromLocation);
  });

  onCleanup(() => {
    if (typeof window === "undefined") return;
    window.removeEventListener("online", controller.syncConnectivityState);
    window.removeEventListener("offline", controller.syncConnectivityState);
    window.removeEventListener("popstate", controller.syncAnalyticsStateFromLocation);
  });

  createEffect(() => {
    applyThemeState({
      themeId: themeSelection.active,
      mode: controller.mode(),
      policy: modePolicy,
      density: layout.density,
      brandIconSizeMode: brandIconOptions.sizeMode,
    });
    applyTypographyState(typography);
  });

  return <RouteIndexView controller={controller} />;
}
