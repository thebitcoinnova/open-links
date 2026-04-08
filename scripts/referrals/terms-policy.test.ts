import assert from "node:assert/strict";
import test from "node:test";
import { checkReferralTermsPolicy } from "./terms-policy";

const withMockFetch = async (
  responses: Array<Response | Error>,
  run: () => Promise<void>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  let index = 0;
  globalThis.fetch = async () => {
    const next = responses[index];
    index += 1;
    if (next instanceof Error) {
      throw next;
    }

    return next;
  };

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const makeResponse = (input: {
  url: string;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}): Response => {
  const response = new Response(input.body ?? "", {
    headers: input.headers,
    status: input.status ?? 200,
  });
  Object.defineProperty(response, "url", {
    configurable: true,
    value: input.url,
  });
  return response;
};

test("checkReferralTermsPolicy flags explicit public-sharing prohibitions", async () => {
  let result: Awaited<ReturnType<typeof checkReferralTermsPolicy>> | undefined;

  await withMockFetch(
    [
      makeResponse({
        url: "https://help.example.com/referrals",
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: `
          <html>
            <body>
              Share this offer with people you know. You may not publicly post the referral link
              online where it can reach strangers.
            </body>
          </html>
        `,
      }),
    ],
    async () => {
      result = await checkReferralTermsPolicy({
        referralUrl: "https://example.com/signup?ref=alice",
        termsUrl: "https://help.example.com/referrals",
      });
    },
  );

  assert.equal(result?.status, "public_forbidden");
  assert.equal(result?.matchedRuleId, "no_public_posting");
  assert.equal(result?.checkedUrl, "https://help.example.com/referrals");
  assert.match(result?.evidenceSnippet ?? "", /may not publicly post/u);
});

test("checkReferralTermsPolicy follows discovered help urls from the referral page", async () => {
  let result: Awaited<ReturnType<typeof checkReferralTermsPolicy>> | undefined;

  await withMockFetch(
    [
      makeResponse({
        url: "https://get.example.com/referral",
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: `
          <html>
            <head>
              <meta property="og:url" content="https://help.example.com/credit-card-referrals" />
            </head>
            <body>Apply from a mobile device to receive the eligible referral bonus.</body>
          </html>
        `,
      }),
      makeResponse({
        url: "https://help.example.com/credit-card-referrals",
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: `
          <html>
            <body>
              The referral link may only be shared with people you know and not with people who are
              not your family or personal friends and acquaintances.
            </body>
          </html>
        `,
      }),
    ],
    async () => {
      result = await checkReferralTermsPolicy({
        referralUrl: "https://get.example.com/referral",
      });
    },
  );

  assert.equal(result?.status, "public_forbidden");
  assert.equal(result?.matchedRuleId, "only_share_with_people_you_know");
  assert.equal(result?.checkedUrl, "https://help.example.com/credit-card-referrals");
});

test("checkReferralTermsPolicy recognizes explicit public-sharing allowance", async () => {
  let result: Awaited<ReturnType<typeof checkReferralTermsPolicy>> | undefined;

  await withMockFetch(
    [
      makeResponse({
        url: "https://help.example.com/open-sharing",
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: `
          <html>
            <body>
              You may publicly share your referral link online and share with anyone who wants to
              sign up.
            </body>
          </html>
        `,
      }),
    ],
    async () => {
      result = await checkReferralTermsPolicy({
        referralUrl: "https://example.com/referral?code=ALPHA",
        termsUrl: "https://help.example.com/open-sharing",
      });
    },
  );

  assert.equal(result?.status, "public_allowed");
  assert.equal(result?.matchedRuleId, "public_sharing_allowed");
});

test("checkReferralTermsPolicy returns ambiguous when it can read a page but finds no conclusive policy", async () => {
  let result: Awaited<ReturnType<typeof checkReferralTermsPolicy>> | undefined;

  await withMockFetch(
    [
      makeResponse({
        url: "https://example.com/referral",
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: `
          <html>
            <body>
              Earn a referral reward when your friends sign up. See the referral FAQ for the latest
              offer details.
            </body>
          </html>
        `,
      }),
    ],
    async () => {
      result = await checkReferralTermsPolicy({
        referralUrl: "https://example.com/referral",
      });
    },
  );

  assert.equal(result?.status, "ambiguous");
  assert.equal(result?.reason, "no_conclusive_public_sharing_policy_language");
  assert.match(result?.evidenceSnippet ?? "", /referral reward/u);
});

test("checkReferralTermsPolicy returns not_found when no html terms source can be fetched", async () => {
  let result: Awaited<ReturnType<typeof checkReferralTermsPolicy>> | undefined;

  await withMockFetch(
    [
      makeResponse({
        url: "https://example.com/referral",
        headers: {
          "content-type": "application/json",
        },
        body: `{"ok":true}`,
      }),
    ],
    async () => {
      result = await checkReferralTermsPolicy({
        referralUrl: "https://example.com/referral",
      });
    },
  );

  assert.equal(result?.status, "not_found");
  assert.match(result?.reason ?? "", /non_html_response/u);
});
