import { For, type JSX, createEffect, createSignal, on } from "solid-js";

export type AnimatedPageSwapStage = "entering" | "entered" | "exiting";

export interface AnimatedPageSwapItem<Key extends string = string> {
  id: number;
  key: Key;
  stage: AnimatedPageSwapStage;
}

export interface AnimatedPageSwapProps<Key extends string> {
  activeKey: Key;
  renderView: (key: Key) => JSX.Element;
}

export const resolveAnimatedPageSwapItems = <Key extends string>(
  items: AnimatedPageSwapItem<Key>[],
  nextActiveKey: Key,
  nextId: number,
): AnimatedPageSwapItem<Key>[] => {
  const maybeNextItem = items.find((item) => item.key === nextActiveKey);

  const nextItems: AnimatedPageSwapItem<Key>[] = items
    .filter((item) => item.id !== maybeNextItem?.id)
    .map((item) => ({
      ...item,
      stage: "exiting" as const,
    }));

  nextItems.push(
    maybeNextItem
      ? {
          ...maybeNextItem,
          stage: "entering" as const,
        }
      : {
          id: nextId,
          key: nextActiveKey,
          stage: "entering" as const,
        },
  );

  return nextItems;
};

export const settleAnimatedPageSwapItem = <Key extends string>(
  items: AnimatedPageSwapItem<Key>[],
  itemId: number,
): AnimatedPageSwapItem<Key>[] => {
  const maybeItem = items.find((item) => item.id === itemId);

  if (!maybeItem) {
    return items;
  }

  if (maybeItem.stage === "exiting") {
    return items.filter((item) => item.id !== itemId);
  }

  if (maybeItem.stage === "entering") {
    return items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            stage: "entered" as const,
          }
        : item,
    );
  }

  return items;
};

export const AnimatedPageSwap = <Key extends string>(props: AnimatedPageSwapProps<Key>) => {
  let nextId = 1;

  const [items, setItems] = createSignal<AnimatedPageSwapItem<Key>[]>([
    {
      id: 0,
      key: props.activeKey,
      stage: "entered",
    },
  ]);

  createEffect(
    on(
      () => props.activeKey,
      (nextKey, previousKey) => {
        if (previousKey === undefined || nextKey === previousKey) {
          return;
        }

        setItems((current) => resolveAnimatedPageSwapItems(current, nextKey, nextId++));
      },
    ),
  );

  const handleAnimationEnd = (itemId: number, event: AnimationEvent) => {
    if (event.currentTarget !== event.target) {
      return;
    }

    setItems((current) => settleAnimatedPageSwapItem(current, itemId));
  };

  return (
    <div class="page-swap-stack" data-active-view={props.activeKey}>
      <For each={items()}>
        {(item) => {
          const isActive = () => item.key === props.activeKey;

          return (
            <div
              aria-hidden={isActive() ? undefined : "true"}
              class="page-swap-view"
              data-closed={item.stage === "exiting" ? "" : undefined}
              data-entered={item.stage === "entered" ? "" : undefined}
              data-expanded={item.stage === "entering" ? "" : undefined}
              data-view={item.key}
              inert={isActive() ? undefined : true}
              onAnimationEnd={(event) => handleAnimationEnd(item.id, event)}
            >
              {props.renderView(item.key)}
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default AnimatedPageSwap;
