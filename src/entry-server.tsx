// Build-time prerender of the landing page (Arabic, light theme). The browser hydrates it.
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./lib/theme";

export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <ThemeProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </ThemeProvider>
      </StaticRouter>
    </StrictMode>,
  );
}
