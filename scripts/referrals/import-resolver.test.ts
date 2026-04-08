import assert from "node:assert/strict";
import test from "node:test";
import type { ReferralInboxCandidateInput } from "./import-contract";
import { resolveReferralImportCandidates } from "./import-resolver";

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
  status: number;
  headers?: Record<string, string>;
  body?: string;
}): Response => {
  const response = new Response(input.body ?? "", {
    status: input.status,
    headers: input.headers,
  });
  Object.defineProperty(response, "url", {
    configurable: true,
    value: input.url,
  });
  return response;
};

const resolveSingleCandidate = async (
  candidate: ReferralInboxCandidateInput,
  responses: Array<Response | Error>,
) => {
  let result: Awaited<ReturnType<typeof resolveReferralImportCandidates>> | undefined;
  await withMockFetch(responses, async () => {
    result = await resolveReferralImportCandidates({
      candidates: [candidate],
    });
  });

  return result as Awaited<ReturnType<typeof resolveReferralImportCandidates>>;
};

test("resolver records a redirect chain and auto-recommends a single clear referral url", async () => {
  const result = await resolveSingleCandidate(
    {
      candidateId: "clear",
      url: "https://links.example.com/track/openlinks",
    },
    [
      makeResponse({
        url: "https://links.example.com/track/openlinks",
        status: 302,
        headers: {
          location: "/go/referral",
        },
      }),
      makeResponse({
        url: "https://links.example.com/go/referral",
        status: 302,
        headers: {
          location: "https://example.com/signup?ref=alice&utm_source=newsletter",
        },
      }),
      makeResponse({
        url: "https://example.com/signup?ref=alice&utm_source=newsletter",
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: "<html><head><title>Join Example</title></head><body></body></html>",
      }),
    ],
  );

  assert.equal(result.candidates[0]?.resolution?.status, "resolved_clear");
  assert.equal(
    result.candidates[0]?.resolution?.recommendedUrl,
    "https://example.com/signup?ref=alice",
  );
  assert.equal(
    result.candidates[0]?.resolution?.resolvedUrl,
    "https://example.com/signup?ref=alice&utm_source=newsletter",
  );
  assert.equal(result.report.items[0]?.hops.length, 3);
  assert.deepEqual(result.report.items[0]?.plausibleUrls, [
    {
      url: "https://example.com/signup?ref=alice&utm_source=newsletter",
      sourceUrl: "https://example.com/signup?ref=alice",
      pattern: "query_param",
      score: 320,
      hopIndex: 1,
      knownFamilyId: undefined,
    },
  ]);
});

test("resolver collapses equivalent www and non-www plausible urls into one recommendation", async () => {
  const result = await resolveSingleCandidate(
    {
      candidateId: "equivalent-hosts",
      url: "https://lemonade.com/r/peterryszkiewicz",
    },
    [
      makeResponse({
        url: "https://lemonade.com/r/peterryszkiewicz",
        status: 301,
        headers: {
          location: "https://www.lemonade.com/r/peterryszkiewicz",
        },
      }),
      makeResponse({
        url: "https://www.lemonade.com/r/peterryszkiewicz",
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: "<html><head><title>Lemonade</title></head><body></body></html>",
      }),
    ],
  );

  assert.equal(result.candidates[0]?.resolution?.status, "resolved_clear");
  assert.equal(
    result.candidates[0]?.resolution?.recommendedUrl,
    "https://lemonade.com/r/peterryszkiewicz",
  );
  assert.equal(result.report.items[0]?.plausibleUrls.length, 1);
});

