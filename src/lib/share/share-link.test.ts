import assert from "node:assert/strict";
import test from "node:test";
import { resolveDocumentShareUrl, shareLink } from "./share-link";

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

const setNavigator = (value: Navigator) => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
};

const restoreGlobals = () => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  }
  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
  }
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  }
};

test("shareLink prefers native share when available", async () => {
  let sharedPayload: ShareData | undefined;
  setNavigator({
    canShare: () => true,
    share: async (payload: ShareData) => {
      sharedPayload = payload;
    },
  } as unknown as Navigator);

  const result = await shareLink({
    text: "Code, experiments, and open-source projects",
    title: "GitHub",
    url: "https://github.com/pRizz",
  });

  assert.deepEqual(sharedPayload, {
    text: "Code, experiments, and open-source projects",
    title: "GitHub",
    url: "https://github.com/pRizz",
  });
  assert.deepEqual(result, {
    message: "Share opened",
    status: "shared",
  });

  restoreGlobals();
});

test("shareLink returns dismissed when native share is aborted", async () => {
  setNavigator({
    canShare: () => true,
    share: async () => {
      throw new DOMException("cancelled", "AbortError");
    },
  } as unknown as Navigator);

  const result = await shareLink({
    title: "GitHub",
    url: "https://github.com/pRizz",
  });

  assert.deepEqual(result, {
    message: "",
    status: "dismissed",
  });

  restoreGlobals();
});

test("shareLink falls back to clipboard copy when native share is unavailable", async () => {
  let copiedValue = "";
  setNavigator({
    clipboard: {
      writeText: async (value: string) => {
        copiedValue = value;
      },
    } as Clipboard,
  } as unknown as Navigator);

  const result = await shareLink({
    title: "GitHub",
    url: "https://github.com/pRizz",
  });

  assert.equal(copiedValue, "https://github.com/pRizz");
  assert.deepEqual(result, {
    message: "Link copied",
    status: "copied",
  });

  restoreGlobals();
});

test("resolveDocumentShareUrl prefers canonical when present", () => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelector: () => ({
        getAttribute: () => "https://example.com/canonical",
      }),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        href: "https://example.com/fallback",
      },
    },
  });

  assert.equal(resolveDocumentShareUrl(), "https://example.com/canonical");

  restoreGlobals();
});
