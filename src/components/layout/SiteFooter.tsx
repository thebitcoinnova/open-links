import { Show, createMemo } from "solid-js";
import { copyToClipboard } from "../../lib/share/copy-to-clipboard";
import { showActionToast } from "../../lib/ui/action-toast";
import type { ResolvedFooterPreferences } from "../../lib/ui/footer-preferences";

export interface SiteFooterProps {
  preferences: ResolvedFooterPreferences;
  buildTimestampIso?: string;
  logoPath?: string;
  logoAlt?: string;
}

const localFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const toAssetUrl = (assetPath: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = assetPath.replace(/^\/+/, "");
  return `${normalizedBase}${normalizedPath}`;
};

export const SiteFooter = (props: SiteFooterProps) => {
  const ctaUrl = () => props.preferences.ctaUrl.trim();
  const prompt = () => props.preferences.prompt;
  const promptText = createMemo(() => prompt().text);
  const logoSrc = () => {
    const maybePath = props.logoPath?.trim();
    if (!maybePath) {
      return undefined;
    }
    return toAssetUrl(maybePath);
  };

  const buildDate = createMemo(() => {
    if (
      typeof props.buildTimestampIso !== "string" ||
      props.buildTimestampIso.trim().length === 0
    ) {
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
    return localFormatter.format(parsed);
  });

  const showPrompt = createMemo(() => prompt().enabled && prompt().text.trim().length > 0);
  const promptIsSingleLine = createMemo(() => !/[\r\n]/u.test(promptText()));

  const handleCopyPrompt = async () => {
    const copied = await copyToClipboard(promptText());
    showActionToast({
      message: copied ? "Bootstrap prompt copied" : "Could not copy bootstrap prompt",
      status: copied ? "copied" : "failed",
    });
  };

  return (
    <footer class="site-footer" aria-label="Site footer">
      <Show when={logoSrc()}>
        {(src) => (
          <div class="site-footer-brand">
            <img
              class="site-footer-logo"
              src={src()}
              alt={props.logoAlt ?? ""}
              aria-hidden={props.logoAlt ? undefined : "true"}
            />
          </div>
        )}
      </Show>

      <p class="site-footer-description">{props.preferences.description}</p>

      <Show when={showPrompt()}>
        <section class="site-footer-prompt" aria-labelledby="site-footer-prompt-title">
          <div class="site-footer-prompt-header">
            <h2 class="site-footer-prompt-title" id="site-footer-prompt-title">
              {prompt().title}
            </h2>
            <p class="site-footer-prompt-explanation">{prompt().explanation}</p>
          </div>
          <Show
            when={promptIsSingleLine()}
            fallback={
              <div class="site-footer-prompt-multiline">
                <pre class="site-footer-prompt-text">
                  <code>{promptText()}</code>
                </pre>
                <div class="site-footer-prompt-copy-actions">
                  <button
                    class="site-footer-copy site-footer-prompt-copy-button"
                    type="button"
                    aria-label="Copy bootstrap prompt"
                    onClick={handleCopyPrompt}
                  >
                    Copy
                  </button>
                </div>
              </div>
            }
          >
            <div class="site-footer-prompt-copy-row">
              <input
                class="site-footer-prompt-input"
                type="text"
                value={promptText()}
                readOnly
                spellcheck={false}
                aria-label="Bootstrap prompt"
                title={promptText()}
                onClick={(event) => event.currentTarget.select()}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                class="site-footer-copy site-footer-prompt-copy-button"
                type="button"
                aria-label="Copy bootstrap prompt"
                onClick={handleCopyPrompt}
              >
                Copy
              </button>
            </div>
          </Show>
        </section>
      </Show>

      <Show when={ctaUrl().length > 0}>
        <div class="site-footer-actions">
          <a class="site-footer-cta" href={ctaUrl()} target="_blank" rel="noopener noreferrer">
            {props.preferences.ctaLabel}
          </a>
        </div>
      </Show>

      <Show when={props.preferences.showLastUpdated && buildDate()}>
        <p class="site-footer-meta">
          Last updated <time datetime={buildDate()?.toISOString()}>{formattedBuildDate()}</time>
        </p>
      </Show>
    </footer>
  );
};

export default SiteFooter;
