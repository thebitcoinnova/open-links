import { Show, createMemo } from "solid-js";
import type { ResolvedFooterPreferences } from "../../lib/ui/footer-preferences";

export interface SiteFooterProps {
  preferences: ResolvedFooterPreferences;
  buildTimestampIso?: string;
}

const utcFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC"
});

export const SiteFooter = (props: SiteFooterProps) => {
  const ctaUrl = () => props.preferences.ctaUrl.trim();

  const buildDate = createMemo(() => {
    if (typeof props.buildTimestampIso !== "string" || props.buildTimestampIso.trim().length === 0) {
      return null;
    }

    const parsed = new Date(props.buildTimestampIso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

  const formattedBuildDate = createMemo(() => {
    const parsed = buildDate();
    if (!parsed) {
      return "";
    }
    return `${utcFormatter.format(parsed)} UTC`;
  });

  return (
    <footer class="site-footer" aria-label="Site footer">
      <p class="site-footer-description">{props.preferences.description}</p>

      <Show when={ctaUrl().length > 0}>
        <a class="site-footer-cta" href={ctaUrl()} target="_blank" rel="noopener noreferrer">
          {props.preferences.ctaLabel}
        </a>
      </Show>

      <Show when={props.preferences.showLastUpdated && buildDate()}>
        <p class="site-footer-meta">
          Last updated{" "}
          <time datetime={buildDate()!.toISOString()}>{formattedBuildDate()}</time>
        </p>
      </Show>
    </footer>
  );
};

export default SiteFooter;

