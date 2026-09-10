/**
 * Server-side form metadata store (file-based).
 * Used by generateMetadata to serve real OG/SEO tags without a backend.
 * Data is written here when the editor saves a form.
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".form-meta");
const DATA_FILE = path.join(DATA_DIR, "forms.json");

export interface FormMeta {
  slug: string;
  name: string;
  seoTitle?: string;
  seoDescription?: string;
  seoThumbnailUrl?: string;
  faviconUrl?: string;
  status: string;
}

function readStore(): Record<string, FormMeta> {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, FormMeta>): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getFormMeta(slug: string): FormMeta | null {
  return readStore()[slug] || null;
}

export function setFormMeta(slug: string, meta: FormMeta): void {
  const store = readStore();
  store[slug] = meta;
  writeStore(store);
}

export function deleteFormMeta(slug: string): void {
  const store = readStore();
  delete store[slug];
  writeStore(store);
}
