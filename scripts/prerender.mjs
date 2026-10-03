// After `vite build` and the SSR build:
//  1. write the prerendered Arabic landing page into dist/index.html (the browser hydrates it),
//  2. inline the stylesheet and boot.js (removes two render-blocking requests on slow phones),
//  3. allow the inlined boot script in the CSP by its SHA-256 hash (no 'unsafe-inline' for scripts),
//  4. preload the heading font.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const dist = path.resolve("dist");
const { render } = await import(pathToFileURL(path.resolve("dist-ssr/entry-server.js")).href);
const html = render("/");

const indexPath = path.join(dist, "index.html");
let index = readFileSync(indexPath, "utf8");
const must = (cond, msg) => {
  if (!cond) throw new Error(`prerender: ${msg}`);
};

// 1. prerendered markup
must(index.includes('<div id="root"></div>'), "root placeholder not found");
index = index.replace('<div id="root"></div>', `<div id="root" data-prerendered="ar">${html}</div>`);

// 2a. inline CSS
const cssLink = index.match(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/);
must(cssLink, "stylesheet link not found");
const css = readFileSync(path.join(dist, cssLink[1]), "utf8");
index = index.replace(cssLink[0], () => `<style>${css}</style>`);

// 2b. inline boot.js
const bootTag = '<script src="/boot.js"></script>';
must(index.includes(bootTag), "boot.js tag not found");
const boot = readFileSync(path.join(dist, "boot.js"), "utf8");
index = index.replace(bootTag, () => `<script>${boot}</script>`);
const bootHash = createHash("sha256").update(boot, "utf8").digest("base64");

// 3. CSP: allow exactly this inline script
const headersPath = path.join(dist, "_headers");
let headers = readFileSync(headersPath, "utf8");
must(headers.includes("script-src 'self'"), "CSP script-src not found");
headers = headers.replace("script-src 'self'", `script-src 'self' 'sha256-${bootHash}'`);
writeFileSync(headersPath, headers, "utf8");

// 4. heading font preload (the first screen's largest text)
const font = readdirSync(path.join(dist, "assets")).find((f) => /^ibm-plex-sans-arabic-arabic-600-normal-.*\.woff2$/.test(f));
if (font) index = index.replace("</head>", `  <link rel="preload" href="/assets/${font}" as="font" type="font/woff2" crossorigin />\n  </head>`);

writeFileSync(indexPath, index, "utf8");
rmSync(path.resolve("dist-ssr"), { recursive: true, force: true });
console.log(`prerendered / (${(html.length / 1024).toFixed(1)} KB), inlined CSS (${(css.length / 1024).toFixed(1)} KB) + boot.js (sha256-${bootHash.slice(0, 10)}...), preloaded ${font ? 1 : 0} font`);
