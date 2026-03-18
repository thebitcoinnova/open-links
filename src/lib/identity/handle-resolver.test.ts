import assert from "node:assert/strict";
import test from "node:test";
import {
  formatHandleForDisplay,
  normalizeHandle,
  resolveHandleFromUrl,
  resolveLinkHandle,
} from "./handle-resolver";

test("resolves supported URL handles", () => {
  const cases = [
    { url: "https://app.cluborange.org/pryszkie", extractorId: "cluborange", handle: "pryszkie" },
    { url: "https://github.com/pRizz", extractorId: "github", handle: "prizz" },
    { url: "https://x.com/pryszkie", extractorId: "x", handle: "pryszkie" },
    {
      url: "https://www.linkedin.com/in/peter-ryszkiewicz/",
      extractorId: "linkedin",
      handle: "peter-ryszkiewicz",
    },
    {
      url: "https://www.facebook.com/peter.ryszkiewicz",
      extractorId: "facebook",
      handle: "peter.ryszkiewicz",
    },
    {
      url: "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/",
      extractorId: "facebook",
      handle: "bright-builds-llc",
    },
    {
      url: "https://www.instagram.com/peterryszkiewicz/",
      extractorId: "instagram",
      handle: "peterryszkiewicz",
    },
    {
      url: "https://primal.net/peterryszkiewicz",
      extractorId: "primal",
      handle: "peterryszkiewicz",
    },
    {
      url: "https://medium.com/@peterryszkiewicz",
      extractorId: "medium",
      handle: "peterryszkiewicz",
    },
    {
      url: "https://peterryszkiewicz.substack.com/",
      extractorId: "substack",
      handle: "peterryszkiewicz",
    },
    {
      url: "https://www.youtube.com/@OpenAI",
      extractorId: "youtube",
      handle: "openai",
    },
  ] as const;

  for (const item of cases) {
    const resolved = resolveHandleFromUrl({ url: item.url });
    assert.equal(resolved.supported, true);
    assert.equal(resolved.extractorId, item.extractorId);
    assert.equal(resolved.handle, item.handle);
    assert.equal(resolved.reason, "resolved");
  }
});

test("marks reserved or non-profile paths as supported but unresolved", () => {
  const cases = [
    {
      url: "https://public.cluborange.org/user/66f980c41eac7211678dff16",
      extractorId: "cluborange",
      reason: "not_profile_url",
    },
    { url: "https://github.com/login", extractorId: "github", reason: "not_profile_url" },
    { url: "https://x.com/home", extractorId: "x", reason: "not_profile_url" },
    { url: "https://linkedin.com/feed/", extractorId: "linkedin", reason: "not_profile_url" },
    { url: "https://facebook.com/groups", extractorId: "facebook", reason: "not_profile_url" },
    {
      url: "https://facebook.com/people/Bright-Builds-LLC/photos",
      extractorId: "facebook",
      reason: "not_profile_url",
    },
    { url: "https://instagram.com/explore", extractorId: "instagram", reason: "not_profile_url" },
    { url: "https://primal.net/home", extractorId: "primal", reason: "not_profile_url" },
    {
      url: "https://medium.com/topics/technology",
      extractorId: "medium",
      reason: "not_profile_url",
    },
    { url: "https://substack.com/profile", extractorId: "substack", reason: "not_profile_url" },
    {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      extractorId: "youtube",
      reason: "not_profile_url",
    },
    { url: "https://youtu.be/dQw4w9WgXcQ", extractorId: "youtube", reason: "not_profile_url" },
  ] as const;

  for (const item of cases) {
    const resolved = resolveHandleFromUrl({ url: item.url });
    assert.equal(resolved.supported, true);
    assert.equal(resolved.extractorId, item.extractorId);
    assert.equal(resolved.handle, undefined);
    assert.equal(resolved.reason, item.reason);
  }
});

test("returns unsupported for non-supported domains", () => {
  const resolved = resolveHandleFromUrl({ url: "https://openlinks.us" });
  assert.equal(resolved.supported, false);
  assert.equal(resolved.extractorId, undefined);
  assert.equal(resolved.handle, undefined);
  assert.equal(resolved.reason, "unsupported_domain");
});

test("treats substack icon hint custom domain as supported without inferred handle", () => {
  const resolved = resolveHandleFromUrl({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
  });
  assert.equal(resolved.supported, true);
  assert.equal(resolved.extractorId, "substack");
  assert.equal(resolved.handle, undefined);
});

test("normalizes and formats handles", () => {
  assert.equal(normalizeHandle("@P_Rizz"), "p_rizz");
  assert.equal(formatHandleForDisplay("P_Rizz"), "@p_rizz");
  assert.equal(normalizeHandle(""), undefined);
});

test("prefers manual metadata handle over URL-derived handle", () => {
  const resolved = resolveLinkHandle({
    metadataHandle: "@MyManualHandle",
    url: "https://github.com/pRizz",
  });

  assert.equal(resolved.source, "metadata");
  assert.equal(resolved.handle, "mymanualhandle");
  assert.equal(resolved.displayHandle, "@mymanualhandle");
});
