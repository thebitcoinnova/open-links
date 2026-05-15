import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { loadEmbeddedCode } from "../shared/embedded-code-loader";

interface BrowserSnippetResult {
  currentUrl: string;
  title: string;
  bodyText: string;
  metricTexts: string[];
}

const runSubstackMetricsSnippet = (input: {
  bodyText?: string;
  html?: string;
  nodes?: string[];
}): BrowserSnippetResult => {
  const snippet = loadEmbeddedCode("browser/substack/extract-public-profile-metrics.js");
  const nodes = input.nodes ?? [];
  const context = {
    window: {
      location: {
        href: "https://substack.com/@peterryszkiewicz",
      },
    },
    document: {
      title: "Peter Ryszkiewicz | Substack",
      body: {
        innerText: input.bodyText ?? "",
      },
      documentElement: {
        innerHTML: input.html ?? "",
      },
      querySelectorAll: () => nodes.map((textContent) => ({ textContent })),
    },
  };

  return vm.runInNewContext(snippet, context) as BrowserSnippetResult;
};

test("extracts Substack subscriber counts from rendered profile text", () => {
  // Arrange
  const nodes = ["Peter Ryszkiewicz", "@peterryszkiewicz", "15 subscribers"];

  // Act
  const snapshot = runSubstackMetricsSnippet({ nodes });

  // Assert
  assert.deepEqual(snapshot.metricTexts, ["15 subscribers"]);
});

test("falls back to Substack preload HTML when rendered profile text omits subscribers", () => {
  // Arrange
  const html = String.raw`
    <script>
      window._preloads = JSON.parse("{\"profile\":{\"name\":\"Peter Ryszkiewicz\",\"subscriberCountString\":\"15 subscribers\",\"subscriberCountNumber\":15}}")
    </script>
  `;

  // Act
  const snapshot = runSubstackMetricsSnippet({
    nodes: ["Peter Ryszkiewicz", "@peterryszkiewicz"],
    bodyText: "Peter Ryszkiewicz @peterryszkiewicz",
    html,
  });

  // Assert
  assert.deepEqual(snapshot.metricTexts, ["15 subscribers"]);
});
