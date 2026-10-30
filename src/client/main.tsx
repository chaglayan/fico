import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/figtree";
import "./styles.css";
import { resumeAnalytics } from "./analytics";
import { App } from "./App";

resumeAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
