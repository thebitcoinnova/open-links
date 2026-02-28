import { config } from "../config.js";

interface TurnstileVerifyResponse {
  success: boolean;
  hostname?: string;
  "error-codes"?: string[];
}

export type TurnstileVerificationResult =
  | { status: "ok" }
  | { status: "failed"; reason: "captcha_failed"; errors?: string[] }
  | { status: "unavailable"; reason: "captcha_unavailable"; message: string };

export const turnstileService = {
  async verifyToken(input: {
    token: string;
    remoteIp?: string | null;
  }): Promise<TurnstileVerificationResult> {
    if (config.nodeEnv !== "production") {
      return { status: "ok" };
    }

    if (!config.turnstile.secretKey) {
      return {
        status: "unavailable",
        reason: "captcha_unavailable",
        message: "Turnstile secret key is not configured",
      };
    }

    try {
      const body = new URLSearchParams({
        secret: config.turnstile.secretKey,
        response: input.token,
      });
      if (input.remoteIp) {
        body.set("remoteip", input.remoteIp);
      }

      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        return {
          status: "unavailable",
          reason: "captcha_unavailable",
          message: `Turnstile verification request failed with status ${response.status}`,
        };
      }

      const payload = (await response.json()) as TurnstileVerifyResponse;
      if (!payload.success) {
        return {
          status: "failed",
          reason: "captcha_failed",
          errors: payload["error-codes"],
        };
      }

      const responseHostname = payload.hostname?.toLowerCase();
      if (!responseHostname || responseHostname !== config.turnstile.expectedHostname) {
        return {
          status: "failed",
          reason: "captcha_failed",
          errors: ["hostname_mismatch"],
        };
      }

      return { status: "ok" };
    } catch (error: unknown) {
      return {
        status: "unavailable",
        reason: "captcha_unavailable",
        message: error instanceof Error ? error.message : "Unknown Turnstile verification error",
      };
    }
  },
};
