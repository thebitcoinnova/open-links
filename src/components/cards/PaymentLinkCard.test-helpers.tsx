import assert from "node:assert/strict";
import * as Collapsible from "@kobalte/core/collapsible";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { setPaymentCardEffectDebugTuningValue } from "../../lib/payments/card-effect-debug-tuning";
import { paymentCardEffectDefaultDebugTuning } from "../../lib/payments/card-effect-samples";
import { clearActionToastClient, registerActionToastClient } from "../../lib/ui/action-toast";
import MobileOverflowMenu from "../actions/MobileOverflowMenu";
import StyledPaymentQr from "../payments/StyledPaymentQr";
import { PaymentLinkCard, resolveMobilePaymentRailActionLayout } from "./PaymentLinkCard";

export type RenderedNode =
  | string
  | number
  | boolean
  | null
  | undefined
  | RenderedElement
  | RenderedNode[];

export interface RenderedElement {
  type: unknown;
  props: Record<string, unknown>;
}

export const reactRuntime = {
  createElement(type: unknown, props: Record<string, unknown> | null, ...children: RenderedNode[]) {
    const normalizedChildren =
      children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
    const normalizedProps =
      normalizedChildren === undefined
        ? { ...(props ?? {}) }
        : { ...(props ?? {}), children: normalizedChildren };

    if (typeof type === "function") {
      return type(normalizedProps);
    }

    return {
      type,
      props: normalizedProps,
    } satisfies RenderedElement;
  },
  Fragment(props: { children?: RenderedNode }) {
    return props.children ?? null;
  },
};

export const createPreservingRuntime = (...preservedTypes: unknown[]) => {
  const preserved = new Set(preservedTypes);

  return {
    ...reactRuntime,
    createElement(
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: RenderedNode[]
    ) {
      const normalizedChildren =
        children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
      const normalizedProps =
        normalizedChildren === undefined
          ? { ...(props ?? {}) }
          : { ...(props ?? {}), children: normalizedChildren };

      if (preserved.has(type)) {
        return {
          type,
          props: normalizedProps,
        } satisfies RenderedElement;
      }

      if (typeof type === "function") {
        return type(normalizedProps);
      }

      return {
        type,
        props: normalizedProps,
      } satisfies RenderedElement;
    },
  };
};

export const setReactRuntime = (runtime: typeof reactRuntime) => {
  (
    globalThis as typeof globalThis & {
      React?: typeof reactRuntime;
    }
  ).React = runtime;
};

setReactRuntime(createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content));

export const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

export const setNavigator = (value: Navigator) => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
};

export const restoreNavigator = () => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  }
};

export const isRenderedElement = (value: RenderedNode): value is RenderedElement =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "type" in value &&
  "props" in value;

export const collectElements = (node: RenderedNode): RenderedElement[] => {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => collectElements(entry));
  }

  if (!isRenderedElement(node)) {
    return [];
  }

  return [node, ...collectElements(node.props.children as RenderedNode)];
};

export const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

export const countElementsWithClass = (node: RenderedNode, className: string): number =>
  collectElements(node).filter((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  }).length;

export const firstElementWithProp = (
  node: RenderedNode,
  propName: string,
  value: unknown,
): RenderedElement | undefined =>
  collectElements(node).find((element) => element.props[propName] === value);

export const site = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "openlinks",
    available: ["openlinks"],
  },
  ui: {
    richCards: {
      renderMode: "auto",
      sourceLabelDefault: "show",
      imageTreatment: "cover",
      mobile: {
        imageLayout: "inline",
      },
    },
  },
} as const satisfies SiteData;

export const paymentLink = {
  id: "tip-jar",
  label: "Tip Jar",
  type: "payment",
  payment: {
    rails: [
      {
        id: "btc",
        rail: "bitcoin",
        address: "bc1qexample123",
      },
    ],
  },
} as const satisfies OpenLink;

export const multiRailPaymentLink = {
  id: "support",
  label: "Support",
  type: "payment",
  payment: {
    rails: [
      {
        id: "btc",
        rail: "bitcoin",
        address: "bc1qexample123",
      },
      {
        id: "patreon",
        rail: "patreon",
        url: "https://patreon.com/example",
      },
    ],
  },
} as const satisfies OpenLink;

export const lightningPaymentLink = {
  id: "lightning-tips",
  label: "Lightning Tips",
  type: "payment",
  payment: {
    primaryRailId: "lightning",
    effects: {
      enabled: true,
    },
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        address: "lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
      },
    ],
  },
} as const satisfies OpenLink;

export const clubOrangeLightningPaymentLink = {
  id: "cluborange-lightning-tips",
  label: "Club Orange Tips",
  icon: "cluborange",
  type: "payment",
  payment: {
    primaryRailId: "lightning",
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        address: "peterryszkiewicz@cluborange.org",
      },
    ],
  },
} as const satisfies OpenLink;

export const explicitRailLogoPaymentLink = {
  id: "cluborange-lightning-tips-explicit-rail-logo",
  label: "Club Orange Tips",
  icon: "cluborange",
  type: "payment",
  payment: {
    primaryRailId: "lightning",
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        address: "peterryszkiewicz@cluborange.org",
        qr: {
          logoMode: "rail-default",
        },
      },
    ],
  },
} as const satisfies OpenLink;

export const strikeLightningPaymentLink = {
  id: "strike-lightning-tips",
  label: "Strike Tips",
  type: "payment",
  payment: {
    primaryRailId: "lightning",
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        provider: "strike",
        label: "Strike Lightning",
        address: "openlinks@strike.me",
        qr: {
          badge: {
            mode: "auto",
          },
        },
      },
    ],
  },
} as const satisfies OpenLink;

export const mixedProviderMultiRailPaymentLink = {
  id: "mixed-provider-support",
  label: "Mixed Provider Support",
  type: "payment",
  payment: {
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        provider: "strike",
        label: "Strike Lightning",
        address: "openlinks@strike.me",
      },
      {
        id: "cashapp",
        rail: "cashapp",
        label: "Cash App Support",
        url: "https://cash.app/$openlinks",
      },
    ],
  },
} as const satisfies OpenLink;

export const decodeSvgDataUrl = (value: string): string => {
  const prefix = "data:image/svg+xml;charset=utf-8,";

  assert.ok(value.startsWith(prefix));
  return decodeURIComponent(value.slice(prefix.length));
};

export const assertSvgRenderOrder = (
  svg: string,
  firstColor: string,
  secondColor: string,
): void => {
  const firstIndex = svg.indexOf(firstColor);
  const secondIndex = svg.indexOf(secondColor);

  assert.notEqual(firstIndex, -1, `${firstColor} should appear in the composed badge SVG.`);
  assert.notEqual(secondIndex, -1, `${secondColor} should appear in the composed badge SVG.`);
  assert.ok(
    firstIndex < secondIndex,
    `${firstColor} should render before ${secondColor} in the composed badge SVG.`,
  );
};
