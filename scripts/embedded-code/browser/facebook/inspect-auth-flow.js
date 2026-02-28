(() => {
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  const parseInteger = (value) => {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const cssPath = (node) => {
    if (!(node instanceof Element)) {
      return null;
    }

    const parts = [];
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }

      const classList = Array.from(current.classList || [])
        .filter(Boolean)
        .slice(0, 2);
      if (classList.length > 0) {
        part += `.${classList.join(".")}`;
      }
      parts.unshift(part);
      current = current.parentElement;
    }

    return parts.join(" > ");
  };
  const getRect = (node) => {
    if (!(node instanceof Element)) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const rect = node.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  };
  const resolveElementImageSource = (node) => {
    if (!(node instanceof Element)) {
      return null;
    }

    if (node instanceof HTMLImageElement) {
      return normalize(node.currentSrc || node.getAttribute("src") || "") || null;
    }

    if (node.tagName.toLowerCase() === "image") {
      return normalize(node.getAttribute("href") || node.getAttribute("xlink:href") || "") || null;
    }

    const svgImage = node.querySelector("image");
    if (svgImage instanceof Element) {
      const source = normalize(
        svgImage.getAttribute("href") || svgImage.getAttribute("xlink:href") || "",
      );
      if (source) {
        return source;
      }
    }

    const nestedImg = node.querySelector("img[src]");
    if (nestedImg instanceof HTMLImageElement) {
      return normalize(nestedImg.currentSrc || nestedImg.getAttribute("src") || "") || null;
    }

    return null;
  };
  const title = normalize(document.title || "");
  const currentUrl = window.location.href;
  const bodyText = normalize(document.body?.innerText || "");

  const hasPasswordField = Boolean(
    document.querySelector("input[type='password'], input[name='pass']"),
  );
  const hasEmailField = Boolean(document.querySelector("input[type='email'], input[name='email']"));
  const hasLoginForm = Boolean(document.querySelector("form[action*='login'], #login_form"));

  const headingCandidates = Array.from(document.querySelectorAll("h1, h2, [role='heading']"))
    .map((node) => ({
      node,
      text: normalize(node.textContent || ""),
    }))
    .filter((value) => value.text.length >= 2 && value.text.length <= 120)
    .filter(
      (value) =>
        !/log in|forgot account|this content isn't available|go to feed|go back/i.test(value.text),
    )
    .filter(
      (value) =>
        !/new|earlier|notifications?|friends?|messages?|menu|search|home|watch|marketplace|reels/i.test(
          value.text,
        ),
    );

  const profileHeadingNode =
    headingCandidates.find((entry) => entry.node.tagName.toLowerCase() === "h1")?.node ||
    headingCandidates[0]?.node ||
    null;
  const heading = headingCandidates[0]?.text || null;
  const profileHeadingRect = profileHeadingNode ? getRect(profileHeadingNode) : null;

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

      const width = parseInteger(node.getAttribute("width")) || node.naturalWidth || 0;
      const height = parseInteger(node.getAttribute("height")) || node.naturalHeight || 0;
      const area = width * height;

      let score = 0;
      if (/scontent|lookaside|profile|photo|picture/i.test(src)) {
        score += 7;
      }
      if (/\/v\/t39\./i.test(src)) {
        score += 3;
      }
      if (/profile picture|profile/i.test(alt)) {
        score += 4;
      }
      if (/\/images\/emoji\.php|\/emoji\.php/i.test(src)) {
        score -= 8;
      }
      if (/(^|[_?&=-])fb\d{1,3}([_&]|$)/i.test(src)) {
        score -= 6;
      }
      if (/(^|[_=])s\d{2,4}x\d{2,4}([_&]|$)/i.test(src)) {
        score -= 3;
      }
      if (area >= 250000) {
        score += 4;
      } else if (area >= 65536) {
        score += 2;
      }
      if (/\/rsrc\.php|\/images\/fb_icon_325x325\.png|\/favicon\.ico|\/logos?\//i.test(src)) {
        score -= 7;
      }

      return { src, alt, score, width, height, sourceType: "img", ariaLabel: null };
    })
    .filter(Boolean);

  const roleImageCandidates = Array.from(document.querySelectorAll("[role='img']"))
    .map((node) => {
      const src = resolveElementImageSource(node);
      if (!src) {
        return null;
      }

      const rect = getRect(node);
      const width = rect.width;
      const height = rect.height;
      const area = width * height;
      const ariaLabel = normalize(node.getAttribute("aria-label") || "");
      const nearHeading = profileHeadingRect
        ? Math.hypot(
            rect.x + width / 2 - (profileHeadingRect.x + profileHeadingRect.width / 2),
            rect.y + height / 2 - (profileHeadingRect.y + profileHeadingRect.height / 2),
          ) < 420
        : false;

      let score = 0;
      if (/scontent|lookaside|profile|photo|picture|\/v\/t39\./i.test(src)) {
        score += 10;
      }
      if (/profile|picture|avatar/i.test(ariaLabel)) {
        score += 16;
      }
      if (Math.abs(width - height) <= 14) {
        score += 8;
      }
      if (width >= 80 && width <= 320 && height >= 80 && height <= 320) {
        score += 10;
      }
      if (nearHeading) {
        score += 14;
      }
      if (profileHeadingRect && rect.x + width <= profileHeadingRect.x + 120) {
        score += 8;
      }
      if (profileHeadingRect && rect.y <= profileHeadingRect.y + 140) {
        score += 6;
      }
      if (area < 2_500 || width < 48 || height < 48) {
        score -= 14;
      }
      if (/your profile/i.test(ariaLabel) && width <= 56 && height <= 56) {
        score -= 12;
      }

      return {
        src,
        alt: "",
        score,
        width,
        height,
        sourceType: "role-img",
        ariaLabel,
        cssPath: cssPath(node),
      };
    })
    .filter(Boolean);

  const mergedCandidates = [...roleImageCandidates, ...imageCandidates]
    .sort((left, right) => {
      const scoreDiff = (right?.score || 0) - (left?.score || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const leftArea = (left?.width || 0) * (left?.height || 0);
      const rightArea = (right?.width || 0) * (right?.height || 0);
      return rightArea - leftArea;
    })
    .slice(0, 60);

  const profileImage =
    mergedCandidates.find(
      (candidate) =>
        candidate?.sourceType === "role-img" &&
        /profile|picture|avatar/i.test(candidate?.ariaLabel || "") &&
        (candidate?.width || 0) >= 80 &&
        (candidate?.height || 0) >= 80,
    )?.src || null;

  const controls = Array.from(
    document.querySelectorAll(
      "button, [role='button'], input[type='submit'], input[type='button'], div[role='button']",
    ),
  )
    .map((node) => {
      const text = normalize(
        node.textContent ||
          node.getAttribute("aria-label") ||
          (node instanceof HTMLInputElement ? node.value : ""),
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
    profileImage,
    metaImage,
    imageCandidates: mergedCandidates,
    controls,
  };
})();
