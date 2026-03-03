(() => {
  const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim().toLowerCase();
  return {
    title: (document.title || "").toLowerCase(),
    body: text.slice(0, 5000),
    hasPasswordField: Boolean(
      document.querySelector("input[type='password'], input[name='session_password'], #password"),
    ),
    hasUsernameField: Boolean(
      document.querySelector("input[type='email'], input[name='session_key'], #username"),
    ),
    hasOtpField: Boolean(
      document.querySelector(
        "input[autocomplete='one-time-code'], input[name*='pin'], input[id*='challenge']",
      ),
    ),
    hasGlobalNav: Boolean(document.querySelector(".global-nav, #global-nav, header nav")),
  };
})();
