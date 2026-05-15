(() => {
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const audiencePattern = /\b(?:\d[\d.,]*|\d+(?:\.\d+)?[KMBkmb])\s+subscribers?\b/i;
  const htmlSubscriberCountPattern =
    /subscriberCountString\\?["']?\s*:\s*\\?["']((?:\d[\d.,]*|\d+(?:\.\d+)?[KMBkmb])\s+subscribers?)\b/gi;
  const metricTexts = [];
  const seen = new Set();
  const selectors = ["a", "button", "span", "div", "p", "li", "h1", "h2", "h3"];

  const addMetricText = (value) => {
    const text = normalize(value || "");
    if (!text || text.length > 180 || !audiencePattern.test(text) || seen.has(text)) {
      return;
    }

    seen.add(text);
    metricTexts.push(text);
  };

  for (const node of document.querySelectorAll(selectors.join(","))) {
    addMetricText(node.textContent || "");

    if (metricTexts.length >= 24) {
      break;
    }
  }

  if (metricTexts.length < 24) {
    const html = document.documentElement?.innerHTML || "";
    for (const match of html.matchAll(htmlSubscriberCountPattern)) {
      addMetricText(match[1]);

      if (metricTexts.length >= 24) {
        break;
      }
    }
  }

  return {
    currentUrl: window.location.href,
    title: document.title,
    bodyText: normalize(document.body?.innerText || ""),
    metricTexts,
  };
})();
