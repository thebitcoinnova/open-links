import assert from "node:assert/strict";
import test from "node:test";
import {
  type AnimatedPageSwapItem,
  resolveAnimatedPageSwapItems,
  settleAnimatedPageSwapItem,
} from "./AnimatedPageSwap";

test("resolveAnimatedPageSwapItems marks the current view exiting and the next view entering", () => {
  const current: AnimatedPageSwapItem<"analytics" | "links">[] = [
    { id: 0, key: "links", stage: "entered" },
  ];

  assert.deepEqual(resolveAnimatedPageSwapItems(current, "analytics", 1), [
    { id: 0, key: "links", stage: "exiting" },
    { id: 1, key: "analytics", stage: "entering" },
  ]);
});

test("resolveAnimatedPageSwapItems revives an exiting view when toggled back quickly", () => {
  const current: AnimatedPageSwapItem<"analytics" | "links">[] = [
    { id: 0, key: "links", stage: "exiting" },
    { id: 1, key: "analytics", stage: "entering" },
  ];

  assert.deepEqual(resolveAnimatedPageSwapItems(current, "links", 2), [
    { id: 1, key: "analytics", stage: "exiting" },
    { id: 0, key: "links", stage: "entering" },
  ]);
});

test("settleAnimatedPageSwapItem promotes entering views to entered", () => {
  const current: AnimatedPageSwapItem<"analytics" | "links">[] = [
    { id: 0, key: "links", stage: "exiting" },
    { id: 1, key: "analytics", stage: "entering" },
  ];

  assert.deepEqual(settleAnimatedPageSwapItem(current, 1), [
    { id: 0, key: "links", stage: "exiting" },
    { id: 1, key: "analytics", stage: "entered" },
  ]);
});

test("settleAnimatedPageSwapItem removes exiting views after their animation completes", () => {
  const current: AnimatedPageSwapItem<"analytics" | "links">[] = [
    { id: 0, key: "links", stage: "exiting" },
    { id: 1, key: "analytics", stage: "entered" },
  ];

  assert.deepEqual(settleAnimatedPageSwapItem(current, 0), [
    { id: 1, key: "analytics", stage: "entered" },
  ]);
});
