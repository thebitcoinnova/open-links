(() => {
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const benefitPattern =
    /\b(save|discount|bonus|credit|free|cash\s*back|cashback|off your|starting at|pay in sats|trial|supports?\s+the|commission|store credit|referral reward)\b/i;
  const candidateTexts = [];
  const seen = new Set();
  const selectors = ["a", "button", "span", "div", "p", "li", "h1", "h2", "h3", "h4"];

  for (const node of document.querySelectorAll(selectors.join(","))) {
    const text = normalize(node.textContent || "");
    if (!text || text.length > 200 || !benefitPattern.test(text) || seen.has(text)) {
      continue;
    }

    seen.add(text);
    candidateTexts.push(text);

    if (candidateTexts.length >= 40) {
      break;
    }
  }

  return {
    currentUrl: window.location.href,
    title: document.title,
    bodyText: normalize(document.body?.innerText || ""),
    candidateTexts,
  };
})();
