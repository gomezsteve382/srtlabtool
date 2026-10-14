import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScrapedSite } from "../shared/scraped-types.ts";
import { log } from "./log.ts";

/**
 * scraper.ts — Playwright loads the URL and extracts structured page data
 * (sections, copy, images, palette hints) plus a viewport and full-page
 * screenshot → scraped.json.
 */

export interface ScrapeOptions {
  url: string;
  /** Directory to write screenshots into (usually the run dir). */
  outDir: string;
  width?: number;
  height?: number;
  timeoutMs?: number;
}

export async function scrape(opts: ScrapeOptions): Promise<ScrapedSite> {
  const width = opts.width ?? 1440;
  const height = opts.height ?? 900;
  mkdirSync(opts.outDir, { recursive: true });

  log.step(`scraping ${opts.url}`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(opts.url, {
      waitUntil: "networkidle",
      timeout: opts.timeoutMs ?? 45_000,
    });
    // Give lazy content / fonts a beat.
    await page.waitForTimeout(1200);

    const extracted = await page.evaluate(() => {
      const abs = (u: string | null): string => {
        if (!u) return "";
        try {
          return new URL(u, document.baseURI).href;
        } catch {
          return "";
        }
      };

      const clean = (s: string) => s.replace(/\s+/g, " ").trim();

      // --- palette hints: count background colors on large elements ---
      const colorCount = new Map<string, number>();
      const toHex = (c: string): string | null => {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        const a = m[4] === undefined ? 1 : parseFloat(m[4]);
        if (a < 0.5) return null; // skip near-transparent
        const h = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
        return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
      };
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width * r.height < 40_000) return;
        const bg = getComputedStyle(el).backgroundColor;
        const hex = toHex(bg);
        if (hex) colorCount.set(hex, (colorCount.get(hex) ?? 0) + 1);
      });
      const paletteHints = [...colorCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([c]) => c);

      // --- headings ---
      const headings = [...document.querySelectorAll("h1,h2,h3")]
        .map((h) => clean(h.textContent ?? ""))
        .filter((t) => t.length > 1 && t.length < 160);

      // --- sections ---
      const sectionEls = [
        ...document.querySelectorAll("section, header, main > div, article, footer"),
      ].slice(0, 30);
      const sections = sectionEls
        .map((el, index) => {
          const heading = clean(el.querySelector("h1,h2,h3")?.textContent ?? "");
          const text = clean(el.textContent ?? "").slice(0, 1000);
          return { index, heading, text, tag: el.tagName.toLowerCase() };
        })
        .filter((s) => s.text.length > 20);

      // --- images ---
      const images = [...document.querySelectorAll("img")]
        .map((img) => ({
          src: abs(img.getAttribute("src")),
          alt: clean(img.getAttribute("alt") ?? ""),
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
        }))
        .filter((i) => i.src && i.width >= 200 && i.height >= 150)
        .slice(0, 24);

      // --- links that look like CTAs ---
      const ctaWords = /(start|try|get|book|buy|sign|contact|demo|learn|join|download|subscribe)/i;
      const links = [...document.querySelectorAll("a")]
        .map((a) => ({ text: clean(a.textContent ?? ""), href: abs(a.getAttribute("href")) }))
        .filter((l) => l.text.length > 1 && l.text.length < 40 && l.href && ctaWords.test(l.text))
        .slice(0, 12);

      const description =
        document.querySelector('meta[name="description"]')?.getAttribute("content") ??
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
        "";

      return {
        title: clean(document.title),
        description: clean(description),
        paletteHints,
        headings: [...new Set(headings)].slice(0, 20),
        sections,
        images,
        links,
      };
    });

    const viewportRel = "screenshots/viewport.png";
    const fullRel = "screenshots/full.png";
    mkdirSync(join(opts.outDir, "screenshots"), { recursive: true });
    await page.screenshot({ path: join(opts.outDir, viewportRel) });
    await page.screenshot({ path: join(opts.outDir, fullRel), fullPage: true });

    const result: ScrapedSite = {
      url: opts.url,
      ...extracted,
      screenshots: { viewport: viewportRel, full: fullRel },
      scrapedAt: new Date().toISOString(),
    };

    log.info(
      `scraped: ${result.sections.length} sections, ${result.images.length} images, ` +
        `${result.headings.length} headings, ${result.paletteHints.length} palette hints`,
    );
    return result;
  } finally {
    await browser.close();
  }
}

// --- standalone CLI: npm run scrape -- <url> <out scraped.json> ---
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [url, outFile] = process.argv.slice(2);
  if (!url || !outFile) {
    console.error("usage: npm run scrape -- <url> <out/scraped.json>");
    process.exit(1);
  }
  const result = await scrape({ url, outDir: dirname(outFile) });
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  log.info(`wrote ${outFile}`);
}
