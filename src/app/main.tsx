import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Disable pinch zoom on mobile Safari as well (Android honours the viewport
// meta tag, iOS additionally fires gesture events).
document.addEventListener(
  "gesturestart",
  (event) => event.preventDefault(),
  { passive: false },
);

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
