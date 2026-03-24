import { Suspense, lazy } from "solid-js";

export interface MobileOverflowMenuAction {
  label: string;
  onSelect: () => void | Promise<void>;
}

export interface MobileOverflowMenuProps {
  actions: MobileOverflowMenuAction[];
  class?: string;
  contentClass?: string;
  itemClass?: string;
  label?: string;
}

const MobileOverflowMenuClient = lazy(() => import("./MobileOverflowMenu.client"));

const renderTrigger = (props: MobileOverflowMenuProps) => (
  <button
    type="button"
    class={props.class ?? "mobile-overflow-menu-trigger"}
    aria-label={props.label ?? "More actions"}
  >
    More
  </button>
);

export const MobileOverflowMenu = (props: MobileOverflowMenuProps) => {
  if (props.actions.length === 0) {
    return null;
  }

  if (typeof window === "undefined") {
    return renderTrigger(props);
  }

  return (
    <Suspense fallback={renderTrigger(props)}>
      <MobileOverflowMenuClient {...props} />
    </Suspense>
  );
};

export default MobileOverflowMenu;
