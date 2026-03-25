import { Show, createMemo } from "solid-js";
import { type BuildInfo, formatBuildTimestampUtc } from "../../lib/build-info";
import { copyToClipboard } from "../../lib/share/copy-to-clipboard";
import { showActionToast } from "../../lib/ui/action-toast";
import type { ResolvedFooterPreferences } from "../../lib/ui/footer-preferences";

export interface SiteFooterProps {
  preferences: ResolvedFooterPreferences;
  buildInfo?: BuildInfo;
  logoPath?: string;
  logoAlt?: string;
}

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
      typeof props.buildInfo?.builtAtIso !== "string" ||
      props.buildInfo.builtAtIso.trim().length === 0
    ) {
      return null;
    }

    const parsed = new Date(props.buildInfo.builtAtIso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

  const formattedBuildDate = createMemo(() => {
    const builtAtIso = props.buildInfo?.builtAtIso;
    if (typeof builtAtIso !== "string" || builtAtIso.trim().length === 0) {
      return "";
    }

    return formatBuildTimestampUtc(builtAtIso);
  });
  const showCommitLink = createMemo(
    () =>
      typeof props.buildInfo?.commitShortSha === "string" &&
      props.buildInfo.commitShortSha.trim().length > 0 &&
      typeof props.buildInfo?.commitUrl === "string" &&
      props.buildInfo.commitUrl.trim().length > 0,
  );
  const commitTitle = createMemo(() => {
    const commitSha = props.buildInfo?.commitSha?.trim();
    return commitSha ? `Commit: ${commitSha}` : undefined;
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

      <Show when={props.preferences.showBuildInfo && buildDate()}>
        <p class="site-footer-meta">
          <span title={props.buildInfo?.builtAtIso}>
            Built <time datetime={buildDate()?.toISOString()}>{formattedBuildDate()}</time>
          </span>
          <Show when={showCommitLink()}>
            {" · "}
            <a
              href={props.buildInfo?.commitUrl}
              rel="noopener noreferrer"
              target="_blank"
              title={commitTitle()}
            >
              Commit {props.buildInfo?.commitShortSha}
            </a>
          </Show>
        </p>
      </Show>
    </footer>
  );
};

export default SiteFooter;
