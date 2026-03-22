import { render } from "solid-js/web";
import { registerOfflineSupport } from "./lib/offline/register-service-worker";
import RouteIndex from "./routes/index";
import "./styles/base.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Missing root element with id "root".');
}

registerOfflineSupport();

render(() => <RouteIndex />, rootElement);
