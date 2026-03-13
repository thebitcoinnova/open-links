import { copyToClipboard } from "./copy-to-clipboard";

export interface ShareLinkInput {
  copiedMessage?: string;
  failedMessage?: string;
  mode?: "rich" | "url-only";
  sharedMessage?: string;
  text?: string;
  title: string;
  url: string;
}

export interface ShareLinkResult {
  message: string;
  status: "copied" | "dismissed" | "failed" | "shared";
}

export interface CopyLinkInput {
  copiedMessage?: string;
  failedMessage?: string;
  url: string;
}

const toSharePayload = (input: ShareLinkInput): ShareData => {
  const payload: ShareData = {
    url: input.url,
  };

  if (input.mode !== "url-only") {
    payload.title = input.title;
    if (typeof input.text === "string" && input.text.trim().length > 0) {
      payload.text = input.text.trim();
    }
  }

  return payload;
};

export const resolveDocumentShareUrl = (fallback = "/"): string => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const canonicalHref = document
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.getAttribute("href")
    ?.trim();

  if (!canonicalHref) {
    return window.location.href;
  }

  try {
    return new URL(canonicalHref, window.location.href).toString();
  } catch {
    return window.location.href;
  }
};

export const copyLink = async (input: CopyLinkInput): Promise<ShareLinkResult> => {
  const copied = await copyToClipboard(input.url);
  return copied
    ? {
        message: input.copiedMessage ?? "Link copied",
        status: "copied",
      }
    : {
        message: input.failedMessage ?? "Copy failed",
        status: "failed",
      };
};

export const shareLink = async (input: ShareLinkInput): Promise<ShareLinkResult> => {
  const payload = toSharePayload(input);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const canShare = typeof navigator.canShare === "function" ? navigator.canShare(payload) : true;

    if (canShare) {
      try {
        await navigator.share(payload);
        return {
          message: input.sharedMessage ?? "",
          status: "shared",
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return {
            message: "",
            status: "dismissed",
          };
        }
      }
    }
  }

  return copyLink({
    copiedMessage: input.copiedMessage ?? "Link shared",
    failedMessage: input.failedMessage ?? "Share failed",
    url: input.url,
  });
};
