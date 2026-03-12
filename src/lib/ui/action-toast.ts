export interface ToastableActionResult {
  message: string;
  status: "copied" | "dismissed" | "failed" | "shared";
}

type ActionToastVariant = "default" | "error";

export interface ActionToastDescriptor {
  message: string;
  variant: ActionToastVariant;
}

export interface ActionToastClient {
  default: (message: string) => void;
  error: (message: string) => void;
}

export const ACTION_TOAST_OPTIONS = {
  className: "action-toast",
  descriptionClassName: "action-toast-description",
  duration: 2600,
} as const;

const defaultActionToastMessages: Record<
  Exclude<ToastableActionResult["status"], "dismissed">,
  string
> = {
  copied: "Copied",
  failed: "Action failed",
  shared: "",
};

let maybeRegisteredActionToastClient: ActionToastClient | undefined;

export const registerActionToastClient = (client: ActionToastClient) => {
  maybeRegisteredActionToastClient = client;
};

export const clearActionToastClient = () => {
  maybeRegisteredActionToastClient = undefined;
};

export const resolveActionToastDescriptor = (
  maybeResult?: null | ToastableActionResult,
): ActionToastDescriptor | undefined => {
  if (!maybeResult || maybeResult.status === "dismissed") {
    return undefined;
  }

  const message =
    maybeResult.message.trim().length > 0
      ? maybeResult.message.trim()
      : defaultActionToastMessages[maybeResult.status];

  if (message.length === 0) {
    return undefined;
  }

  if (maybeResult.status === "failed") {
    return {
      message,
      variant: "error",
    };
  }

  return {
    message,
    variant: "default",
  };
};

export const showActionToast = (
  maybeResult?: null | ToastableActionResult,
  client: ActionToastClient | undefined = maybeRegisteredActionToastClient,
): boolean => {
  const maybeDescriptor = resolveActionToastDescriptor(maybeResult);

  if (!maybeDescriptor || !client) {
    return false;
  }

  client[maybeDescriptor.variant](maybeDescriptor.message);
  return true;
};
