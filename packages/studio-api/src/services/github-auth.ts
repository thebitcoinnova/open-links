import { Octokit } from "@octokit/rest";
import { config } from "../config.js";
import { CryptoBox } from "../lib/crypto.js";
import { db, type UserRecord } from "./database.js";

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

export interface AuthenticatedSessionUser {
  user: UserRecord;
  accessToken: string;
  expiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}

const oauthRequest = async (body: URLSearchParams): Promise<OAuthTokenResponse> => {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json()) as OAuthTokenResponse;
  if (!response.ok || payload.error) {
    const reason = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;
    throw new Error(`GitHub OAuth request failed: ${reason}`);
  }

  return payload;
};

const toExpiry = (seconds?: number): Date | null => {
  if (!seconds || Number.isNaN(seconds) || seconds <= 0) {
    return null;
  }
  return new Date(Date.now() + seconds * 1000);
};

export class GitHubAuthService {
  private readonly crypto: CryptoBox;

  constructor() {
    this.crypto = new CryptoBox(config.encryptionKey);
  }

  createAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: `${config.apiBaseUrl}/api/v1/auth/github/callback`,
      state,
      allow_signup: "true",
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForSession(input: { code: string }): Promise<AuthenticatedSessionUser> {
    const body = new URLSearchParams({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code: input.code,
    });

    const tokenPayload = await oauthRequest(body);

    if (!tokenPayload.access_token) {
      throw new Error("GitHub OAuth response did not include access_token");
    }

    const octokit = new Octokit({ auth: tokenPayload.access_token });
    const { data: ghUser } = await octokit.users.getAuthenticated();

    const user = await db.upsertUser({
      githubUserId: ghUser.id,
      githubLogin: ghUser.login,
      githubName: ghUser.name,
      avatarUrl: ghUser.avatar_url,
    });

    const accessExpiresAt = toExpiry(tokenPayload.expires_in);
    const refreshExpiresAt = toExpiry(tokenPayload.refresh_token_expires_in);

    await db.saveToken({
      userId: user.id,
      accessTokenEncrypted: this.crypto.encrypt(tokenPayload.access_token),
      refreshTokenEncrypted: tokenPayload.refresh_token
        ? this.crypto.encrypt(tokenPayload.refresh_token)
        : null,
      accessExpiresAt,
      refreshExpiresAt,
      tokenType: tokenPayload.token_type ?? null,
      scope: tokenPayload.scope ?? null,
    });

    return {
      user,
      accessToken: tokenPayload.access_token,
      expiresAt: accessExpiresAt,
      refreshToken: tokenPayload.refresh_token ?? null,
      refreshExpiresAt,
    };
  }

  async getUserToken(userId: string): Promise<string> {
    const tokenRecord = await db.getTokenByUserId(userId);
    if (!tokenRecord) {
      throw new Error("No GitHub token found for user");
    }

    const accessToken = this.crypto.decrypt(tokenRecord.access_token_encrypted);

    if (!tokenRecord.access_expires_at) {
      return accessToken;
    }

    const refreshThreshold =
      tokenRecord.access_expires_at.getTime() - config.github.tokenRefreshMarginSeconds * 1000;

    if (Date.now() < refreshThreshold) {
      return accessToken;
    }

    if (!tokenRecord.refresh_token_encrypted) {
      return accessToken;
    }

    const refreshToken = this.crypto.decrypt(tokenRecord.refresh_token_encrypted);
    const refreshed = await this.refreshAccessToken(refreshToken);

    const nextAccess = refreshed.access_token ?? accessToken;
    const nextRefreshToken = refreshed.refresh_token ?? refreshToken;

    await db.saveToken({
      userId,
      accessTokenEncrypted: this.crypto.encrypt(nextAccess),
      refreshTokenEncrypted: this.crypto.encrypt(nextRefreshToken),
      accessExpiresAt: toExpiry(refreshed.expires_in),
      refreshExpiresAt: toExpiry(refreshed.refresh_token_expires_in),
      tokenType: refreshed.token_type ?? tokenRecord.token_type,
      scope: refreshed.scope ?? tokenRecord.scope,
    });

    return nextAccess;
  }

  async hasRequiredInstallation(userId: string): Promise<boolean> {
    const token = await this.getUserToken(userId);
    const octokit = new Octokit({ auth: token });

    const { data } = await octokit.request("GET /user/installations", {
      per_page: 100,
    });

    return data.installations.some((installation) => {
      const account = installation.account;
      const accountLogin =
        account &&
        typeof account === "object" &&
        "login" in account &&
        typeof account.login === "string"
          ? account.login.toLowerCase()
          : undefined;
      return accountLogin === config.upstreamRepo.owner.toLowerCase();
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await db.deleteSession(sessionId);
  }

  private async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    return oauthRequest(body);
  }
}

export const githubAuthService = new GitHubAuthService();
