(() => {
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const audiencePattern =
    /\b(?:\d[\d.,]*|\d+(?:\.\d+)?[KMBkmb])\s+(?:followers?|following|members?)\b/i;
  const metricTexts = [];
  const seen = new Set();
  const selectors = ["a", "button", "span", "div", "p", "li", "h1", "h2", "h3"];
  const semanticProfileRoot = document.querySelector(
    '[itemprop="mainEntity"][itemscope][itemtype="https://schema.org/Person"]',
  );
  const profileDescription = normalize(
    document.querySelector('[data-testid="UserDescription"]')?.textContent ||
      semanticProfileRoot?.querySelector('[dir="auto"].whitespace-pre-wrap')?.textContent ||
      "",
  );

  for (const node of document.querySelectorAll(selectors.join(","))) {
    const text = normalize(node.textContent || "");
    if (!text || text.length > 160 || !audiencePattern.test(text) || seen.has(text)) {
      continue;
    }

    seen.add(text);
    metricTexts.push(text);

    if (metricTexts.length >= 24) {
      break;
    }
  }

  return {
    currentUrl: window.location.href,
    title: document.title,
    bodyText: normalize(document.body?.innerText || ""),
    metricTexts,
    profileDescription: profileDescription || undefined,
  };
})();
