/**
 * Structured shape of `scraped.json`, produced by scraper.ts and consumed by
 * pre-gate.ts and agent.ts. Kept dependency-free so it can be imported anywhere.
 */

export interface ScrapedImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ScrapedSection {
  /** DOM-order index. */
  index: number;
  /** Most prominent heading text in the section, if any. */
  heading: string;
  /** Concatenated visible text (trimmed/capped). */
  text: string;
  /** Tag name the section was derived from (section/header/main/div…). */
  tag: string;
  /** Role assigned by the pre-gate agent (hero/feature/testimonial/cta/…). */
  role?: string;
}

export interface ScrapedSite {
  url: string;
  title: string;
  description: string;
  /** Hex colors observed on large surfaces, most-frequent first. */
  paletteHints: string[];
  sections: ScrapedSection[];
  images: ScrapedImage[];
  /** Headline candidates (h1/h2 text), de-duped. */
  headings: string[];
  /** Outbound/CTA-looking links: {text, href}. */
  links: Array<{ text: string; href: string }>;
  /** Relative paths (inside the run dir) to captured screenshots. */
  screenshots: { viewport: string; full: string };
  scrapedAt: string;
}

export type TreatmentLevel = "full" | "minimal" | "skip";

export interface PreGate {
  /** 0..100 worthiness score. */
  score: number;
  mood: string;
  treatment: TreatmentLevel;
  reasoning: string;
  /** Section role classifications keyed by section index. */
  sectionRoles: Array<{ index: number; role: string }>;
}
