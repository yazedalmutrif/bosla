import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./lib/theme";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);

// The landing page is prerendered in Arabic. Hydrate it only when that is what this visitor sees;
// otherwise (another page, or English) render fresh. boot.js hides the prerendered markup in that case.
const prerendered = root.dataset.prerendered;
if (prerendered && location.pathname === "/" && document.documentElement.lang === prerendered) {
  hydrateRoot(root, app);
} else {
  root.textContent = "";
  delete root.dataset.prerendered;
  createRoot(root).render(app);
}
