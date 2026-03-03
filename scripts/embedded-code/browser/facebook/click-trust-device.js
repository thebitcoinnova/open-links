(() => {
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  const controls = Array.from(
    document.querySelectorAll(
      "button, [role='button'], input[type='submit'], input[type='button'], div[role='button']",
    ),
  );
  const matcher = /trust this device|trust device|save browser|remember browser|yes, trust/i;
  const target = controls.find((node) => {
    const text = normalize(
      node.textContent ||
        node.getAttribute("aria-label") ||
        (node instanceof HTMLInputElement ? node.value : ""),
    );
    return matcher.test(text);
  });

  if (!target) {
    return {
      clicked: false,
      reason: "no_matching_control",
    };
  }

  const label = normalize(
    target.textContent ||
      target.getAttribute("aria-label") ||
      (target instanceof HTMLInputElement ? target.value : ""),
  );
  target.click();
  return {
    clicked: true,
    label,
  };
})();
