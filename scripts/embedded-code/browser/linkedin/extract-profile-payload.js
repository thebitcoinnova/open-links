(() => {
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  const isPlaceholder = (value) =>
    /sign up\s*\|\s*linkedin|join linkedin|authwall/i.test(value || "");

  const hasNestedCandidate = (node, minLength, maxLength) =>
    Array.from(node.querySelectorAll("p, span, div")).some((candidate) => {
      if (candidate === node) {
        return false;
      }

      const value = normalize(candidate.textContent || "");
      return value.length >= minLength && value.length <= maxLength;
    });

  const collectText = (nodes, minLength = 1, maxLength = 260, options = {}) => {
    const leafOnly = options.leafOnly === true;
    const seen = new Set();
    const values = [];
    for (const node of nodes) {
      const value = normalize(node.textContent || "");
      if (!value || value.length < minLength || value.length > maxLength || seen.has(value)) {
        continue;
      }
      if (leafOnly && hasNestedCandidate(node, minLength, maxLength)) {
        continue;
      }
      seen.add(value);
      values.push(value);
    }
    return values;
  };

  const headingTexts = collectText(document.querySelectorAll("main h1, main h2"), 2, 120);
  const fullName =
    headingTexts.find(
      (value) =>
        !/about|activity|experience|education|skills|analytics|people you may know/i.test(value),
    ) ||
    headingTexts[0] ||
    null;

  const headlineCandidates = collectText(
    document.querySelectorAll("main p, main span, main div"),
    8,
    180,
  )
    .filter((value) =>
      /engineer|developer|founder|owner|manager|designer|architect|student|lead/i.test(value),
    )
    .filter(
      (value) => !/connections|followers|contact info|profile language|public profile/i.test(value),
    );
  const headline = headlineCandidates[0] || null;

  let about = null;
  const aboutHeading = Array.from(document.querySelectorAll("main h2, main h3, main span")).find(
    (node) => normalize(node.textContent || "").toLowerCase() === "about",
  );
  if (aboutHeading) {
    const section = aboutHeading.closest("section") || aboutHeading.parentElement;
    if (section) {
      const aboutCandidates = collectText(section.querySelectorAll("p, span, div"), 24, 500, {
        leafOnly: true,
      })
        .filter((value) => value.toLowerCase() !== "about")
        .filter((value) => !/^about(?=[A-Z])/.test(value))
        .filter((value) => !/show all|see more|contact info|connections/i.test(value));
      about = aboutCandidates[0] || null;
    }
  }

  const titleRaw = normalize(document.title || "");
  const title = titleRaw && !isPlaceholder(titleRaw) ? titleRaw : null;
  const description = about || headline || null;

  const imageNodes = Array.from(document.querySelectorAll("img[src*='profile-displayphoto']"));
  const scoredImages = imageNodes
    .map((node) => {
      const src = normalize(node.getAttribute("src") || "");
      const alt = normalize(node.getAttribute("alt") || "");
      if (!src) {
        return null;
      }

      let score = 0;
      if (/profile-displayphoto-shrink_200_200|profile-displayphoto-scale_200_200/i.test(src)) {
        score += 4;
      }
      if (/profile-displayphoto/i.test(src)) {
        score += 2;
      }
      if (alt && fullName && alt.toLowerCase().includes(fullName.toLowerCase())) {
        score += 5;
      }
      if (/view .* profile/i.test(alt)) {
        score += 2;
      }

      return { src, alt, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  const imageUrl = scoredImages[0] ? scoredImages[0].src : null;

  return {
    title,
    fullName,
    headline,
    about,
    description,
    imageUrl,
    currentUrl: window.location.href,
  };
})();
