import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { A } from "@solidjs/router";
import { Show, createResource, createSignal, onCleanup, onMount } from "solid-js";

const githubInstallUrl =
  import.meta.env.VITE_GITHUB_APP_INSTALL_URL ??
  "https://github.com/apps/YOUR_APP_NAME/installations/new";
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const captchaRequired = import.meta.env.PROD;

const formatAuthStartError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "Failed to start GitHub authentication";
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string; reason?: string };
    if (parsed.reason === "captcha_missing") {
      return "Complete the security check to continue.";
    }
    if (parsed.reason === "captcha_failed") {
      return "Security check failed. Please try again.";
    }
    if (parsed.reason === "captcha_unavailable") {
      return "Security check service is unavailable. Please retry shortly.";
    }
    if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
      return parsed.message;
    }
  } catch {
    // Fallback for non-JSON API errors.
  }

  return error.message;
};

export default function OnboardingPage() {
  const [me, { refetch: refetchMe }] = createResource(() => api.getMe());
  const [status, { refetch: refetchStatus }] = createResource(() =>
    me() ? api.getOnboardingStatus() : null,
  );
  const [repos, { refetch: refetchRepos }] = createResource(() => (me() ? api.listRepos() : null));
  const [provisioning, setProvisioning] = createSignal(false);
  const [authStarting, setAuthStarting] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  const [captchaToken, setCaptchaToken] = createSignal<string | null>(null);
  const [captchaError, setCaptchaError] = createSignal<string | null>(null);
  let turnstileContainer: HTMLDivElement | undefined;
  let turnstileWidgetId: string | null = null;
  let turnstilePollHandle: number | null = null;

  onMount(() => {
    if (!captchaRequired) {
      return;
    }

    if (!turnstileSiteKey) {
      setCaptchaError("Security check is not configured. Please contact support.");
      return;
    }

    const renderWidget = () => {
      if (!turnstileContainer || !window.turnstile || turnstileWidgetId) {
        return false;
      }

      turnstileWidgetId = window.turnstile.render(turnstileContainer, {
        sitekey: turnstileSiteKey,
        callback: (token) => {
          setCaptchaToken(token);
          setCaptchaError(null);
        },
        "expired-callback": () => {
          setCaptchaToken(null);
          setCaptchaError("Security check expired. Please complete it again.");
        },
        "error-callback": () => {
          setCaptchaToken(null);
          setCaptchaError("Security check failed to load. Please try again.");
        },
      });
      return true;
    };

    if (!renderWidget()) {
      turnstilePollHandle = window.setInterval(() => {
        if (renderWidget() && turnstilePollHandle !== null) {
          window.clearInterval(turnstilePollHandle);
          turnstilePollHandle = null;
        }
      }, 100);
    }

    onCleanup(() => {
      if (turnstilePollHandle !== null) {
        window.clearInterval(turnstilePollHandle);
        turnstilePollHandle = null;
      }
      if (turnstileWidgetId && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId);
        turnstileWidgetId = null;
      }
    });
  });

  const startGitHubAuth = async () => {
    if (captchaRequired && !turnstileSiteKey) {
      setMessage("Security check is not configured.");
      return;
    }

    setAuthStarting(true);
    setMessage(null);

    try {
      const response = await api.startGithubAuth(captchaToken() ?? undefined);
      window.location.assign(response.authorizeUrl);
    } catch (error) {
      setMessage(formatAuthStartError(error));
      setCaptchaToken(null);
      if (captchaRequired && turnstileWidgetId && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId);
      }
    } finally {
      setAuthStarting(false);
    }
  };

  const canStartGitHubAuth = () => {
    if (authStarting()) {
      return false;
    }
    if (!captchaRequired) {
      return true;
    }
    if (!turnstileSiteKey) {
      return false;
    }
    return Boolean(captchaToken());
  };

  const provision = async () => {
    setProvisioning(true);
    setMessage(null);
    try {
      const result = await api.provisionRepo();
      setMessage(`Provisioned ${result.repo.owner}/${result.repo.name}`);
      await Promise.all([refetchStatus(), refetchRepos()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to provision fork");
    } finally {
      setProvisioning(false);
    }
  };

  const latestRepoId = () => repos()?.repos?.[0]?.id;

  return (
    <PageShell>
      <section class="grid gap-4 md:grid-cols-2">
        <Card class="space-y-4 bg-white text-ink">
          <h1 class="font-display text-3xl font-bold">Onboarding Wizard</h1>
          <p class="text-sm text-slate-600">
            Follow each step in order. The flow is strict fork-first and blocks editing until app
            permissions are complete.
          </p>
          <Show when={message()}>
            <p class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {message()}
            </p>
          </Show>
        </Card>

        <Card class="space-y-3 bg-white/95 text-ink">
          <h2 class="font-display text-xl font-semibold">Status</h2>
          <Show
            when={status()}
            fallback={<p class="text-sm text-slate-500">Sign in with GitHub to load status.</p>}
          >
            {(value) => (
              <ul class="space-y-2 text-sm">
                <li>GitHub connected: {value().githubConnected ? "yes" : "no"}</li>
                <li>App installed: {value().appInstalled ? "yes" : "no"}</li>
                <li>Repo provisioned: {value().repoProvisioned ? "yes" : "no"}</li>
                <li>Pages verified: {value().pagesVerified ? "yes" : "no"}</li>
              </ul>
            )}
          </Show>
        </Card>
      </section>

      <section class="mt-6 grid gap-4 md:grid-cols-2">
        <Card class="space-y-3 bg-white text-ink">
          <h3 class="font-display text-lg font-semibold">Step 1: GitHub account</h3>
          <p class="text-sm text-slate-600">
            If you don’t have an account yet, create one and return here.
          </p>
          <Show when={captchaRequired}>
            <div class="space-y-2">
              <p class="text-xs text-slate-600">Complete the security check before connecting.</p>
              <Show
                when={turnstileSiteKey}
                fallback={
                  <p class="text-xs text-rose-700">
                    Security check is unavailable because site key is missing.
                  </p>
                }
              >
                <div
                  class="min-h-[68px] rounded-md border border-slate-200 bg-slate-50 p-2"
                  ref={(element) => {
                    turnstileContainer = element;
                  }}
                />
              </Show>
              <Show when={captchaError()}>
                <p class="text-xs text-rose-700">{captchaError()}</p>
              </Show>
            </div>
          </Show>
          <div class="flex gap-2">
            <a href="https://github.com/signup" target="_blank" rel="noreferrer">
              <Button variant="outline">Create GitHub account</Button>
            </a>
            <Button variant="primary" onClick={startGitHubAuth} disabled={!canStartGitHubAuth()}>
              {authStarting() ? "Connecting..." : "Connect GitHub"}
            </Button>
          </div>
        </Card>

        <Card class="space-y-3 bg-white text-ink">
          <h3 class="font-display text-lg font-semibold">Step 2: Install GitHub App</h3>
          <p class="text-sm text-slate-600">
            Install your GitHub App to enable fork, commit, and sync operations.
          </p>
          <a href={githubInstallUrl} target="_blank" rel="noreferrer">
            <Button variant="outline">Install App</Button>
          </a>
        </Card>

        <Card class="space-y-3 bg-white text-ink">
          <h3 class="font-display text-lg font-semibold">Step 3: Provision your fork</h3>
          <p class="text-sm text-slate-600">
            Create your OpenLinks repository under your GitHub account.
          </p>
          <Button onClick={provision} disabled={provisioning() || !me()}>
            {provisioning() ? "Provisioning..." : "Provision fork"}
          </Button>
        </Card>

        <Card class="space-y-3 bg-white text-ink">
          <h3 class="font-display text-lg font-semibold">Step 4: Open editor</h3>
          <p class="text-sm text-slate-600">Launch the CRUD editor and start publishing updates.</p>
          <Show
            when={latestRepoId()}
            fallback={<p class="text-xs text-slate-500">Provision a fork first.</p>}
          >
            {(repoId) => (
              <A href={`/editor/${repoId()}`}>
                <Button variant="primary">Open editor</Button>
              </A>
            )}
          </Show>
        </Card>
      </section>

      <section class="mt-6">
        <Button
          variant="ghost"
          onClick={() => Promise.all([refetchMe(), refetchStatus(), refetchRepos()])}
        >
          Refresh onboarding status
        </Button>
      </section>
    </PageShell>
  );
}
