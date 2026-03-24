import assert from "node:assert/strict";
import test from "node:test";
import {
  readAnalyticsPageState,
  readAnalyticsPageStateFromUrl,
  replaceAnalyticsPageState,
  writeAnalyticsPageState,
} from "./analytics-page-query";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

const restoreWindow = () => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
};

test("readAnalyticsPageStateFromUrl returns true for the analytics query flag", () => {
  assert.equal(readAnalyticsPageStateFromUrl(new URL("https://openlinks.us/?analytics=all")), true);
});

test("readAnalyticsPageStateFromUrl ignores other analytics query values", () => {
  assert.equal(
    readAnalyticsPageStateFromUrl(new URL("https://openlinks.us/?analytics=30d")),
    false,
  );
});

test("readAnalyticsPageStateFromUrl ignores unrelated query params", () => {
  assert.equal(
    readAnalyticsPageStateFromUrl(new URL("https://openlinks.us/?view=analytics")),
    false,
  );
});

test("readAnalyticsPageState reads from the current browser URL", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        href: "https://openlinks.us/?analytics=all",
      },
    },
  });

  assert.equal(readAnalyticsPageState(), true);

  restoreWindow();
});

test("writeAnalyticsPageState adds the analytics query flag to browser history", () => {
  let pushedHref = "";

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      history: {
        pushState(_state: unknown, _title: string, nextUrl: string | URL | null | undefined) {
          pushedHref = String(nextUrl);
        },
      },
      location: {
        href: "https://openlinks.us/?view=links",
      },
    },
  });

  writeAnalyticsPageState(true);

  assert.equal(pushedHref, "https://openlinks.us/?view=links&analytics=all");

  restoreWindow();
});

test("writeAnalyticsPageState removes the analytics query flag when closing analytics", () => {
  let pushedHref = "";

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      history: {
        pushState(_state: unknown, _title: string, nextUrl: string | URL | null | undefined) {
          pushedHref = String(nextUrl);
        },
      },
      location: {
        href: "https://openlinks.us/?view=links&analytics=all",
      },
    },
  });

  writeAnalyticsPageState(false);

  assert.equal(pushedHref, "https://openlinks.us/?view=links");

  restoreWindow();
});

test("replaceAnalyticsPageState removes the analytics query flag without pushing history", () => {
  let replacedHref = "";

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      history: {
        replaceState(_state: unknown, _title: string, nextUrl: string | URL | null | undefined) {
          replacedHref = String(nextUrl);
        },
      },
      location: {
        href: "https://openlinks.us/?analytics=all",
      },
    },
  });

  replaceAnalyticsPageState(false);

  assert.equal(replacedHref, "https://openlinks.us/");

  restoreWindow();
});
