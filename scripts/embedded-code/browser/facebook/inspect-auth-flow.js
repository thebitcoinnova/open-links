(() => {
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  const title = normalize(document.title || "");
  const currentUrl = window.location.href;
  const bodyText = normalize(document.body?.innerText || "");

  const hasPasswordField = Boolean(document.querySelector("input[type='password'], input[name='pass']"));
  const hasEmailField = Boolean(document.querySelector("input[type='email'], input[name='email']"));
  const hasLoginForm = Boolean(document.querySelector("form[action*='login'], #login_form"));

  const headingCandidates = Array.from(document.querySelectorAll("h1, h2, [role='heading']"))
    .map((node) => normalize(node.textContent || ""))
    .filter((value) => value.length >= 2 && value.length <= 120)
    .filter((value) => !/log in|forgot account|this content isn't available|go to feed|go back/i.test(value));
  const heading = headingCandidates[0] || null;

  const metaImage =
    document.querySelector("meta[property='og:image']")?.getAttribute("content") ||
    document.querySelector("meta[name='twitter:image']")?.getAttribute("content") ||
    null;

  const imageCandidates = Array.from(document.querySelectorAll("img[src]"))
    .map((node) => {
      const src = normalize(node.getAttribute("src") || "");
      const alt = normalize(node.getAttribute("alt") || "");
      if (!src) {
        return null;
      }

      let score = 0;
      if (/scontent|fbcdn\.net|lookaside|profile|photo|picture/i.test(src)) {
        score += 5;
      }
      if (/profile picture|profile/i.test(alt)) {
        score += 2;
      }
      if (/\/rsrc\.php|\/images\/fb_icon_325x325\.png|\/favicon\.ico/i.test(src)) {
        score -= 4;
      }

      return { src, alt, score };
    })
    .filter(Boolean)
    .sort((left, right) => (right?.score || 0) - (left?.score || 0))
    .slice(0, 40);

  const controls = Array.from(
    document.querySelectorAll(
      "button, [role='button'], input[type='submit'], input[type='button'], div[role='button']"
    )
  )
    .map((node) => {
      const text = normalize(
        node.textContent ||
          node.getAttribute("aria-label") ||
          (node instanceof HTMLInputElement ? node.value : "")
      );
      if (!text) {
        return null;
      }
      return text;
    })
    .filter(Boolean)
    .slice(0, 80);

  return {
    title,
    currentUrl,
    bodySnippet: bodyText.slice(0, 5000),
    hasPasswordField,
    hasEmailField,
    hasLoginForm,
    heading,
    metaImage,
    imageCandidates,
    controls
  };
})()
