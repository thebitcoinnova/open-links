import { Route } from "@solidjs/router";
import EditorPage from "./pages/EditorPage";
import MarketingPage from "./pages/MarketingPage";
import OnboardingPage from "./pages/OnboardingPage";
import RoadmapPage from "./pages/RoadmapPage";

export default function App() {
  return (
    <>
      <Route path="/" component={MarketingPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/onboarding/github-install-complete" component={OnboardingPage} />
      <Route path="/roadmap" component={RoadmapPage} />
      <Route path="/editor/:repoId" component={EditorPage} />
    </>
  );
}
