import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const SHOTS = path.resolve("screenshots");
const DL = path.resolve("test-results/downloads");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(DL, { recursive: true });

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "1440", width: 1440, height: 900 },
] as const;
const LANGS = ["ar", "en"] as const;

async function noHorizontalOverflow(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, "page must not scroll sideways").toBeLessThanOrEqual(cw + 1);
}

/** Scroll like a reader so scroll-in content is revealed, then return to the top for a full-page shot. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.5));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 140));
    }
    await new Promise((r) => setTimeout(r, 400));
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(900);
  await expect(page.locator(".reveal:not(.is-in)")).toHaveCount(0);
}

async function waitForHumanCheck(page: Page) {
  // Cloudflare's always-pass test sitekey fills this hidden input when the check completes.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 30_000 });
}

async function fillAndRun(page: Page, tool: "tailor" | "map") {
  await page.getByRole("button", { name: /Try with a sample|جرّب بمثال/ }).first().click();
  if (tool === "tailor") await page.getByRole("button", { name: /Try with a sample|جرّب بمثال/ }).nth(1).click();
  await page.getByRole("checkbox").check();
  await waitForHumanCheck(page);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("progress")).toBeVisible();
}

for (const lang of LANGS) {
  for (const vp of VIEWPORTS) {
    test.describe(`${lang} @ ${vp.name}px`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("landing page", async ({ page }) => {
        await page.goto(`/?lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
        await expect(page.locator("h1")).toBeVisible();
        await noHorizontalOverflow(page);
        await expect(page.getByText(lang === "ar" ? "3 محاولات مجانية يومياً" : "3 free runs a day")).toBeVisible();
        await scrollThrough(page);
        await page.screenshot({ path: `${SHOTS}/landing-${lang}-${vp.name}.png`, fullPage: true });
      });

      test("tool A: tailor CV (mock)", async ({ page }) => {
        await page.goto(`/tailor?lang=${lang}`);
        await expect(page.locator("h1")).toBeVisible();
        await fillAndRun(page, "tailor");
        await page.screenshot({ path: `${SHOTS}/tailor-progress-${lang}-${vp.name}.png` });
        await expect(page.getByTestId("tailor-result")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("verification-summary")).toBeVisible();
        await expect(page.getByTestId("fit-list").locator("li").first()).toBeVisible();
        await noHorizontalOverflow(page);
        await page.screenshot({ path: `${SHOTS}/tailor-result-${lang}-${vp.name}.png`, fullPage: true });

        // CV tab
        await page.getByRole("tab", { name: /Tailored CV|السيرة المفصّلة/ }).click();
        await expect(page.locator("article.print-doc")).toBeVisible();
        await noHorizontalOverflow(page);
        await page.screenshot({ path: `${SHOTS}/tailor-cv-${lang}-${vp.name}.png`, fullPage: true });

        // Verification tab shows the removed claim
        await page.getByRole("tab", { name: /Verification|التحقق/ }).click();
        await expect(page.getByTestId("report-list")).toContainText(/Tableau/);

        // Word download
        const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("dl-cv").click()]);
        const file = path.join(DL, `cv-${lang}-${vp.name}.docx`);
        await dl.saveAs(file);
        const zip = await JSZip.loadAsync(readFileSync(file));
        const xml = await zip.file("word/document.xml")!.async("string");
        expect(xml).toContain("Lama Abdullah");
        expect(xml).not.toContain("Tableau"); // removed by the verifier
        if (lang === "ar") {
          expect(xml).toContain("<w:bidi/>");
          expect(xml).toContain("<w:rtl/>");
          expect(xml).toMatch(/[؀-ۿ]/);
        }
      });

      test("tool B: job map (mock)", async ({ page }) => {
        await page.goto(`/map?lang=${lang}`);
        await expect(page.locator("h1")).toBeVisible();
        await fillAndRun(page, "map");
        await expect(page.getByTestId("map-result")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("titles").locator("li")).toHaveCount(8);
        await expect(page.getByTestId("fixes").locator("li")).toHaveCount(6);
        const links = await page.locator('[data-testid^="companies-"] a[href^="https://"]').count();
        expect(links).toBeGreaterThan(5);
        await noHorizontalOverflow(page);
        await page.screenshot({ path: `${SHOTS}/map-result-${lang}-${vp.name}.png`, fullPage: true });

        const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("dl-map").click()]);
        const file = path.join(DL, `map-${lang}-${vp.name}.docx`);
        await dl.saveAs(file);
        const zip = await JSZip.loadAsync(readFileSync(file));
        const xml = await zip.file("word/document.xml")!.async("string");
        if (lang === "ar") expect(xml).toContain("<w:bidi/>");
      });
    });
  }
}

test.describe("states", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("rate limit reached (error state)", async ({ page }) => {
    await page.route("**/api/tailor", (r) => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate_limited", retryAfterSec: 3600 }) }));
    await page.goto("/tailor?lang=ar");
    await fillAndRun(page, "tailor").catch(() => undefined);
    await expect(page.getByTestId("error")).toBeVisible();
    await expect(page.locator("[data-error-code=rate_limited]")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/error-rate-limit-ar-375.png` });
  });

  test("real limiter: the 4th run of the day from one browser is refused", async ({ request, baseURL }) => {
    const { SAMPLE_CV_EN } = await import("../../shared/samples");
    const cid = crypto.randomUUID();
    const body = { cvText: SAMPLE_CV_EN, city: "both", outputLang: "en", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", clientId: cid };
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await request.post("/api/map", { data: body, headers: { origin: baseURL! } });
      statuses.push(r.status());
      if (i === 3) expect(await r.json()).toMatchObject({ error: "rate_limited" });
      else await r.text();
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    const q = await (await request.get(`/api/quota?cid=${cid}`)).json();
    expect(q).toMatchObject({ limit: 3, used: 3, remaining: 0 });
    // A cross-site POST is rejected before any work is done.
    const cross = await request.post("/api/map", { data: body, headers: { origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);
  });

  test("service down (error state)", async ({ page }) => {
    await page.route("**/api/map", (r) => r.fulfill({ status: 200, contentType: "application/x-ndjson", body: '{"type":"progress","step":"extract","status":"start"}\n{"type":"error","code":"upstream_overloaded"}\n' }));
    await page.goto("/map?lang=en");
    await fillAndRun(page, "map").catch(() => undefined);
    await expect(page.locator("[data-error-code=upstream_overloaded]")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/error-api-down-en-375.png` });
  });

  test("form validation", async ({ page }) => {
    await page.goto("/tailor?lang=en");
    await page.getByTestId("run").click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByText("Please tick the box above to continue.")).toBeVisible();
  });

  test("file upload: DOCX and PDF are read in the browser", async ({ page, browser }) => {
    // Build fixtures: a DOCX with the docx library, a PDF printed by Chrome from Arabic HTML.
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const { SAMPLE_CV_AR, SAMPLE_CV_EN } = await import("../../shared/samples");
    const doc = new Document({ sections: [{ children: SAMPLE_CV_EN.split("\n").map((l) => new Paragraph({ children: [new TextRun(l)] })) }] });
    const docxBuf = await Packer.toBuffer(doc);
    const p2 = await browser.newPage();
    await p2.setContent(`<html dir="rtl" lang="ar"><body style="font-family:Arial;font-size:14px">${SAMPLE_CV_AR.split("\n").map((l) => `<p>${l}</p>`).join("")}</body></html>`);
    const pdfBuf = await p2.pdf({ format: "A4" });
    await p2.close();
    mkdirSync("tests/fixtures", { recursive: true });
    writeFileSync("tests/fixtures/sample-en.docx", docxBuf);
    writeFileSync("tests/fixtures/sample-ar.pdf", pdfBuf);

    await page.goto("/tailor?lang=en");
    await page.getByTestId("cv-file").setInputFiles({ name: "cv.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docxBuf });
    await expect(page.locator("textarea").first()).toHaveValue(/King Abdulaziz University/);
    await page.getByTestId("cv-file").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: pdfBuf });
    await expect(page.locator("textarea").first()).toHaveValue(/جامعة الملك عبدالعزيز/, { timeout: 20_000 });
    await page.getByTestId("cv-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText(/Please use a PDF or Word/)).toBeVisible();
  });

  test("pages render: privacy, terms, about, 404", async ({ page }) => {
    for (const [p, h] of [
      ["/privacy?lang=ar", "الخصوصية"],
      ["/terms?lang=en", "Terms and disclaimer"],
      ["/about?lang=en", "About Bosla"],
      ["/nope?lang=en", "Page not found"],
    ] as const) {
      await page.goto(p);
      await expect(page.locator("h1")).toHaveText(h);
      await noHorizontalOverflow(page);
    }
    await page.goto("/privacy?lang=ar");
    await expect(page.locator("h1")).toHaveText("الخصوصية"); // wait for the lazy-loaded page
    await page.screenshot({ path: `${SHOTS}/privacy-ar-375.png`, fullPage: true });
  });

  test("dark mode landing", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/?lang=ar");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await scrollThrough(page);
    await page.screenshot({ path: `${SHOTS}/landing-dark-ar-375.png`, fullPage: true });
  });
});
