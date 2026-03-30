import { describe, expect, test } from "bun:test";
import {
  UPSTREAM_REPOSITORY_HOMEPAGE,
  buildDefaultForkRepositoryHomepage,
  resolveRepositoryHomepageUpdate,
  shouldReplaceInheritedRepositoryHomepage,
} from "../../src/services/repository-metadata.js";

describe("repository metadata helpers", () => {
  test("builds the default GitHub Pages homepage for forks", () => {
    expect(buildDefaultForkRepositoryHomepage("thebitcoinnova", "open-links")).toBe(
      "https://thebitcoinnova.github.io/open-links/",
    );
  });

  test("treats missing and upstream homepage values as replaceable", () => {
    expect(shouldReplaceInheritedRepositoryHomepage(null)).toBe(true);
    expect(shouldReplaceInheritedRepositoryHomepage("")).toBe(true);
    expect(shouldReplaceInheritedRepositoryHomepage(UPSTREAM_REPOSITORY_HOMEPAGE)).toBe(true);
    expect(shouldReplaceInheritedRepositoryHomepage("https://openlinks.us")).toBe(true);
  });

  test("leaves already customized homepage values alone when no preferred primary host is supplied", () => {
    expect(
      resolveRepositoryHomepageUpdate({
        currentHomepageUrl: "https://example.com/custom-home",
        fallbackForkHomepageUrl: "https://fork-owner.github.io/open-links-fork/",
      }),
    ).toBeNull();
  });

  test("prefers an explicit primary host over fallback fork pages", () => {
    expect(
      resolveRepositoryHomepageUpdate({
        currentHomepageUrl: UPSTREAM_REPOSITORY_HOMEPAGE,
        fallbackForkHomepageUrl: "https://fork-owner.github.io/open-links-fork/",
        preferredPrimaryHomepageUrl: "https://fork.example.com/",
      }),
    ).toBe("https://fork.example.com/");
  });

  test("does not overwrite an already customized homepage when a preferred host is supplied later", () => {
    expect(
      resolveRepositoryHomepageUpdate({
        currentHomepageUrl: "https://custom.example.com/profile",
        fallbackForkHomepageUrl: "https://fork-owner.github.io/open-links-fork/",
        preferredPrimaryHomepageUrl: "https://fork-owner.github.io/open-links-fork",
      }),
    ).toBeNull();
  });

  test("replaces inherited homepage with fork pages when no explicit primary host exists", () => {
    expect(
      resolveRepositoryHomepageUpdate({
        currentHomepageUrl: UPSTREAM_REPOSITORY_HOMEPAGE,
        fallbackForkHomepageUrl: "https://fork-owner.github.io/open-links-fork/",
      }),
    ).toBe("https://fork-owner.github.io/open-links-fork/");
  });
});
