module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
      },
      url: ["http://127.0.0.1:4173/"],
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
  openLinks: {
    notes:
      "This file exists as deterministic runtime-audit config scaffolding for Phase 5 policy docs and future adapter expansion.",
  },
};
