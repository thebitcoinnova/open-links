import { Router } from "@solidjs/router";
import { render } from "solid-js/web";
import App from "./App";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element for studio web app.");
}

render(
  () => (
    <Router>
      <App />
    </Router>
  ),
  root,
);