test("resolver marks multiple plausible urls for manual review", async () => {
  const result = await resolveSingleCandidate(
    {
      candidateId: "review",
      url: "https://links.example.com/track/review",
    },
    [
      makeResponse({
        url: "https://links.example.com/track/review",
        status: 302,
        headers: {
          location: "https://example.com/promo?code=ALPHA",
        },
      }),
      makeResponse({
        url: "https://example.com/promo?code=ALPHA",
        status: 302,
        headers: {
          location: "https://example.com/signup?ref=ALPHA",
        },
      }),
      makeResponse({
        url: "https://example.com/signup?ref=ALPHA",
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: "<html><head><title>Join Example</title></head><body></body></html>",
      }),
    ],
  );

  assert.equal(result.candidates[0]?.resolution?.status, "review_required");
  assert.equal(result.candidates[0]?.resolution?.recommendedUrl, undefined);
  assert.equal(result.report.items[0]?.plausibleUrls.length, 2);
  assert.equal(
    result.candidates[0]?.resolution?.reviewReason,
    "multiple plausible referral URLs found in redirect chain",
  );
});

test("resolver marks dead links unresolved and surfaces terminal title/status", async () => {
  const result = await resolveSingleCandidate(
    {
      candidateId: "dead",
      url: "https://links.example.com/dead",
    },
    [
      makeResponse({
        url: "https://links.example.com/dead",
        status: 400,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: "<html><head><title>Wrong Link</title></head><body></body></html>",
      }),
    ],
  );

  assert.equal(result.candidates[0]?.resolution?.status, "unresolved");
  assert.equal(result.candidates[0]?.resolution?.terminalStatusCode, 400);
  assert.equal(result.candidates[0]?.resolution?.terminalTitle, "Wrong Link");
  assert.equal(result.candidates[0]?.resolution?.reason, "no_plausible_referral_url");
});

test("resolver treats missing redirect targets as unresolved", async () => {
  const result = await resolveSingleCandidate(
    {
      candidateId: "missing-location",
      url: "https://links.example.com/missing-location",
    },
    [
      makeResponse({
        url: "https://links.example.com/missing-location",
        status: 302,
      }),
    ],
  );

  assert.equal(result.candidates[0]?.resolution?.status, "unresolved");
  assert.equal(result.candidates[0]?.resolution?.reason, "redirect_missing_location");
});

test("resolver stops after the redirect hop limit", async () => {
  const responses: Response[] = [];
  for (let hop = 0; hop < 8; hop += 1) {
    responses.push(
      makeResponse({
        url: `https://links.example.com/hop-${hop}`,
        status: 302,
        headers: {
          location: `https://links.example.com/hop-${hop + 1}`,
        },
      }),
    );
  }

  const result = await resolveSingleCandidate(
    {
      candidateId: "hop-limit",
      url: "https://links.example.com/hop-0",
    },
    responses,
  );

  assert.equal(result.candidates[0]?.resolution?.status, "unresolved");
  assert.equal(result.candidates[0]?.resolution?.reason, "redirect_hop_limit_exceeded");
  assert.equal(result.report.items[0]?.hops.at(-1)?.error, "redirect_hop_limit_exceeded");
});

test("resolver attaches a public-sharing terms policy result when the referral page points to help terms", async () => {
  const result = await resolveSingleCandidate(
    {
      candidateId: "terms-policy",
      url: "https://links.example.com/referral",
    },
    [
      makeResponse({
        url: "https://links.example.com/referral",
        status: 302,
        headers: {
          location: "https://example.com/signup?ref=alpha",
        },
      }),
      makeResponse({
        url: "https://example.com/signup?ref=alpha",
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: `
          <html>
            <head>
              <meta property="og:url" content="https://help.example.com/help/referral-faq" />
            </head>
            <body>Apply from a mobile device to receive the eligible referral bonus.</body>
          </html>
        `,
      }),
      makeResponse({
        url: "https://help.example.com/help/referral-faq",
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: `
          <html>
            <body>
              You may not publicly post the referral link online where it could reach people you do
              not know.
            </body>
          </html>
        `,
      }),
    ],
  );

  assert.equal(result.candidates[0]?.resolution?.status, "resolved_clear");
  assert.equal(result.candidates[0]?.termsPolicy?.status, "public_forbidden");
  assert.equal(result.candidates[0]?.termsPolicy?.matchedRuleId, "no_public_posting");
  assert.equal(
    result.report.items[0]?.termsPolicy?.checkedUrl,
    "https://help.example.com/help/referral-faq",
  );
});
