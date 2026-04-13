import { loadWaitForPagesDeploymentEnv, waitForPagesDeployment } from "../lib/github-pages";

const env = loadWaitForPagesDeploymentEnv(process.env);

await waitForPagesDeployment(env);
