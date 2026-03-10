export interface ShareLinkInput {
  text?: string;
  title: string;
  url: string;
}

export interface ShareLinkResult {
  message: string;
  status: "copied" | "dismissed" | "failed" | "shared";
}

const fallbackCopyText = (value: string): boolean => {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.inset = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
};

const copyToClipboard = async (value: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return fallbackCopyText(value);
    }
  }

  return fallbackCopyText(value);
};

const toSharePayload = (input: ShareLinkInput): ShareData => {
  const payload: ShareData = {
    title: input.title,
    url: input.url,
  };

  if (typeof input.text === "string" && input.text.trim().length > 0) {
    payload.text = input.text.trim();
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

export const shareLink = async (input: ShareLinkInput): Promise<ShareLinkResult> => {
  const payload = toSharePayload(input);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const canShare = typeof navigator.canShare === "function" ? navigator.canShare(payload) : true;

    if (canShare) {
      try {
        await navigator.share(payload);
        return {
          message: "Share opened",
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

  const copied = await copyToClipboard(input.url);
  return copied
    ? {
        message: "Link copied",
        status: "copied",
      }
    : {
        message: "Share failed",
        status: "failed",
      };
};
