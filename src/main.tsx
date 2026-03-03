import { render } from "solid-js/web";
import RouteIndex from "./routes/index";
import "./styles/base.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Missing root element with id "root".');
}

render(() => <RouteIndex />, rootElement);
