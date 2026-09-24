import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Replace any broken image (dead URL) with a neutral placeholder app-wide
document.addEventListener(
  "error",
  (e) => {
    const el = e.target as HTMLImageElement;
    if (el?.tagName !== "IMG" || el.dataset.fallback) return;
    el.dataset.fallback = "1";
    el.alt = "";
    el.src = "/placeholder.svg";
  },
  true,
);

createRoot(document.getElementById("root")!).render(<App />);
